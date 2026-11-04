import type { NormalizedEvent } from "@/lib/events/types";

let n = 0;
/** Evento normalizado de teste (provider "simulator"). */
export function simEvent(p: {
  type: NormalizedEvent["type"];
  email?: string;
  code?: string;
  at: Date | string;
  tx?: string | null;
  declineReason?: string | null;
  firstName?: string | null;
  amount?: number;
  region?: string | null;
}): NormalizedEvent {
  n++;
  return {
    providerEventId: `sim-${n}-${Date.now()}`,
    type: p.type,
    occurredAt: new Date(p.at).toISOString(),
    customer: {
      email: p.email ?? "buyer@example.com",
      fullName: p.firstName ?? "John Smith",
      firstName: p.firstName === undefined ? "JOHN" : p.firstName,
      country: "US",
      region: p.region ?? null,
      phone: null,
      timezone: null,
    },
    product: { code: p.code ?? "PPU38CQFMQH", planCode: null, offerCode: null, name: null },
    transactionId: p.tx === undefined ? `tx-${n}` : p.tx,
    amount: p.amount ?? 47,
    currency: "USD",
    rawStatus: p.type,
    declineReason: p.declineReason ?? null,
    recoveryUrl: null,
  };
}
