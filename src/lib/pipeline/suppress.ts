import { and, eq } from "drizzle-orm";
import { customers, flows, scheduledEmails } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import { applyActions } from "./handle";
import { lockCustomer } from "./state";

/** Suprime o cliente: cancela pendentes e encerra fluxos ativos. */
export async function suppressCustomer(tx: DbOrTx, customerId: number, reason: string, now = new Date()): Promise<void> {
  const c = await lockCustomer(tx, customerId);
  if (!c) return;
  const pending = await tx
    .select({ id: scheduledEmails.id })
    .from(scheduledEmails)
    .where(and(eq(scheduledEmails.customerId, customerId), eq(scheduledEmails.status, "scheduled")));
  const active = await tx.select({ id: flows.id }).from(flows).where(and(eq(flows.customerId, customerId), eq(flows.status, "active")));
  await applyActions(tx, { customerId, eventId: null, isTest: c.isTest, now, timezone: "UTC" }, [
    ...(c.suppressed ? [] : [{ type: "suppress" as const, reason }]),
    ...(pending.length ? [{ type: "cancel_emails" as const, emailIds: pending.map((p) => p.id), reason: `cliente suprimido: ${reason}` }] : []),
    ...active.map((f) => ({ type: "end_flow" as const, flowId: f.id, status: "cancelled" as const, reason: `cliente suprimido: ${reason}` })),
  ]);
}

export async function reactivateCustomer(tx: DbOrTx, customerId: number, now = new Date()): Promise<void> {
  await tx
    .update(customers)
    .set({ suppressed: false, suppressedReason: null, suppressedAt: null, updatedAt: now })
    .where(eq(customers.id, customerId));
  await applyActions(tx, { customerId, eventId: null, isTest: false, now, timezone: "UTC" }, [
    { type: "timeline", kind: "reactivated", summary: "Cliente reativado manualmente no painel (fluxos encerrados não voltam)" },
  ]);
}
