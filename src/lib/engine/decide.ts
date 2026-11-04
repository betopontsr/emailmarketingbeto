/**
 * Motor de decisão: função pura. Recebe o estado do cliente e um evento,
 * devolve o que deve acontecer (agendar, cancelar, suprimir...). Sem banco, sem HTTP.
 */
import { OFFER_KEYS, PRODUCT_LABELS, type OfferKey } from "@/lib/events/types";
import { stableBucket } from "@/lib/util/crypto";
import { localDay, placeRecovery, upsellTime } from "./schedule";
import { UPSELL_STEPS, recoverySteps } from "./steps";
import {
  DELIVERED_STATUSES,
  type Action,
  type CustomerState,
  type Decision,
  type EmailSnap,
  type EngineConfig,
  type EngineEvent,
  type FlowSnap,
  type PlannedEmail,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
export const REENTRY_DAYS = 30;
export const ATTRIBUTION_DAYS = 7;

const isDelivered = (e: EmailSnap) => DELIVERED_STATUSES.includes(e.status);
const isScheduled = (e: EmailSnap) => e.status === "scheduled";
const isRecoveryFlow = (f: FlowSnap) => f.type !== "upsell";

export function hasApprovedMain(s: CustomerState): boolean {
  return s.purchases.some((p) => p.productKey === "main" && p.status === "approved");
}

export function purchasedOffers(s: CustomerState): Set<OfferKey> {
  const set = new Set<OfferKey>();
  for (const p of s.purchases) {
    if (p.status === "approved" && (OFFER_KEYS as readonly string[]).includes(p.productKey)) set.add(p.productKey as OfferKey);
  }
  return set;
}

export function everReceivedF3(s: CustomerState): boolean {
  return s.emails.some((e) => e.templateKey === "rec_f3" && isDelivered(e));
}

/** Momento da última atividade de um fluxo de recuperação (início ou fim, o que for mais tarde). */
function lastRecoveryActivity(s: CustomerState, excludeFlowId?: number): Date | null {
  let last: Date | null = null;
  for (const f of s.flows) {
    if (!isRecoveryFlow(f) || f.id === excludeFlowId) continue;
    const t = new Date(Math.max(f.createdAt.getTime(), f.anchorAt.getTime(), f.endedAt?.getTime() ?? 0));
    if (!last || t > last) last = t;
  }
  return last;
}

/** Condições comuns para iniciar um fluxo de recuperação. Devolve o motivo de NÃO iniciar, ou null. */
function recoveryBlocker(s: CustomerState, now: Date, replacingFlowId?: number): string | null {
  if (hasApprovedMain(s)) return "cliente já tem compra aprovada do produto principal";
  if (s.suppressed) return `cliente suprimido (${s.suppressedReason ?? "sem motivo"})`;
  const active = s.flows.find((f) => isRecoveryFlow(f) && f.status === "active" && f.id !== replacingFlowId);
  if (active) return "já existe um fluxo de recuperação ativo";
  const last = lastRecoveryActivity(s, replacingFlowId);
  if (last && now.getTime() - last.getTime() < REENTRY_DAYS * DAY) {
    return `último fluxo de recuperação há menos de ${REENTRY_DAYS} dias`;
  }
  return null;
}

export function planRecoveryEmails(
  flowType: "recovery_a" | "recovery_b",
  anchor: Date,
  s: CustomerState,
  cfg: EngineConfig,
  declineReason: string | null,
  includesF3: boolean,
): PlannedEmail[] {
  const taken = new Set<string>();
  for (const e of s.emails) {
    if (e.flowType !== "upsell" && isDelivered(e) && e.sentAt) taken.add(localDay(e.sentAt, s.timezone));
  }
  const out: PlannedEmail[] = [];
  let prev = 0;
  recoverySteps(flowType, declineReason).forEach((step, i) => {
    if (step.key === "rec_f3" && !includesF3) return;
    let target = new Date(anchor.getTime() + step.minutes * 60_000);
    if (target.getTime() <= prev) target = new Date(prev + 60_000);
    const at = placeRecovery(target, s.timezone, cfg, taken);
    taken.add(localDay(at, s.timezone));
    prev = at.getTime();
    out.push({ templateKey: step.key, offerKey: null, stepOrder: i + 1, scheduledFor: at, status: "scheduled", statusReason: null });
  });
  return out;
}

export function planUpsellEmails(anchor: Date, s: CustomerState, cfg: EngineConfig, bought: Set<OfferKey>): PlannedEmail[] {
  return UPSELL_STEPS.map((step, i) => ({
    templateKey: step.key,
    offerKey: step.offer,
    stepOrder: i + 1,
    scheduledFor: upsellTime(anchor, step.day, cfg.upsellHour, s.timezone),
    status: bought.has(step.offer) ? ("skipped" as const) : ("scheduled" as const),
    statusReason: bought.has(step.offer) ? "já comprou a oferta" : null,
  }));
}

/** Último e-mail entregue que satisfaz o filtro, até o momento da compra. */
function lastDelivered(s: CustomerState, filter: (e: EmailSnap) => boolean, before: Date, notBefore?: Date): EmailSnap | null {
  let best: EmailSnap | null = null;
  for (const e of s.emails) {
    if (!isDelivered(e) || !e.sentAt || !filter(e)) continue;
    if (e.sentAt > before) continue;
    if (notBefore && e.sentAt < notBefore) continue;
    if (!best || e.sentAt > best.sentAt!) best = e;
  }
  return best;
}

/** Fluxos que ficam sem nenhum e-mail pendente depois de cancelar `cancelled` terminam como completos. */
function completeEmptiedFlows(s: CustomerState, cancelled: Set<string>, skipFlowIds: Set<number>, reason: string): Action[] {
  const out: Action[] = [];
  for (const f of s.flows) {
    if (f.status !== "active" || skipFlowIds.has(f.id)) continue;
    const pending = s.emails.filter((e) => e.flowId === f.id && (e.status === "scheduled" || e.status === "sending") && !cancelled.has(e.id));
    if (pending.length === 0) out.push({ type: "end_flow", flowId: f.id, status: "completed", reason });
  }
  return out;
}

export function decide(s: CustomerState, ev: EngineEvent, cfg: EngineConfig, now: Date): Decision {
  const actions: Action[] = [];
  const product = PRODUCT_LABELS[ev.productKey];

  switch (ev.type) {
    case "purchase_approved": {
      const txId = ev.transactionId ?? ev.eventKey;
      if (s.purchases.some((p) => p.transactionId === txId)) {
        return { status: "ignored", reason: "compra já registrada (mesma transação)", actions };
      }
      const at = ev.occurredAt;

      if (ev.productKey === "main") {
        const attributed = lastDelivered(s, (e) => e.flowType !== "upsell", at, new Date(at.getTime() - ATTRIBUTION_DAYS * DAY));
        actions.push({
          type: "record_purchase",
          productKey: "main",
          transactionId: txId,
          amountCents: ev.amountCents,
          currency: ev.currency,
          purchasedAt: at,
          attributedEmailId: attributed?.id ?? null,
        });
        const pendingRecovery = s.emails.filter((e) => e.flowType !== "upsell" && isScheduled(e));
        if (pendingRecovery.length) actions.push({ type: "cancel_emails", emailIds: pendingRecovery.map((e) => e.id), reason: "comprou" });
        for (const f of s.flows.filter((f) => isRecoveryFlow(f) && f.status === "active")) {
          actions.push({ type: "end_flow", flowId: f.id, status: "cancelled", reason: "comprou" });
        }

        const hasUpsell = s.flows.some((f) => f.type === "upsell");
        if (hasUpsell) {
          actions.push({ type: "timeline", kind: "flow", summary: "Nova compra do principal: o fluxo de upsell não é reiniciado" });
          return { status: "processed", reason: "compra registrada; fluxo de upsell já existia", actions };
        }
        if (s.suppressed) {
          actions.push({ type: "timeline", kind: "flow", summary: "Cliente suprimido: fluxo de upsell não criado" });
          return { status: "processed", reason: "compra registrada; cliente suprimido, sem upsell", actions };
        }
        const bought = purchasedOffers(s);
        const emails = planUpsellEmails(at, s, cfg, bought);
        const allBought = OFFER_KEYS.every((o) => bought.has(o));
        actions.push({
          type: "create_flow",
          flowType: "upsell",
          anchorAt: at,
          includesF3: false,
          isControl: false,
          declineReason: null,
          recoveryUrl: null,
          status: allBought ? "completed" : "active",
          statusReason: allBought ? "já comprou as 3 ofertas" : null,
          emails,
        });
        return {
          status: "processed",
          reason: attributed ? "compra registrada (atribuída a e-mail de recuperação); upsell iniciado" : "compra registrada; upsell iniciado",
          actions,
        };
      }

      // Oferta de upsell
      const offer = ev.productKey as OfferKey;
      const attributed = lastDelivered(s, (e) => e.offerKey === offer, at);
      actions.push({
        type: "record_purchase",
        productKey: offer,
        transactionId: txId,
        amountCents: ev.amountCents,
        currency: ev.currency,
        purchasedAt: at,
        attributedEmailId: attributed?.id ?? null,
      });
      const pendingOffer = s.emails.filter((e) => e.offerKey === offer && isScheduled(e));
      const cancelled = new Set(pendingOffer.map((e) => e.id));
      if (pendingOffer.length) actions.push({ type: "cancel_emails", emailIds: [...cancelled], reason: "comprou a oferta" });

      const upsell = s.flows.find((f) => f.type === "upsell" && f.status === "active");
      if (upsell) {
        const bought = purchasedOffers(s);
        bought.add(offer);
        if (OFFER_KEYS.every((o) => bought.has(o))) {
          actions.push({ type: "end_flow", flowId: upsell.id, status: "completed", reason: "comprou as 3 ofertas" });
        } else {
          actions.push(...completeEmptiedFlows({ ...s, flows: [upsell] }, cancelled, new Set(), "fim da sequência"));
        }
      }
      return {
        status: "processed",
        reason: attributed ? `compra de ${product} atribuída a e-mail` : `compra direta de ${product} (sem e-mail)`,
        actions,
      };
    }

    case "checkout_abandoned": {
      if (ev.productKey !== "main") return { status: "ignored", reason: `abandono de ${product}: só registrado`, actions };
      const blocker = recoveryBlocker(s, now);
      if (blocker) return { status: "ignored", reason: `Fluxo A não iniciado: ${blocker}`, actions };
      actions.push(createRecovery("recovery_a", s, ev, cfg));
      return { status: "processed", reason: describeCreated(actions), actions };
    }

    case "payment_declined": {
      if (ev.productKey !== "main") return { status: "ignored", reason: `recusa de ${product}: só registrada`, actions };
      const activeB = s.flows.find((f) => f.type === "recovery_b" && f.status === "active");
      if (activeB) return { status: "ignored", reason: "Fluxo B já está ativo: não reinicia", actions };
      const activeA = s.flows.find((f) => f.type === "recovery_a" && f.status === "active");
      const blocker = recoveryBlocker(s, now, activeA?.id);
      if (blocker) return { status: "ignored", reason: `Fluxo B não iniciado: ${blocker}`, actions };
      let state = s;
      if (activeA) {
        const pendingA = s.emails.filter((e) => e.flowId === activeA.id && isScheduled(e));
        if (pendingA.length) actions.push({ type: "cancel_emails", emailIds: pendingA.map((e) => e.id), reason: "substituído pelo Fluxo B (cartão recusado)" });
        actions.push({ type: "end_flow", flowId: activeA.id, status: "cancelled", reason: "substituído pelo Fluxo B (cartão recusado)" });
        state = { ...s, emails: s.emails.filter((e) => !pendingA.includes(e)) };
      }
      actions.push(createRecovery("recovery_b", state, ev, cfg));
      return { status: "processed", reason: describeCreated(actions), actions };
    }

    case "refunded":
    case "chargeback": {
      const label = ev.type === "refunded" ? "reembolso" : "chargeback";
      actions.push({ type: "mark_purchase", transactionId: ev.transactionId, productKey: ev.productKey, status: ev.type === "refunded" ? "refunded" : "chargeback", at: ev.occurredAt });
      actions.push({ type: "suppress", reason: `${label} (${product})` });
      const pending = s.emails.filter(isScheduled);
      if (pending.length) actions.push({ type: "cancel_emails", emailIds: pending.map((e) => e.id), reason: `${label}: cliente removido de tudo` });
      for (const f of s.flows.filter((f) => f.status === "active")) {
        actions.push({ type: "end_flow", flowId: f.id, status: "cancelled", reason: label });
      }
      return { status: "processed", reason: `${label}: cliente suprimido`, actions };
    }

    case "purchase_pending":
      return { status: "ignored", reason: "aguardando pagamento: só registrado", actions };
    default:
      return { status: "ignored", reason: "evento sem ação: só registrado", actions };
  }
}

function createRecovery(flowType: "recovery_a" | "recovery_b", s: CustomerState, ev: EngineEvent, cfg: EngineConfig): Action {
  const isControl = cfg.controlPercent > 0 && stableBucket(`control:${ev.eventKey}`) < cfg.controlPercent;
  const includesF3 = !everReceivedF3(s);
  const declineReason = flowType === "recovery_b" ? ev.declineReason : null;
  return {
    type: "create_flow",
    flowType,
    anchorAt: ev.occurredAt,
    includesF3,
    isControl,
    declineReason,
    recoveryUrl: ev.recoveryUrl,
    status: isControl ? "completed" : "active",
    statusReason: isControl ? "grupo de controle (sem e-mails)" : null,
    emails: isControl ? [] : planRecoveryEmails(flowType, ev.occurredAt, s, cfg, declineReason, includesF3),
  };
}

function describeCreated(actions: Action[]): string {
  const c = actions.find((a) => a.type === "create_flow");
  if (!c || c.type !== "create_flow") return "processado";
  const name = c.flowType === "recovery_a" ? "Fluxo A" : "Fluxo B";
  if (c.isControl) return `${name}: grupo de controle (sem e-mails)`;
  return `${name} iniciado${c.includesF3 ? "" : " (sem F3: já recebeu antes)"}`;
}
