import { and, eq } from "drizzle-orm";
import { customerEvents, customers, productMappings, webhookEvents, type Customer } from "@/lib/db/schema";
import type { Db, DbOrTx } from "@/lib/db/types";
import { EVENT_TYPE_LABELS, PRODUCT_LABELS, normalizedEventSchema, type NormalizedEvent, type ProductKey } from "@/lib/events/types";
import { adaptPerfectPay, deriveDedupeKey, sanitizeRaw, type AdaptResult } from "@/lib/perfectpay/adapter";
import { resolveProduct } from "@/lib/products/resolve";
import { sha256 } from "@/lib/util/crypto";
import { properCase } from "@/lib/util/names";
import { isValidZone } from "@/lib/util/time";
import { zoneFromLocation } from "@/lib/util/zones";

export type Provider = "perfectpay" | "simulator";

export function adapt(provider: Provider, raw: unknown, receivedAt: Date): AdaptResult {
  if (provider === "perfectpay") return adaptPerfectPay(raw, receivedAt);
  // Simulador: o payload já está no formato normalizado.
  const p = normalizedEventSchema.safeParse(raw);
  const key = (r: unknown) => `h:${sha256(JSON.stringify(r))}`;
  if (!p.success) return { ok: false, reason: "evento do simulador inválido", dedupeKey: key(raw) };
  const e = p.data;
  return {
    ok: true,
    event: e,
    dedupeKey: deriveDedupeKey({
      providerEventId: e.providerEventId,
      transactionId: e.transactionId,
      rawStatus: e.rawStatus ?? e.type,
      occurredAt: e.occurredAt,
      email: e.customer.email,
      productCode: e.product.code,
    }),
  };
}

/**
 * Passo 1: grava o payload bruto ANTES de qualquer processamento.
 * Evento repetido é gravado como "duplicado" e não tem nenhum efeito.
 */
export async function ingestWebhook(
  db: Db,
  input: { provider: Provider; raw: unknown; isTest?: boolean; receivedAt?: Date },
): Promise<{ id: number; duplicate: boolean }> {
  const receivedAt = input.receivedAt ?? new Date();
  const raw = sanitizeRaw(input.raw) as object;
  let dedupeKey: string;
  try {
    dedupeKey = adapt(input.provider, raw, receivedAt).dedupeKey;
  } catch {
    dedupeKey = `h:${sha256(JSON.stringify(raw))}`;
  }
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider: input.provider, dedupeKey, rawPayload: raw, receivedAt, isTest: !!input.isTest })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted[0]) return { id: inserted[0].id, duplicate: false };

  const [original] = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, input.provider), eq(webhookEvents.dedupeKey, dedupeKey), eq(webhookEvents.isDuplicate, false)));
  const [dup] = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      dedupeKey,
      isDuplicate: true,
      rawPayload: raw,
      receivedAt,
      isTest: !!input.isTest,
      status: "duplicate",
      statusReason: original ? `repetição do evento #${original.id}` : "evento repetido",
      processedAt: receivedAt,
    })
    .returning({ id: webhookEvents.id });
  return { id: dup.id, duplicate: true };
}

export async function addTimeline(
  db: DbOrTx,
  customerId: number,
  type: string,
  summary: string,
  occurredAt: Date,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(customerEvents).values({ customerId, type, summary, occurredAt, metadata: metadata ?? null });
}

/** Cria ou atualiza o cliente sem apagar dados que já existiam. */
export async function upsertCustomer(db: DbOrTx, e: NormalizedEvent, isTest: boolean): Promise<Customer> {
  const c = e.customer;
  const patch = {
    ...(c.fullName ? { fullName: c.fullName } : {}),
    ...(c.firstName ? { firstName: properCase(c.firstName) } : {}),
    ...(c.country ? { country: c.country } : {}),
    ...(c.region ? { region: c.region } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
  };
  const zone = isValidZone(c.timezone) ? c.timezone : zoneFromLocation(c.country, c.region);
  if (zone) Object.assign(patch, { timezone: zone });
  const [row] = await db
    .insert(customers)
    .values({ email: c.email, isTest, ...patch })
    .onConflictDoUpdate({ target: customers.email, set: { ...patch, updatedAt: new Date() } })
    .returning();
  return row;
}

export type ProcessContext = {
  tx: DbOrTx;
  eventId: number;
  event: NormalizedEvent;
  productKey: ProductKey;
  customer: Customer;
  isTest: boolean;
  now: Date;
};

export type ProcessHandler = (ctx: ProcessContext) => Promise<{ status: "processed" | "ignored"; reason: string | null }>;

/**
 * Passo 2: interpreta o evento gravado. Pode ser chamado de novo (reprocessar):
 * o adaptador roda outra vez sobre o payload bruto.
 */
export async function processWebhookEvent(
  db: Db,
  eventId: number,
  handler: ProcessHandler,
  opts: { now?: Date; force?: boolean } = {},
): Promise<{ status: string; reason: string | null }> {
  const now = opts.now ?? new Date();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
  if (!row) throw new Error(`evento #${eventId} não existe`);
  if (row.isDuplicate) return { status: "duplicate", reason: row.statusReason };
  if (!opts.force && !["received", "error"].includes(row.status)) return { status: row.status, reason: row.statusReason };

  const finish = async (status: string, reason: string | null, extra: Partial<typeof webhookEvents.$inferInsert> = {}) => {
    await db
      .update(webhookEvents)
      .set({ status, statusReason: reason, error: null, processedAt: now, ...extra })
      .where(eq(webhookEvents.id, eventId));
    return { status, reason };
  };

  try {
    const adapted = adapt(row.provider as Provider, row.rawPayload, row.receivedAt);
    if (!adapted.ok) return await finish("unrecognized", adapted.reason, { normalized: null, eventType: null });
    const e = adapted.event;

    const mappings = await db.select().from(productMappings);
    const resolved = resolveProduct(e.product, mappings);
    if (!resolved.ok) {
      const reason =
        resolved.reason === "ambiguous"
          ? `produto bate com mais de um mapeamento (${resolved.candidates.join(", ")})`
          : `produto sem mapeamento (${[e.product.code, e.product.planCode, e.product.offerCode, e.product.name].filter(Boolean).join(" / ") || "sem código"})`;
      return await finish("unmapped", reason, { normalized: e, eventType: e.type, productKey: null });
    }

    return await db.transaction(async (tx) => {
      const customer = await upsertCustomer(tx, e, row.isTest);
      await addTimeline(
        tx,
        customer.id,
        "webhook",
        `Webhook: ${EVENT_TYPE_LABELS[e.type]} — ${PRODUCT_LABELS[resolved.productKey]}`,
        new Date(e.occurredAt),
        { webhookEventId: eventId, rawStatus: e.rawStatus, amount: e.amount, currency: e.currency, declineReason: e.declineReason },
      );
      const r = await handler({ tx, eventId, event: e, productKey: resolved.productKey, customer, isTest: row.isTest, now });
      await tx
        .update(webhookEvents)
        .set({
          status: r.status,
          statusReason: r.reason,
          error: null,
          processedAt: now,
          normalized: e,
          eventType: e.type,
          productKey: resolved.productKey,
          customerId: customer.id,
        })
        .where(eq(webhookEvents.id, eventId));
      return r;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(webhookEvents).set({ status: "error", error: msg.slice(0, 2000), processedAt: now }).where(eq(webhookEvents.id, eventId));
    return { status: "error", reason: msg };
  }
}
