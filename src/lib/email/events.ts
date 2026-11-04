import { eq } from "drizzle-orm";
import { emailEvents, scheduledEmails } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import type { TemplateKey } from "@/lib/engine/types";
import { addTimeline } from "@/lib/pipeline/ingest";
import { suppressCustomer } from "@/lib/pipeline/suppress";

const TYPES: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

export const EMAIL_EVENT_LABELS: Record<string, string> = {
  sent: "enviado (Resend)",
  delivered: "entregue",
  delivery_delayed: "atraso na entrega",
  bounced: "bounce",
  complained: "reclamação de spam",
  opened: "aberto (aprox.)",
  clicked: "clicado",
  failed: "falha no Resend",
  suppressed: "suprimido pelo Resend",
};

type Payload = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    tags?: Record<string, string> | { name: string; value: string }[];
    bounce?: { type?: string; subType?: string; message?: string };
    click?: { link?: string; timestamp?: string };
    failed?: { reason?: string };
    suppressed?: { type?: string; message?: string };
  };
};

function tag(tags: Record<string, string> | { name: string; value: string }[] | undefined, name: string): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) return tags.find((t) => t.name === name)?.value ?? null;
  return (tags as Record<string, string>)[name] ?? null;
}

/** Registra um evento do Resend. Bounce permanente, spam e supressão suprimem o cliente. */
export async function recordResendEvent(db: Db, providerEventId: string | null, payload: Payload, now = new Date()) {
  const type = TYPES[payload.type];
  if (!type) return { status: "ignored" as const };
  const d = payload.data ?? {};
  const scheduledId = tag(d.tags, "scheduled_email_id");
  const [email] = scheduledId && /^[0-9a-f-]{36}$/i.test(scheduledId)
    ? await db.select().from(scheduledEmails).where(eq(scheduledEmails.id, scheduledId))
    : d.email_id
      ? await db.select().from(scheduledEmails).where(eq(scheduledEmails.resendId, d.email_id))
      : [];
  const occurredAt = new Date(d.click?.timestamp ?? payload.created_at ?? d.created_at ?? now.toISOString());
  const detail =
    type === "bounced"
      ? [d.bounce?.type, d.bounce?.subType, d.bounce?.message].filter(Boolean).join(" · ")
      : type === "failed"
        ? d.failed?.reason ?? null
        : type === "suppressed"
          ? [d.suppressed?.type, d.suppressed?.message].filter(Boolean).join(" · ")
          : null;

  const inserted = await db
    .insert(emailEvents)
    .values({
      providerEventId,
      scheduledEmailId: email?.id ?? null,
      resendEmailId: d.email_id ?? null,
      customerId: email?.customerId ?? null,
      type,
      detail: detail || null,
      url: d.click?.link ?? null,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? now : occurredAt,
      raw: payload as object,
    })
    .onConflictDoNothing()
    .returning({ id: emailEvents.id });
  if (!inserted.length) return { status: "duplicate" as const };
  if (!email) return { status: "unmatched" as const };

  const label = TEMPLATE_INFO[email.templateKey as TemplateKey]?.label ?? email.templateKey;
  if (["opened", "clicked", "bounced", "complained", "failed", "suppressed", "delivery_delayed"].includes(type)) {
    await addTimeline(db, email.customerId, `email_${type}`, `${label}: ${EMAIL_EVENT_LABELS[type]}${type === "clicked" && d.click?.link ? ` (${d.click.link})` : ""}${detail ? ` — ${detail}` : ""}`, occurredAt, { emailId: email.id });
  }
  const permanentBounce = type === "bounced" && /permanent/i.test(d.bounce?.type ?? "");
  if (permanentBounce || type === "complained" || type === "suppressed") {
    const reason = permanentBounce ? "bounce permanente" : type === "complained" ? "reclamação de spam" : "suprimido pelo Resend";
    await db.transaction((tx) => suppressCustomer(tx, email.customerId, reason, now));
  }
  return { status: "recorded" as const };
}
