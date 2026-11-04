import { renderEmail } from "@/emails/render";
import type { TemplateKey } from "@/lib/engine/types";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { buildContext } from "./context";
import type { Settings } from "@/lib/settings";
import { baseUrl } from "@/lib/env";

/** Prévia com dados de exemplo (John, Nova York, envio agora). */
export function previewTemplate(key: TemplateKey, s: Settings, opts: { firstName?: string | null; flowB?: boolean } = {}) {
  const flowType = TEMPLATE_INFO[key].flow === "upsell" ? "upsell" : opts.flowB || key.startsWith("rec_b") ? "recovery_b" : "recovery_a";
  const { ctx } = buildContext(s, { firstName: opts.firstName === undefined ? "John" : opts.firstName, timezone: "America/New_York" }, { type: flowType, recoveryUrl: null }, new Date());
  return renderEmail(key, ctx, { unsubscribeUrl: `${baseUrl()}/u/exemplo`, postalAddress: s.postalAddress || "[endereço postal não configurado]" });
}
