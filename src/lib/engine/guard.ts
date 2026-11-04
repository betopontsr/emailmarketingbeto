/**
 * Guarda de envio (seção 7): roda imediatamente antes de CADA e-mail.
 * Função pura: recebe o estado atual e devolve se envia, pula, cancela, expira ou adia.
 */
import { everReceivedF3, hasApprovedMain, purchasedOffers } from "./decide";
import { isQuietHour, adjustForQuiet, localDay, nextDayResume } from "./schedule";
import { isRecoveryTemplate } from "./steps";
import { DELIVERED_STATUSES, type CustomerState, type EmailSnap, type EngineConfig, type FlowStatus } from "./types";

export type GuardInput = {
  email: EmailSnap & { id: string };
  flowStatus: FlowStatus;
  state: CustomerState;
  cfg: EngineConfig;
  now: Date;
  globalPause: boolean;
  missingConfig: string[];
  dryRun: boolean;
};

export type GuardResult =
  | { action: "send" }
  | { action: "hold"; reason: string }
  | { action: "skip"; status: "skipped" | "cancelled" | "expired"; reason: string }
  | { action: "reschedule"; to: Date; reason: string };

export function guard(i: GuardInput): GuardResult {
  const { email, state, cfg, now } = i;

  // 1. Pausa global e configuração obrigatória
  if (i.globalPause) return { action: "hold", reason: "pausa global ligada" };
  if (i.missingConfig.length && !i.dryRun) return { action: "hold", reason: `configuração incompleta: ${i.missingConfig.join(", ")}` };

  // 2. Cliente suprimido
  if (state.suppressed) return { action: "skip", status: "cancelled", reason: `cliente suprimido (${state.suppressedReason ?? "sem motivo"})` };

  // 3. Fluxo ativo
  if (i.flowStatus !== "active") return { action: "skip", status: "cancelled", reason: `fluxo não está ativo (${i.flowStatus})` };

  const recovery = isRecoveryTemplate(email.templateKey);

  // 4. Recuperação: nunca para quem já comprou o principal
  if (recovery && hasApprovedMain(state)) return { action: "skip", status: "cancelled", reason: "já comprou o produto principal" };

  // 5. Upsell: só para quem não comprou a oferta
  if (!recovery && email.offerKey && purchasedOffers(state).has(email.offerKey)) {
    return { action: "skip", status: "skipped", reason: "já comprou a oferta" };
  }
  if (email.templateKey === "rec_f3" && everReceivedF3({ ...state, emails: state.emails.filter((e) => e.id !== email.id) })) {
    return { action: "skip", status: "skipped", reason: "já recebeu o F3 antes" };
  }

  // 7. Atraso (checado antes da janela: um e-mail muito atrasado não deve ser só adiado)
  const lateMs = now.getTime() - email.scheduledFor.getTime();
  if (lateMs > cfg.maxLatenessHours * 3600_000) {
    return { action: "skip", status: "expired", reason: `atrasado ${Math.round(lateMs / 3600_000)}h (limite ${cfg.maxLatenessHours}h)` };
  }

  // 6. Recuperação: janela de silêncio e 1 por dia
  if (recovery) {
    if (isQuietHour(now, state.timezone, cfg)) {
      return { action: "reschedule", to: adjustForQuiet(now, state.timezone, cfg), reason: "janela de silêncio (22h–7h)" };
    }
    const today = localDay(now, state.timezone);
    const sentToday = state.emails.some(
      (e) => e.id !== email.id && e.flowType !== "upsell" && DELIVERED_STATUSES.includes(e.status) && e.sentAt && localDay(e.sentAt, state.timezone) === today,
    );
    if (sentToday) {
      return { action: "reschedule", to: nextDayResume(now, state.timezone, cfg), reason: "limite de 1 e-mail de recuperação por dia" };
    }
  }

  return { action: "send" };
}
