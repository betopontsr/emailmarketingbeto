/**
 * Adaptador da Perfect Pay: converte o payload bruto num NormalizedEvent.
 *
 * Campos CONFIRMADOS com payload real de compra aprovada (05/11/2026, tests/fixtures/perfectpay/real-aprovada-main.json):
 * code, sale_status_enum (2) / sale_status_enum_key ("approved"), sale_status_detail, date_approved,
 * date_created ("2026-11-04 23:04:27", sem fuso), sale_amount, currency_enum_key ("USD"),
 * product.code (PPPB...), product.name, plan.code (PPLQ...), customer.email, customer.full_name,
 * customer.country, customer.state, customer.phone_formated_ddi, token.
 * Ainda HIPÓTESE (falta payload real): os outros números de status (abandono, recusa, reembolso,
 * chargeback) e o texto do motivo da recusa.
 * Quando você colar payloads reais, ajuste SÓ este arquivo e os fixtures em
 * tests/fixtures/perfectpay/.
 *
 * Regra de segurança: se o evento não for reconhecido com certeza, devolvemos
 * { ok: false } e nada é disparado.
 */
import { DateTime } from "luxon";
import { normalizedEventSchema, type EventType, type NormalizedEvent } from "@/lib/events/types";
import { sha256 } from "@/lib/util/crypto";
import { zoneFromLocation } from "@/lib/util/zones";

export type AdaptResult =
  | { ok: true; event: NormalizedEvent; dedupeKey: string }
  | { ok: false; reason: string; dedupeKey: string };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Lê o primeiro caminho existente, ex.: pick(raw, "customer.email", "email"). */
function pick(raw: Obj, ...paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = raw;
    for (const part of p.split(".")) {
      if (!isObj(cur)) {
        cur = undefined;
        break;
      }
      cur = cur[part];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

/**
 * Status numérico da Perfect Pay (hipótese, a confirmar):
 * 1 pendente, 2 aprovado, 3 em processamento, 4 em mediação, 5 rejeitado,
 * 6 cancelado, 7 devolvido, 8 autorizado, 9 chargeback, 10 completo,
 * 11 erro no checkout, 12 pré-checkout (abandono), 13 expirado, 16 em revisão.
 */
const STATUS_ENUM: Record<number, EventType> = {
  1: "purchase_pending",
  2: "purchase_approved",
  3: "other",
  4: "other",
  5: "payment_declined",
  6: "checkout_abandoned", // cancelada sem pagamento → abandono (confirmar com payloads reais)
  7: "refunded",
  8: "other",
  9: "chargeback",
  10: "purchase_approved",
  11: "other",
  12: "checkout_abandoned",
  13: "checkout_abandoned", // expirada sem pagamento → abandono (confirmar)
  16: "other",
};

const STATUS_TEXT: Array<[RegExp, EventType]> = [
  [/charge.?back|contesta/i, "chargeback"],
  [/refund|devolvid|reembols|estorn/i, "refunded"],
  [/abandon|pre.?checkout|precheckout|cart/i, "checkout_abandoned"],
  [/reject|recusad|declin|denied|negad/i, "payment_declined"],
  [/approved|aprovad|complete|paid|pago/i, "purchase_approved"],
  [/pending|pendente|aguardando|waiting|billet|boleto|pix/i, "purchase_pending"],
  [/cancel|expir/i, "checkout_abandoned"],
];

function classify(raw: Obj): { type: EventType | null; rawStatus: string | null } {
  const num = pick(raw, "sale_status_enum", "status_enum");
  const text = str(pick(raw, "sale_status_enum_key", "sale_status", "status", "event", "sale_status_detail"));
  const rawStatus = [str(num), text].filter(Boolean).join(" / ") || null;
  const n = typeof num === "number" ? num : typeof num === "string" && /^\d+$/.test(num) ? Number(num) : null;
  if (n !== null) return { type: STATUS_ENUM[n] ?? null, rawStatus };
  if (text) {
    for (const [re, t] of STATUS_TEXT) if (re.test(text)) return { type: t, rawStatus };
  }
  return { type: null, rawStatus };
}

function declineReason(raw: Obj): string | null {
  const detail = str(pick(raw, "sale_status_detail", "status_detail", "refusal_reason", "decline_reason")) ?? "";
  if (/insufficient|saldo|funds|fundos/i.test(detail)) return "insufficient_funds";
  return detail || null;
}

function parseDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // ISO
  let dt = DateTime.fromISO(s, { setZone: true });
  // "2026-11-04 10:00:00" sem fuso: a Perfect Pay é brasileira, então assumimos America/Sao_Paulo (a confirmar).
  if (!dt.isValid) dt = DateTime.fromFormat(s, "yyyy-MM-dd HH:mm:ss", { zone: "America/Sao_Paulo" });
  if (!dt.isValid && /^\d{10,13}$/.test(s)) dt = DateTime.fromMillis(s.length === 10 ? Number(s) * 1000 : Number(s));
  return dt.isValid ? dt.toUTC().toISO() : null;
}

function amount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.replace(",", "."));
  return null;
}

function currency(raw: Obj): string | null {
  // Confirmado em payload real: "currency_enum_key": "USD"
  const c = str(pick(raw, "currency_enum_key", "currency", "currency_code", "sale_currency"));
  if (c && /^[A-Za-z]{3}$/.test(c)) return c.toUpperCase();
  return null; // currency_enum numérico: significado não confirmado, não adivinhamos
}

