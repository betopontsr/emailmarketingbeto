import type { EventType, OfferKey, ProductKey } from "@/lib/events/types";

export const TEMPLATE_KEYS = [
  "upsell_1",
  "upsell_2",
  "upsell_3",
  "upsell_4",
  "upsell_5",
  "upsell_6",
  "upsell_7",
  "rec_a1",
  "rec_a2",
  "rec_b1",
  "rec_b2",
  "rec_f3",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type FlowType = "upsell" | "recovery_a" | "recovery_b";
export type FlowStatus = "active" | "completed" | "cancelled";
export type EmailStatus = "scheduled" | "sending" | "sent" | "dry_run" | "skipped" | "cancelled" | "failed" | "expired";

export const FLOW_LABELS: Record<FlowType, string> = {
  upsell: "Upsell",
  recovery_a: "Recuperação A (abandono)",
  recovery_b: "Recuperação B (cartão recusado)",
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  scheduled: "agendado",
  sending: "enviando",
  sent: "enviado",
  dry_run: "simulado",
  skipped: "pulado",
  cancelled: "cancelado",
  failed: "falhou",
  expired: "expirado",
};

/** Estados que contam como "o cliente recebeu" (simulação conta, para o simulador funcionar igual). */
export const DELIVERED_STATUSES: EmailStatus[] = ["sent", "dry_run"];
export const PENDING_STATUSES: EmailStatus[] = ["scheduled", "sending"];

export type EmailSnap = {
  id: string;
  flowId: number;
  flowType: FlowType;
  templateKey: TemplateKey;
  offerKey: OfferKey | null;
  status: EmailStatus;
  scheduledFor: Date;
  sentAt: Date | null;
};

export type FlowSnap = {
  id: number;
  type: FlowType;
  status: FlowStatus;
  anchorAt: Date;
  createdAt: Date;
  endedAt: Date | null;
  includesF3: boolean;
  isControl: boolean;
};

export type PurchaseSnap = {
  transactionId: string;
  productKey: ProductKey;
  status: "approved" | "refunded" | "chargeback";
  purchasedAt: Date;
};

export type CustomerState = {
  customerId: number;
  suppressed: boolean;
  suppressedReason: string | null;
  /** Fuso já resolvido (do cliente ou o padrão). */
  timezone: string;
  flows: FlowSnap[];
  emails: EmailSnap[];
  purchases: PurchaseSnap[];
};

export type EngineConfig = {
  upsellHour: number;
  quietStartHour: number;
  quietEndHour: number;
  quietResumeHour: number;
  controlPercent: number;
  maxLatenessHours: number;
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  upsellHour: 10,
  quietStartHour: 22,
  quietEndHour: 7,
  quietResumeHour: 8,
  controlPercent: 0,
  maxLatenessHours: 12,
};

export type EngineEvent = {
  type: EventType;
  productKey: ProductKey;
  occurredAt: Date;
  transactionId: string | null;
  amountCents: number | null;
  currency: string | null;
  declineReason: string | null;
  recoveryUrl: string | null;
  /** Chave estável do evento (usada no grupo de controle). */
  eventKey: string;
};

export type PlannedEmail = {
  templateKey: TemplateKey;
  offerKey: OfferKey | null;
  stepOrder: number;
  scheduledFor: Date;
  /** Já nasce pulado (ex.: oferta comprada antes do fluxo existir). */
  status: "scheduled" | "skipped";
  statusReason: string | null;
};

export type Action =
  | {
      type: "record_purchase";
      productKey: ProductKey;
      transactionId: string;
      amountCents: number | null;
      currency: string | null;
      purchasedAt: Date;
      attributedEmailId: string | null;
    }
  | { type: "mark_purchase"; transactionId: string | null; productKey: ProductKey; status: "refunded" | "chargeback"; at: Date }
  | { type: "cancel_emails"; emailIds: string[]; reason: string }
  | { type: "end_flow"; flowId: number; status: "completed" | "cancelled"; reason: string }
  | {
      type: "create_flow";
      flowType: FlowType;
      anchorAt: Date;
      includesF3: boolean;
      isControl: boolean;
      declineReason: string | null;
      recoveryUrl: string | null;
      status: "active" | "completed";
      statusReason: string | null;
      emails: PlannedEmail[];
    }
  | { type: "suppress"; reason: string }
  | { type: "timeline"; kind: string; summary: string; metadata?: Record<string, unknown> };

export type Decision = {
  status: "processed" | "ignored";
  reason: string | null;
  actions: Action[];
};
