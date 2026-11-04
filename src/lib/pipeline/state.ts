import { and, eq, inArray } from "drizzle-orm";
import { customers, flows, purchases, scheduledEmails, type Customer } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import type { CustomerState, EmailStatus, EngineConfig, FlowStatus, FlowType, TemplateKey } from "@/lib/engine/types";
import type { OfferKey, ProductKey } from "@/lib/events/types";
import type { Settings } from "@/lib/settings";
import { resolveZone } from "@/lib/util/time";

export function engineConfig(s: Settings): EngineConfig {
  return {
    upsellHour: s.upsellHour,
    quietStartHour: s.quietStartHour,
    quietEndHour: s.quietEndHour,
    quietResumeHour: s.quietResumeHour,
    controlPercent: s.controlPercent,
    maxLatenessHours: s.maxLatenessHours,
  };
}

/** Monta o retrato do cliente que o motor precisa. */
export async function loadCustomerState(db: DbOrTx, customer: Customer, s: Settings): Promise<CustomerState> {
  // Em sequência: dentro de uma transação a conexão é uma só.
  const fl = await db.select().from(flows).where(eq(flows.customerId, customer.id));
  const em = await db.select().from(scheduledEmails).where(eq(scheduledEmails.customerId, customer.id));
  const pu = await db.select().from(purchases).where(eq(purchases.customerId, customer.id));
  const flowType = new Map(fl.map((f) => [f.id, f.type as FlowType]));
  return {
    customerId: customer.id,
    suppressed: customer.suppressed,
    suppressedReason: customer.suppressedReason,
    timezone: resolveZone(customer.timezone, s.defaultTimezone),
    flows: fl.map((f) => ({
      id: f.id,
      type: f.type as FlowType,
      status: f.status as FlowStatus,
      anchorAt: f.anchorAt,
      createdAt: f.createdAt,
      endedAt: f.endedAt,
      includesF3: f.includesF3,
      isControl: f.isControl,
    })),
    emails: em.map((e) => ({
      id: e.id,
      flowId: e.flowId,
      flowType: flowType.get(e.flowId) ?? "upsell",
      templateKey: e.templateKey as TemplateKey,
      offerKey: (e.offerKey as OfferKey | null) ?? null,
      status: e.status as EmailStatus,
      scheduledFor: e.scheduledFor,
      sentAt: e.sentAt,
    })),
    purchases: pu.map((p) => ({
      transactionId: p.transactionId,
      productKey: p.productKey as ProductKey,
      status: p.status as "approved" | "refunded" | "chargeback",
      purchasedAt: p.purchasedAt,
    })),
  };
}

/** Trava a linha do cliente até o fim da transação (eventos do mesmo cliente não correm em paralelo). */
export async function lockCustomer(db: DbOrTx, customerId: number): Promise<Customer> {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId)).for("update");
  return c;
}

export async function cancelScheduled(db: DbOrTx, ids: string[], reason: string, now: Date): Promise<number> {
  if (!ids.length) return 0;
  const r = await db
    .update(scheduledEmails)
    .set({ status: "cancelled", statusReason: reason, updatedAt: now })
    .where(and(inArray(scheduledEmails.id, ids), eq(scheduledEmails.status, "scheduled")))
    .returning({ id: scheduledEmails.id });
  return r.length;
}
