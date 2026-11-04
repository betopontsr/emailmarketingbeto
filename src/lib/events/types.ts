import { z } from "zod";

export const PRODUCT_KEYS = ["main", "nathan", "knots", "reclaim"] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];
export const OFFER_KEYS = ["nathan", "knots", "reclaim"] as const;
export type OfferKey = (typeof OFFER_KEYS)[number];

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  main: "The 11:22 Abundance Sequence",
  nathan: "Acompanhamento do Nathan",
  knots: "The Five Knots of the Body",
  reclaim: "Reclaim Your Peace of Mind",
};
export const PRODUCT_SHORT: Record<ProductKey, string> = {
  main: "Principal",
  nathan: "Nathan",
  knots: "Knots",
  reclaim: "Reclaim",
};

export const EVENT_TYPES = [
  "purchase_approved",
  "checkout_abandoned",
  "payment_declined",
  "refunded",
  "chargeback",
  "purchase_pending",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  purchase_approved: "Compra aprovada",
  checkout_abandoned: "Checkout abandonado",
  payment_declined: "Pagamento recusado",
  refunded: "Reembolso",
  chargeback: "Chargeback",
  purchase_pending: "Aguardando pagamento",
  other: "Outro",
};

const nullableStr = z.string().trim().min(1).nullable().catch(null);

/** Evento normalizado: o resto do app só conhece este formato. */
export const normalizedEventSchema = z.object({
  providerEventId: nullableStr,
  type: z.enum(EVENT_TYPES),
  occurredAt: z.string().datetime({ offset: true }),
  customer: z.object({
    email: z.string().trim().toLowerCase().email(),
    fullName: nullableStr,
    firstName: nullableStr,
    country: nullableStr,
    region: nullableStr,
    phone: nullableStr,
    timezone: nullableStr.optional().default(null),
  }),
  product: z.object({
    code: nullableStr,
    planCode: nullableStr,
    offerCode: nullableStr,
    name: nullableStr,
  }),
  transactionId: nullableStr,
  amount: z.number().nullable().catch(null),
  currency: nullableStr,
  rawStatus: nullableStr,
  declineReason: z.enum(["insufficient_funds"]).nullable().or(z.string().nullable()).catch(null),
  recoveryUrl: z.string().url().nullable().catch(null).optional().default(null),
});

export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;
