import type { TemplateKey } from "@/lib/engine/types";
import { redirectLink } from "./links";
import { rec_a1, rec_a2, rec_b1, rec_b2, rec_f3 } from "./recovery";
import type { Block, EmailContext, TemplateMap } from "./types";
import { upsell_1, upsell_2, upsell_3, upsell_4, upsell_5, upsell_6, upsell_7 } from "./upsells";

export const TEMPLATES: TemplateMap = {
  upsell_1,
  upsell_2,
  upsell_3,
  upsell_4,
  upsell_5,
  upsell_6,
  upsell_7,
  rec_a1,
  rec_a2,
  rec_b1,
  rec_b2,
  rec_f3,
};

export type Footer = { unsubscribeUrl: string; postalAddress: string };
export type RenderedEmail = { subject: string; preview: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (u: string) => (/^(https?:|mailto:)/i.test(u) ? u : "#");

/** **negrito** e [rótulo](url) → HTML; o resto é escapado. */
function inlineHtml(s: string): string {
  const out: string[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out.push(esc(s.slice(last, m.index)));
    if (m[1] !== undefined) out.push(`<strong>${esc(m[1])}</strong>`);
    else out.push(`<a href="${esc(safeUrl(m[3]))}" style="color:#1a56db;">${esc(m[2])}</a>`);
    last = m.index + m[0].length;
  }
  out.push(esc(s.slice(last)));
  return out.join("");
}

function inlineText(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)");
}

const P = "margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#1f2937;";

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "p":
      return `<p style="${P}">${inlineHtml(b.text)}</p>`;
    case "ul":
    case "ol": {
      const tag = b.kind;
      const items = b.items.map((i) => `<li style="margin:0 0 8px 0;">${inlineHtml(i)}</li>`).join("");
      return `<${tag} style="margin:0 0 16px 0;padding-left:24px;font-size:16px;line-height:1.6;color:#1f2937;">${items}</${tag}>`;
    }
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:6px;background:#1a56db;">
<a href="${esc(safeUrl(b.href))}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(b.text)}</a>
</td></tr></table>`;
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "p":
      return inlineText(b.text);
    case "ul":
      return b.items.map((i) => `- ${inlineText(i)}`).join("\n");
    case "ol":
      return b.items.map((i, n) => `${n + 1}. ${inlineText(i)}`).join("\n");
    case "button":
      return `${b.text}\n${b.href}`;
  }
}

export function renderEmail(key: TemplateKey, ctx: EmailContext, footer: Footer): RenderedEmail {
  const raw = TEMPLATES[key](ctx);
  const c = {
    ...raw,
    blocks: raw.blocks.map((b) => (b.kind === "button" ? { ...b, href: redirectLink(b.href, ctx.linkBase ?? null) } : b)),
  };
  const body = c.blocks.map(blockHtml).join("\n");
  const address = esc(footer.postalAddress).replace(/\n/g, "<br>");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;">${esc(c.preview)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;text-align:left;">
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px 0;">
<p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:#6b7280;"><a href="${esc(footer.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a></p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">${address}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const text = `${c.blocks.map(blockText).join("\n\n")}\n\n---\nUnsubscribe: ${footer.unsubscribeUrl}\n${footer.postalAddress}\n`;
  return { subject: c.subject, preview: c.preview, html, text };
}
