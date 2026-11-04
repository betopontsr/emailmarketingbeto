import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { renderEmail } from "@/emails/render";
import { customerEvents, customers, emailEvents, flows, purchases, scheduledEmails, webhookEvents } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { guard } from "@/lib/engine/guard";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import type { FlowStatus, FlowType, TemplateKey } from "@/lib/engine/types";
import type { OfferKey } from "@/lib/events/types";
import { buildContext } from "@/lib/email/context";
import type { Sender } from "@/lib/email/sender";
import { tagValue } from "@/lib/email/sender";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "@/lib/email/unsubscribe";
import { addTimeline } from "@/lib/pipeline/ingest";
import { completeFlowIfDone } from "@/lib/pipeline/handle";
import { processOnly } from "@/lib/pipeline/run";
import { engineConfig, loadCustomerState, lockCustomer } from "@/lib/pipeline/state";
import { getSettings, isDryRun, missingRequiredConfig, type Settings } from "@/lib/settings";
import { formatBr } from "@/lib/util/time";

export const MAX_ATTEMPTS = 3;
const BACKOFF_MIN = [1, 5, 15];
const STUCK_SENDING_MIN = 10;

export type DispatchSummary = {
  ranAt: string;
  paused: boolean;
  blocked: string | null;
  dryRun: boolean;
  recoveredEvents: number;
  claimed: number;
  results: Record<string, number>;
};

/** Pega os vencidos de forma atômica (scheduled → sending) com SKIP LOCKED. */
export async function claimDue(db: Db, now: Date, limit: number, onlyIds?: string[]): Promise<string[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: scheduledEmails.id })
      .from(scheduledEmails)
      .where(
        and(
          eq(scheduledEmails.status, "scheduled"),
          lte(scheduledEmails.scheduledFor, now),
          onlyIds ? inArray(scheduledEmails.id, onlyIds) : undefined,
        ),
      )
      .orderBy(asc(scheduledEmails.scheduledFor))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!due.length) return [];
    const ids = due.map((d) => d.id);
    await tx
      .update(scheduledEmails)
      .set({ status: "sending", lockedAt: now, updatedAt: now })
      .where(and(inArray(scheduledEmails.id, ids), eq(scheduledEmails.status, "scheduled")));
    return ids;
  });
}

type Prepared =
  | { kind: "done"; result: string }
  | {
      kind: "send";
      emailId: string;
      flowId: number;
      customerId: number;
      to: string;
      subject: string;
      html: string;
      text: string;
      templateKey: TemplateKey;
      offerKey: string | null;
      attempts: number;
      unsubUrl: string;
    };

/** Roda a guarda e renderiza, dentro de uma transação com o cliente travado. */
async function prepare(db: Db, emailId: string, s: Settings, now: Date, dryRunGlobal: boolean): Promise<Prepared> {
  return db.transaction(async (tx) => {
    const [email] = await tx.select().from(scheduledEmails).where(eq(scheduledEmails.id, emailId));
    if (!email || email.status !== "sending") return { kind: "done", result: "ignorado" };
    const customer = await lockCustomer(tx, email.customerId);
    const [flow] = await tx.select().from(flows).where(eq(flows.id, email.flowId));
    const state = await loadCustomerState(tx, customer, s);
    const templateKey = email.templateKey as TemplateKey;
    const dryRun = dryRunGlobal || customer.isTest;

    const g = guard({
      email: {
        id: email.id,
        flowId: email.flowId,
        flowType: flow.type as FlowType,
        templateKey,
        offerKey: (email.offerKey as OfferKey | null) ?? null,
        status: "sending",
        scheduledFor: email.scheduledFor,
        sentAt: null,
      },
      flowStatus: flow.status as FlowStatus,
      state,
      cfg: engineConfig(s),
      now,
      globalPause: s.globalPause,
      missingConfig: missingRequiredConfig(s),
      dryRun,
    });
    const label = TEMPLATE_INFO[templateKey].label;

    if (g.action === "hold") {
      await tx.update(scheduledEmails).set({ status: "scheduled", statusReason: g.reason, lockedAt: null, updatedAt: now }).where(eq(scheduledEmails.id, emailId));
      return { kind: "done", result: "segurado" };
    }
    if (g.action === "skip") {
      await tx.update(scheduledEmails).set({ status: g.status, statusReason: g.reason, lockedAt: null, updatedAt: now }).where(eq(scheduledEmails.id, emailId));
      await addTimeline(tx, customer.id, `email_${g.status}`, `${label}: ${g.status === "expired" ? "expirado" : g.status === "skipped" ? "pulado" : "cancelado"} (${g.reason})`, now, { emailId });
      await completeFlowIfDone(tx, flow.id, now);
      return { kind: "done", result: g.status };
    }
    if (g.action === "reschedule") {
      await tx
        .update(scheduledEmails)
        .set({ status: "scheduled", scheduledFor: g.to, statusReason: `adiado: ${g.reason}`, lockedAt: null, updatedAt: now })
        .where(eq(scheduledEmails.id, emailId));
      await addTimeline(tx, customer.id, "email_rescheduled", `${label}: adiado para ${formatBr(g.to, state.timezone)} (${g.reason}, horário do cliente)`, now, { emailId });
      return { kind: "done", result: "adiado" };
    }

    const { ctx, deadlineAt } = buildContext(s, customer, flow, now);
    const unsubUrl = unsubscribePageUrl(customer.id);
    const r = renderEmail(templateKey, ctx, { unsubscribeUrl: unsubUrl, postalAddress: s.postalAddress || "[endereço postal não configurado]" });
    const hasDeadline = ["upsell_4", "upsell_7", "rec_f3"].includes(templateKey);
    await tx
      .update(scheduledEmails)
      .set({ renderedSubject: r.subject, renderedHtml: r.html, renderedText: r.text, deadlineAt: hasDeadline ? deadlineAt : null, updatedAt: now })
      .where(eq(scheduledEmails.id, emailId));

    if (dryRun) {
      await markDelivered(tx, emailId, flow.id, templateKey, "dry_run", null, now);
      await addTimeline(tx, customer.id, "email_sent", `${label}: simulado (DRY_RUN${customer.isTest ? ", cliente de teste" : ""})`, now, { emailId });
      await completeFlowIfDone(tx, flow.id, now);
      return { kind: "done", result: "dry_run" };
    }
    return {
      kind: "send",
      emailId,
      flowId: flow.id,
      customerId: customer.id,
      to: customer.email,
      subject: r.subject,
      html: r.html,
      text: r.text,
      templateKey,
      offerKey: email.offerKey,
      attempts: email.attempts,
      unsubUrl: unsubscribeOneClickUrl(customer.id),
    };
  });
}

