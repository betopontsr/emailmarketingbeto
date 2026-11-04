import { asc, desc, eq, inArray } from "drizzle-orm";
import { customerEvents, customers, emailEvents, flows, purchases, scheduledEmails, webhookEvents } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import { renderEmail } from "@/emails/render";
import type { TemplateKey } from "@/lib/engine/types";
import { buildContext } from "@/lib/email/context";
import { unsubscribePageUrl } from "@/lib/email/unsubscribe";
import { getSettings } from "@/lib/settings";

export async function customerDetail(db: DbOrTx, id: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) return null;
  const [fl, em, pu, tl, wh] = await Promise.all([
    db.select().from(flows).where(eq(flows.customerId, id)).orderBy(asc(flows.createdAt)),
    db.select().from(scheduledEmails).where(eq(scheduledEmails.customerId, id)).orderBy(asc(scheduledEmails.stepOrder)),
    db.select().from(purchases).where(eq(purchases.customerId, id)).orderBy(asc(purchases.purchasedAt)),
    db.select().from(customerEvents).where(eq(customerEvents.customerId, id)).orderBy(desc(customerEvents.occurredAt), desc(customerEvents.id)),
    db
      .select({ id: webhookEvents.id, status: webhookEvents.status, eventType: webhookEvents.eventType, receivedAt: webhookEvents.receivedAt })
      .from(webhookEvents)
      .where(eq(webhookEvents.customerId, id))
      .orderBy(desc(webhookEvents.receivedAt)),
  ]);
  const ids = em.map((e) => e.id);
  const evs = ids.length ? await db.select().from(emailEvents).where(inArray(emailEvents.scheduledEmailId, ids)) : [];
  const flags = new Map<string, { delivered: boolean; opened: Date | null; clicked: Date | null; bounced: boolean; complained: boolean }>();
  for (const e of evs) {
    const f = flags.get(e.scheduledEmailId!) ?? { delivered: false, opened: null, clicked: null, bounced: false, complained: false };
    if (e.type === "delivered") f.delivered = true;
    if (e.type === "opened" && (!f.opened || e.occurredAt < f.opened)) f.opened = e.occurredAt;
    if (e.type === "clicked" && (!f.clicked || e.occurredAt < f.clicked)) f.clicked = e.occurredAt;
    if (e.type === "bounced") f.bounced = true;
    if (e.type === "complained") f.complained = true;
    flags.set(e.scheduledEmailId!, f);
  }
  return { customer, flows: fl, emails: em, purchases: pu, timeline: tl, webhooks: wh, flags };
}

/** HTML de um e-mail: o que foi gravado no envio, ou uma prévia com as configurações atuais. */
export async function emailHtml(db: DbOrTx, emailId: string) {
  const [e] = await db.select().from(scheduledEmails).where(eq(scheduledEmails.id, emailId));
  if (!e) return null;
  if (e.renderedHtml) return { email: e, html: e.renderedHtml, subject: e.renderedSubject, preview: false };
  const [c] = await db.select().from(customers).where(eq(customers.id, e.customerId));
  const [f] = await db.select().from(flows).where(eq(flows.id, e.flowId));
  const s = await getSettings(db);
  const { ctx } = buildContext(s, c, f, new Date(Math.max(Date.now(), e.scheduledFor.getTime())));
  const r = renderEmail(e.templateKey as TemplateKey, ctx, { unsubscribeUrl: unsubscribePageUrl(c.id), postalAddress: s.postalAddress || "[endereço postal não configurado]" });
  return { email: e, html: r.html, subject: r.subject, preview: true };
}
