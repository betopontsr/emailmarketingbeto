import { and, eq, inArray } from "drizzle-orm";
import { customers, flows, purchases, scheduledEmails } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import { decide } from "@/lib/engine/decide";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { FLOW_LABELS, type Action, type EngineEvent } from "@/lib/engine/types";
import { PRODUCT_LABELS } from "@/lib/events/types";
import { getSettings } from "@/lib/settings";
import { formatBr } from "@/lib/util/time";
import { addTimeline, type ProcessHandler } from "./ingest";
import { cancelScheduled, engineConfig, loadCustomerState, lockCustomer } from "./state";

/** Liga o motor puro ao banco: monta o estado, decide e aplica as ações. */
export const handleEvent: ProcessHandler = async ({ tx, eventId, event, productKey, customer, isTest, now }) => {
  const s = await getSettings(tx);
  const locked = await lockCustomer(tx, customer.id);
  const state = await loadCustomerState(tx, locked, s);
  const ev: EngineEvent = {
    type: event.type,
    productKey,
    occurredAt: new Date(event.occurredAt),
    transactionId: event.transactionId,
    amountCents: event.amount === null ? null : Math.round(event.amount * 100),
    currency: event.currency,
    declineReason: event.declineReason,
    recoveryUrl: event.recoveryUrl ?? null,
    eventKey: `ev:${eventId}:${event.transactionId ?? ""}:${event.occurredAt}`,
  };
  const decision = decide(state, ev, engineConfig(s), now);
  await applyActions(tx, { customerId: customer.id, eventId, isTest: isTest || locked.isTest, now, timezone: state.timezone }, decision.actions);
  if (decision.status === "ignored" && decision.reason) {
    await addTimeline(tx, customer.id, "decision", `Sem ação: ${decision.reason}`, now, { webhookEventId: eventId });
  }
  return { status: decision.status, reason: decision.reason };
};

type ApplyCtx = { customerId: number; eventId: number | null; isTest: boolean; now: Date; timezone: string };

export async function applyActions(tx: DbOrTx, ctx: ApplyCtx, actions: Action[]): Promise<void> {
  const { customerId, now } = ctx;
  for (const a of actions) {
    switch (a.type) {
      case "record_purchase": {
        await tx
          .insert(purchases)
          .values({
            transactionId: a.transactionId,
            customerId,
            productKey: a.productKey,
            amountCents: a.amountCents,
            currency: a.currency,
            status: "approved",
            purchasedAt: a.purchasedAt,
            attribution: a.attributedEmailId ? "email" : "direct",
            attributedEmailId: a.attributedEmailId,
            webhookEventId: ctx.eventId,
            isTest: ctx.isTest,
          })
          .onConflictDoNothing();
        let attr = "compra direta, sem e-mail";
        if (a.attributedEmailId) {
          const [e] = await tx.select({ t: scheduledEmails.templateKey }).from(scheduledEmails).where(eq(scheduledEmails.id, a.attributedEmailId));
          attr = `atribuída a ${e ? TEMPLATE_INFO[e.t as keyof typeof TEMPLATE_INFO]?.label ?? e.t : "e-mail"}`;
        }
        await addTimeline(tx, customerId, "purchase", `Compra: ${PRODUCT_LABELS[a.productKey]} (${attr})`, a.purchasedAt, {
          transactionId: a.transactionId,
          amountCents: a.amountCents,
          attributedEmailId: a.attributedEmailId,
        });
        break;
      }
      case "mark_purchase": {
        const where = a.transactionId
          ? eq(purchases.transactionId, a.transactionId)
          : and(eq(purchases.customerId, customerId), eq(purchases.productKey, a.productKey), eq(purchases.status, "approved"));
        await tx.update(purchases).set({ status: a.status, refundedAt: a.at }).where(where);
        break;
      }
      case "cancel_emails": {
        const n = await cancelScheduled(tx, a.emailIds, a.reason, now);
        if (n) await addTimeline(tx, customerId, "email_cancelled", `${n} e-mail(s) cancelado(s): ${a.reason}`, now, { emailIds: a.emailIds });
        break;
      }
      case "end_flow": {
        const r = await tx
          .update(flows)
          .set({ status: a.status, statusReason: a.reason, endedAt: now })
          .where(and(eq(flows.id, a.flowId), eq(flows.status, "active")))
          .returning({ type: flows.type });
        if (r[0]) {
          await addTimeline(
            tx,
            customerId,
            "flow",
            `${FLOW_LABELS[r[0].type as keyof typeof FLOW_LABELS]} ${a.status === "completed" ? "concluído" : "cancelado"}: ${a.reason}`,
            now,
            { flowId: a.flowId },
          );
        }
        break;
      }
      case "create_flow": {
        const [f] = await tx
          .insert(flows)
          .values({
            customerId,
            type: a.flowType,
            status: a.status,
            statusReason: a.statusReason,
            anchorAt: a.anchorAt,
            includesF3: a.includesF3,
            isControl: a.isControl,
            declineReason: a.declineReason,
            recoveryUrl: a.recoveryUrl,
            startedByEventId: ctx.eventId,
            isTest: ctx.isTest,
            endedAt: a.status === "active" ? null : now,
          })
          .returning();
        if (a.emails.length) {
          await tx.insert(scheduledEmails).values(
            a.emails.map((e) => ({
              flowId: f.id,
              customerId,
              templateKey: e.templateKey,
              offerKey: e.offerKey,
              stepOrder: e.stepOrder,
              scheduledFor: e.scheduledFor,
              originalScheduledFor: e.scheduledFor,
              status: e.status,
              statusReason: e.statusReason,
              isTest: ctx.isTest,
            })),
          );
        }
        const list = a.emails
          .map((e) => `${e.templateKey} ${e.status === "scheduled" ? formatBr(e.scheduledFor, ctx.timezone) : "(pulado: " + e.statusReason + ")"}`)
          .join("; ");
        await addTimeline(
          tx,
          customerId,
          "flow",
          `${FLOW_LABELS[a.flowType]} ${a.status === "active" ? "iniciado" : "registrado"}${a.statusReason ? ` (${a.statusReason})` : ""}${list ? ` — ${list}` : ""}`,
          now,
          { flowId: f.id },
        );
        break;
      }
      case "suppress": {
        await tx
          .update(customers)
          .set({ suppressed: true, suppressedReason: a.reason, suppressedAt: now, updatedAt: now })
          .where(eq(customers.id, customerId));
        await addTimeline(tx, customerId, "suppressed", `Cliente suprimido: ${a.reason}`, now);
        break;
      }
      case "timeline":
        await addTimeline(tx, customerId, a.kind, a.summary, now, a.metadata);
        break;
    }
  }
}

/** Fecha fluxos ativos que não têm mais e-mails pendentes. */
export async function completeFlowIfDone(tx: DbOrTx, flowId: number, now: Date): Promise<void> {
  const pending = await tx
    .select({ id: scheduledEmails.id })
    .from(scheduledEmails)
    .where(and(eq(scheduledEmails.flowId, flowId), inArray(scheduledEmails.status, ["scheduled", "sending"])))
    .limit(1);
  if (pending.length) return;
  const [f] = await tx.select().from(flows).where(eq(flows.id, flowId));
  if (!f || f.status !== "active") return;
  await applyActions(tx, { customerId: f.customerId, eventId: null, isTest: f.isTest, now, timezone: "UTC" }, [
    { type: "end_flow", flowId, status: "completed", reason: "fim da sequência" },
  ]);
}