function firstNameOf(full: string | null): string | null {
  if (!full) return null;
  return full.split(/\s+/)[0] || null;
}

export function deriveDedupeKey(e: {
  providerEventId: string | null;
  transactionId: string | null;
  rawStatus: string | null;
  occurredAt: string | null;
  email?: string | null;
  productCode?: string | null;
}): string {
  if (e.providerEventId) return `id:${e.providerEventId}`;
  if (e.transactionId) return `tx:${e.transactionId}:${e.rawStatus ?? ""}:${e.occurredAt ?? ""}`;
  return `h:${sha256([e.email, e.productCode, e.rawStatus, e.occurredAt].join("|"))}`;
}

export function adaptPerfectPay(input: unknown, receivedAt = new Date()): AdaptResult {
  if (!isObj(input)) {
    return { ok: false, reason: "payload não é um objeto JSON", dedupeKey: `h:${sha256(JSON.stringify(input) ?? "")}` };
  }
  const raw = input;
  const { type, rawStatus } = classify(raw);
  const transactionId = str(pick(raw, "code", "sale_code", "transaction", "transaction_id", "transaction_code"));
  const providerEventId = str(pick(raw, "event_id", "webhook_id", "notification_id"));
  const occurredAt =
    parseDate(pick(raw, "date_status", "date_updated", "date_approved", "date_created", "created_at")) ?? null;
  const email = str(pick(raw, "customer.email", "client.email", "buyer.email", "email"))?.toLowerCase() ?? null;
  const productCode = str(pick(raw, "product.code", "product_code"));

  const dedupeKey = deriveDedupeKey({ providerEventId, transactionId, rawStatus, occurredAt, email, productCode });

  if (!type) return { ok: false, reason: `status não reconhecido (${rawStatus ?? "vazio"})`, dedupeKey };
  if (!email) return { ok: false, reason: "e-mail do cliente ausente", dedupeKey };

  const fullName = str(pick(raw, "customer.full_name", "customer.name", "client.name", "name"));
  const country = str(pick(raw, "customer.country", "customer.address.country", "country"))?.toUpperCase() ?? null;
  const region = str(pick(raw, "customer.state", "customer.address.state", "state"))?.toUpperCase() ?? null;
  const areaCode = str(pick(raw, "customer.phone_area_code"));
  const phoneNum = str(pick(raw, "customer.phone_number", "customer.phone", "phone"));
  // Confirmado em payload real: "phone_formated_ddi": "+44..."
  const phone = str(pick(raw, "customer.phone_formated_ddi")) ?? (phoneNum ? [areaCode, phoneNum].filter(Boolean).join(" ") : null);
  const tzField = str(pick(raw, "customer.timezone", "timezone"));

  const candidate = {
    providerEventId,
    type,
    occurredAt: occurredAt ?? receivedAt.toISOString(),
    customer: {
      email,
      fullName,
      firstName: str(pick(raw, "customer.first_name")) ?? firstNameOf(fullName),
      country,
      region,
      phone,
      timezone: tzField ?? zoneFromLocation(country, region),
    },
    product: {
      code: productCode,
      planCode: str(pick(raw, "plan.code", "plan_code")),
      offerCode: str(pick(raw, "offer.code", "offer_code", "checkout.code")),
      name: str(pick(raw, "product.name", "product_name")),
    },
    transactionId,
    amount: amount(pick(raw, "sale_amount", "amount", "value", "price")),
    currency: currency(raw),
    rawStatus,
    declineReason: type === "payment_declined" ? declineReason(raw) : null,
    recoveryUrl: str(pick(raw, "checkout_recovery_url", "recovery_url", "abandoned_checkout_url")),
  };

  const parsed = normalizedEventSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reason: `payload inválido: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, dedupeKey };
  }
  return { ok: true, event: parsed.data, dedupeKey };
}

/** Token opcional enviado pela Perfect Pay no payload ou no cabeçalho. */
export function extractToken(raw: unknown, headers: Headers): string | null {
  const fromBody = isObj(raw) ? str(raw.token) : null;
  return fromBody ?? headers.get("x-perfectpay-token") ?? headers.get("x-webhook-token") ?? null;
}

const CARD_KEY = /card.?num|cardnumber|cc.?num|cvv|cvc|security.?code|card.?token|^pan$|expir.*(month|year|date)|card_holder/i;

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function looksLikeCard(v: string): boolean {
  const digits = v.replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(digits) && luhn(digits);
}

/** Remove qualquer coisa que pareça dado de cartão antes de gravar o payload. */
export function sanitizeRaw(v: unknown, key = ""): unknown {
  if (Array.isArray(v)) return v.map((x) => sanitizeRaw(x));
  if (isObj(v)) {
    const out: Obj = {};
    for (const [k, val] of Object.entries(v)) {
      if (CARD_KEY.test(k)) continue;
      out[k] = sanitizeRaw(val, k);
    }
    return out;
  }
  if (typeof v === "string" && looksLikeCard(v)) return "[removido: parecia número de cartão]";
  if (typeof v === "number" && looksLikeCard(String(v))) return "[removido: parecia número de cartão]";
  void key;
  return v;
}
