import { and, desc, eq, inArray } from "drizzle-orm";
import { LINKS } from "@/emails/links";
import { customerEvents, customers, emailEvents, flows, purchases, scheduledEmails, webhookEvents } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { NormalizedEvent, ProductKey } from "@/lib/events/types";
import { receiveAndProcess } from "@/lib/pipeline/run";
import { randomUUID } from "node:crypto";

const code = (url: string) => url.split("/").pop()!;

export const SIM_ACTIONS = {
  abandon: { label: "Abandono do checkout (principal)", type: "checkout_abandoned", code: code(LINKS.main47), amount: 47 },
  decline: { label: "Cartão recusado (principal)", type: "payment_declined", code: code(LINKS.main47), amount: 47 },
  decline_funds: { label: "Cartão recusado por saldo insuficiente", type: "payment_declined", code: code(LINKS.main47), amount: 47, declineReason: "insufficient_funds" },
  buy_main: { label: "Compra do principal ($47)", type: "purchase_approved", code: code(LINKS.main47), amount: 47 },
  buy_main27: { label: "Compra do principal pela oferta de $27", type: "purchase_approved", code: code(LINKS.main27), amount: 27 },
  buy_nathan67: { label: "Compra Nathan $67", type: "purchase_approved", code: code(LINKS.nathan67), amount: 67 },
  buy_nathan47: { label: "Compra Nathan $47", type: "purchase_approved", code: code(LINKS.nathan47), amount: 47 },
  buy_knots47: { label: "Compra Knots $47", type: "purchase_approved", code: code(LINKS.knots47), amount: 47 },
  buy_knots19: { label: "Compra Knots $19", type: "purchase_approved", code: code(LINKS.knots19), amount: 19 },
  buy_reclaim97: { label: "Compra Reclaim $97", type: "purchase_approved", code: code(LINKS.reclaim97), amount: 97 },
  buy_reclaim47: { label: "Compra Reclaim $47", type: "purchase_approved", code: code(LINKS.reclaim47), amount: 47 },
  refund: { label: "Reembolso da última compra", type: "refunded", code: null, amount: 0 },
  chargeback: { label: "Chargeback da última compra", type: "chargeback", code: null, amount: 0 },
} as const;
export type SimAction = keyof typeof SIM_ACTIONS;

const PRODUCT_CODE: Record<ProductKey, string> = {
  main: code(LINKS.main47),
  nathan: code(LINKS.nathan67),
  knots: code(LINKS.knots47),
  reclaim: code(LINKS.reclaim97),
};

/** Cria um evento falso e manda pelo MESMO pipeline do webhook (provider "simulator", is_test). */
export async function simulate(db: Db, input: { action: SimAction; email: string; name: string; country: string; region: string }, now = new Date()) {
  const a = SIM_ACTIONS[input.action];
  const email = input.email.trim().toLowerCase();
  let productCode: string | null = a.code;
  let tx: string | null = `SIM-${randomUUID().slice(0, 8)}`;
  if (a.type === "refunded" || a.type === "chargeback") {
    const [c] = await db.select().from(customers).where(eq(customers.email, email));
    const [p] = c
      ? await db.select().from(purchases).where(and(eq(purchases.customerId, c.id), eq(purchases.status, "approved"))).orderBy(desc(purchases.purchasedAt)).limit(1)
      : [];
    if (!p) throw new Error("Esse cliente não tem compra aprovada para reembolsar.");
    productCode = PRODUCT_CODE[p.productKey as ProductKey];
    tx = p.transactionId;
  }
  const full = input.name.trim() || null;
  const ev: NormalizedEvent = {
    providerEventId: `sim-${randomUUID()}`,
    type: a.type,
    occurredAt: now.toISOString(),
    customer: {
      email,
      fullName: full,
      firstName: full ? full.split(/\s+/)[0] : null,
      country: input.country.trim().toUpperCase() || null,
      region: input.region.trim().toUpperCase() || null,
      phone: null,
      timezone: null,
    },
    product: { code: productCode, planCode: null, offerCode: null, name: null },
    transactionId: a.type === "checkout_abandoned" ? null : tx,
    amount: a.amount || null,
    currency: "USD",
    rawStatus: `simulador:${input.action}`,
    declineReason: "declineReason" in a ? a.declineReason : null,
    recoveryUrl: null,
  };
  return receiveAndProcess(db, { provider: "simulator", raw: ev, isTest: true }, { now });
}

/** Apaga TODOS os dados de clientes de teste (não toca em clientes reais). */
export async function deleteTestData(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const ids = (await tx.select({ id: customers.id }).from(customers).where(eq(customers.isTest, true))).map((c) => c.id);
    if (ids.length) {
      const emailIds = tx.select({ id: scheduledEmails.id }).from(scheduledEmails).where(inArray(scheduledEmails.customerId, ids));
      await tx.delete(emailEvents).where(inArray(emailEvents.scheduledEmailId, emailIds));
      await tx.delete(emailEvents).where(inArray(emailEvents.customerId, ids));
      await tx.delete(purchases).where(inArray(purchases.customerId, ids));
      await tx.delete(scheduledEmails).where(inArray(scheduledEmails.customerId, ids));
      await tx.delete(customerEvents).where(inArray(customerEvents.customerId, ids));
      await tx.update(webhookEvents).set({ customerId: null }).where(inArray(webhookEvents.customerId, ids));
      await tx.update(flows).set({ startedByEventId: null }).where(inArray(flows.customerId, ids));
      await tx.delete(flows).where(inArray(flows.customerId, ids));
      await tx.delete(customers).where(inArray(customers.id, ids));
    }
    await tx.delete(webhookEvents).where(eq(webhookEvents.provider, "simulator"));
    return ids.length;
  });
}