async function markDelivered(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  emailId: string,
  flowId: number,
  templateKey: TemplateKey,
  status: "sent" | "dry_run",
  resendId: string | null,
  now: Date,
) {
  await tx
    .update(scheduledEmails)
    .set({ status, statusReason: null, sentAt: now, resendId, lockedAt: null, updatedAt: now, attempts: sql`${scheduledEmails.attempts} + 1` })
    .where(eq(scheduledEmails.id, emailId));
  if (templateKey === "rec_f3") await tx.update(flows).set({ f3Sent: true }).where(eq(flows.id, flowId));
}

export async function processClaimed(db: Db, emailId: string, s: Settings, now: Date, dryRun: boolean, getSender: () => Sender): Promise<string> {
  const p = await prepare(db, emailId, s, now, dryRun);
  if (p.kind === "done") return p.result;

  const from = `${s.emailFromName} <${s.emailFromAddress}>`;
  let res;
  try {
    res = await getSender().send({
      from,
      to: p.to,
      replyTo: s.emailReplyTo || undefined,
      subject: p.subject,
      html: p.html,
      text: p.text,
      headers: { "List-Unsubscribe": `<${p.unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [
        { name: "scheduled_email_id", value: tagValue(p.emailId) },
        { name: "template", value: tagValue(p.templateKey) },
        { name: "offer", value: tagValue(p.offerKey ?? "none") },
      ],
      idempotencyKey: `scheduled-email/${p.emailId}`,
    });
  } catch (err) {
    res = { ok: false as const, transient: true, error: err instanceof Error ? err.message : String(err) };
  }

  return db.transaction(async (tx) => {
    const label = TEMPLATE_INFO[p.templateKey].label;
    if (res.ok) {
      await markDelivered(tx, p.emailId, p.flowId, p.templateKey, "sent", res.id, now);
      await addTimeline(tx, p.customerId, "email_sent", `${label}: enviado`, now, { emailId: p.emailId, resendId: res.id });
      await completeFlowIfDone(tx, p.flowId, now);
      return "sent";
    }
    const attempts = p.attempts + 1;
    if (res.transient && attempts < MAX_ATTEMPTS) {
      const retryAt = new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000);
      await tx
        .update(scheduledEmails)
        .set({ status: "scheduled", scheduledFor: retryAt, attempts, lastError: res.error, statusReason: `nova tentativa (${attempts}/${MAX_ATTEMPTS})`, lockedAt: null, updatedAt: now })
        .where(eq(scheduledEmails.id, p.emailId));
      return "retry";
    }
    await tx
      .update(scheduledEmails)
      .set({ status: "failed", attempts, lastError: res.error, statusReason: res.error.slice(0, 300), lockedAt: null, updatedAt: now })
      .where(eq(scheduledEmails.id, p.emailId));
    await addTimeline(tx, p.customerId, "email_failed", `${label}: falhou (${res.error.slice(0, 200)})`, now, { emailId: p.emailId });
    await completeFlowIfDone(tx, p.flowId, now);
    return "failed";
  });
}

export async function runDispatch(
  db: Db,
  opts: { now?: Date; limit?: number; getSender: () => Sender; onlyIds?: string[] },
): Promise<DispatchSummary> {
  const now = opts.now ?? new Date();
  const s = await getSettings(db);
  const dryRun = isDryRun(s);
  const summary: DispatchSummary = { ranAt: now.toISOString(), paused: s.globalPause, blocked: null, dryRun, recoveredEvents: 0, claimed: 0, results: {} };

  // Eventos de webhook que ficaram parados em "recebido"
  const stuck = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.status, "received"), eq(webhookEvents.isDuplicate, false), lt(webhookEvents.receivedAt, new Date(now.getTime() - 2 * 60_000))))
    .limit(25);
  for (const e of stuck) await processOnly(db, e.id, now);
  summary.recoveredEvents = stuck.length;

  if (s.globalPause) return summary;
  const missing = missingRequiredConfig(s);
  if (!dryRun && missing.length) {
    summary.blocked = `configuração incompleta: ${missing.join(", ")}`;
    return summary;
  }

  // "sending" travado (instância caiu no meio): volta para a fila. A chave de idempotência evita envio duplo.
  await db
    .update(scheduledEmails)
    .set({ status: "scheduled", statusReason: "retomado após travamento", lockedAt: null, updatedAt: now })
    .where(and(eq(scheduledEmails.status, "sending"), lt(scheduledEmails.lockedAt, new Date(now.getTime() - STUCK_SENDING_MIN * 60_000))));

  const ids = await claimDue(db, now, opts.limit ?? 50, opts.onlyIds);
  summary.claimed = ids.length;
  for (const id of ids) {
    let r: string;
    try {
      r = await processClaimed(db, id, s, now, dryRun, opts.getSender);
    } catch (err) {
      r = "erro";
      await db
        .update(scheduledEmails)
        .set({ status: "scheduled", lastError: err instanceof Error ? err.message : String(err), lockedAt: null, updatedAt: now })
        .where(and(eq(scheduledEmails.id, id), eq(scheduledEmails.status, "sending")));
    }
    summary.results[r] = (summary.results[r] ?? 0) + 1;
  }
  return summary;
}

/**
 * Simulador: "viaja no tempo" com um cliente de teste. Desloca para trás TODA a história dele
 * (fluxos, e-mails, compras, linha do tempo) até o próximo e-mail pendente vencer agora.
 * Assim as regras (1 por dia, prazos, 30 dias) continuam valendo como na vida real.
 * Devolve os ids dos e-mails que ficaram vencidos.
 */
export async function advanceTestCustomer(db: Db, customerId: number, now: Date): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(customers).where(eq(customers.id, customerId)).for("update");
    if (!c || !c.isTest) throw new Error("só funciona para clientes de teste");
    const pending = await tx
      .select({ id: scheduledEmails.id, at: scheduledEmails.scheduledFor })
      .from(scheduledEmails)
      .where(and(eq(scheduledEmails.customerId, customerId), eq(scheduledEmails.status, "scheduled")))
      .orderBy(asc(scheduledEmails.scheduledFor));
    if (!pending.length) return [];
    const delta = pending[0].at.getTime() - now.getTime();
    if (delta > 0) {
      const shift = (col: unknown) => sql`${col} - (${delta} * interval '1 millisecond')`;
      await tx
        .update(scheduledEmails)
        .set({ scheduledFor: shift(scheduledEmails.scheduledFor), originalScheduledFor: shift(scheduledEmails.originalScheduledFor), sentAt: shift(scheduledEmails.sentAt) })
        .where(eq(scheduledEmails.customerId, customerId));
      await tx
        .update(flows)
        .set({ anchorAt: shift(flows.anchorAt), createdAt: shift(flows.createdAt), endedAt: shift(flows.endedAt) })
        .where(eq(flows.customerId, customerId));
      await tx.update(purchases).set({ purchasedAt: shift(purchases.purchasedAt), refundedAt: shift(purchases.refundedAt) }).where(eq(purchases.customerId, customerId));
      await tx.update(customerEvents).set({ occurredAt: shift(customerEvents.occurredAt) }).where(eq(customerEvents.customerId, customerId));
      await tx.update(emailEvents).set({ occurredAt: shift(emailEvents.occurredAt) }).where(eq(emailEvents.customerId, customerId));
      await addTimeline(tx, customerId, "simulator", `Simulador: relógio do cliente adiantado ${Math.round(delta / 60_000)} min`, now);
    }
    const due = await tx
      .select({ id: scheduledEmails.id })
      .from(scheduledEmails)
      .where(and(eq(scheduledEmails.customerId, customerId), eq(scheduledEmails.status, "scheduled"), lte(scheduledEmails.scheduledFor, now)));
    return due.map((d) => d.id);
  });
}
