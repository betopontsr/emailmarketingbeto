import type { OfferKey } from "@/lib/events/types";
import type { FlowType, TemplateKey } from "./types";

export type UpsellStep = { key: TemplateKey; day: number; offer: OfferKey; label: string };

/** Seção 5 do prompt / anexo “Upsells”. */
export const UPSELL_STEPS: UpsellStep[] = [
  { key: "upsell_1", day: 1, offer: "nathan", label: "Nathan · reabertura · $67" },
  { key: "upsell_2", day: 3, offer: "knots", label: "Knots · reabertura · $47" },
  { key: "upsell_3", day: 5, offer: "reclaim", label: "Reclaim · reabertura · $97" },
  { key: "upsell_4", day: 7, offer: "nathan", label: "Nathan · final 48h · $47" },
  { key: "upsell_5", day: 9, offer: "knots", label: "Knots · final meia-noite · $19" },
  { key: "upsell_6", day: 11, offer: "reclaim", label: "Reclaim · segundo toque · $97" },
  { key: "upsell_7", day: 13, offer: "reclaim", label: "Reclaim · final 48h · $47" },
];

export type RecoveryStep = { key: TemplateKey; minutes: number; label: string };

const H = 60;

/** Seção 6 do prompt / anexo “Recuperação”. */
export function recoverySteps(flow: Exclude<FlowType, "upsell">, declineReason: string | null): RecoveryStep[] {
  if (flow === "recovery_a") {
    return [
      { key: "rec_a1", minutes: 30, label: "A1 · 30 min" },
      { key: "rec_a2", minutes: 24 * H, label: "A2 · 24 h" },
      { key: "rec_f3", minutes: 72 * H, label: "F3 · 72 h" },
    ];
  }
  return [
    { key: "rec_b1", minutes: 10, label: "B1 · 10 min" },
    {
      key: "rec_b2",
      minutes: (declineReason === "insufficient_funds" ? 48 : 24) * H,
      label: declineReason === "insufficient_funds" ? "B2 · 48 h (saldo)" : "B2 · 24 h",
    },
    { key: "rec_f3", minutes: 72 * H, label: "F3 · 72 h" },
  ];
}

export const TEMPLATE_INFO: Record<TemplateKey, { flow: "upsell" | "recovery"; offer: OfferKey | null; label: string }> = {
  upsell_1: { flow: "upsell", offer: "nathan", label: "Upsell 1 · D+1 · Nathan $67" },
  upsell_2: { flow: "upsell", offer: "knots", label: "Upsell 2 · D+3 · Knots $47" },
  upsell_3: { flow: "upsell", offer: "reclaim", label: "Upsell 3 · D+5 · Reclaim $97" },
  upsell_4: { flow: "upsell", offer: "nathan", label: "Upsell 4 · D+7 · Nathan $47 (48h)" },
  upsell_5: { flow: "upsell", offer: "knots", label: "Upsell 5 · D+9 · Knots $19 (meia-noite)" },
  upsell_6: { flow: "upsell", offer: "reclaim", label: "Upsell 6 · D+11 · Reclaim $97" },
  upsell_7: { flow: "upsell", offer: "reclaim", label: "Upsell 7 · D+13 · Reclaim $47 (48h)" },
  rec_a1: { flow: "recovery", offer: null, label: "Rec A1 · 30 min" },
  rec_a2: { flow: "recovery", offer: null, label: "Rec A2 · 24 h" },
  rec_b1: { flow: "recovery", offer: null, label: "Rec B1 · 10 min" },
  rec_b2: { flow: "recovery", offer: null, label: "Rec B2 · 24 h / 48 h" },
  rec_f3: { flow: "recovery", offer: null, label: "Rec F3 · 72 h · $27" },
};

export const isRecoveryTemplate = (k: TemplateKey) => TEMPLATE_INFO[k].flow === "recovery";
