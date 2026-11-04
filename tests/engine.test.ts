import { describe, expect, it } from "vitest";
import { decide } from "@/lib/engine/decide";
import { guard } from "@/lib/engine/guard";
import { adjustForQuiet, upsellTime } from "@/lib/engine/schedule";
import {
  DEFAULT_ENGINE_CONFIG as cfg,
  type Action,
  type CustomerState,
  type EmailSnap,
  type EngineEvent,
  type FlowSnap,
} from "@/lib/engine/types";
import { resolveZone } from "@/lib/util/time";

const NY = "America/New_York";
const T0 = new Date("2026-11-04T15:00:00Z"); // 10:00 em Nova York (EST)
const H = 3600_000;
const D = 24 * H;

function state(p: Partial<CustomerState> = {}): CustomerState {
  return { customerId: 1, suppressed: false, suppressedReason: null, timezone: NY, flows: [], emails: [], purchases: [], ...p };
}
function ev(p: Partial<EngineEvent>): EngineEvent {
  return {
    type: "checkout_abandoned",
    productKey: "main",
    occurredAt: T0,
    transactionId: null,
    amountCents: 4700,
    currency: "USD",
    declineReason: null,
    recoveryUrl: null,
    eventKey: "k1",
    ...p,
  };
}
const created = (acts: Action[]) => acts.find((a) => a.type === "create_flow") as Extract<Action, { type: "create_flow" }> | undefined;

/** Aplica o create_flow ao estado (como o banco faria), para encadear eventos nos testes. */
let nextId = 100;
function applyCreate(s: CustomerState, acts: Action[], at: Date): CustomerState {
  const c = created(acts);
  let out = { ...s, flows: [...s.flows], emails: [...s.emails], purchases: [...s.purchases] };
  for (const a of acts) {
    if (a.type === "cancel_emails") out.emails = out.emails.map((e) => (a.emailIds.includes(e.id) ? { ...e, status: "cancelled" } : e));
    if (a.type === "end_flow") out.flows = out.flows.map((f) => (f.id === a.flowId ? { ...f, status: a.status, endedAt: at } : f));
    if (a.type === "record_purchase")
      out.purchases.push({ transactionId: a.transactionId, productKey: a.productKey, status: "approved", purchasedAt: a.purchasedAt });
    if (a.type === "suppress") out = { ...out, suppressed: true, suppressedReason: a.reason };
  }
  if (c) {
    const fid = nextId++;
    const f: FlowSnap = { id: fid, type: c.flowType, status: c.status, anchorAt: c.anchorAt, createdAt: at, endedAt: null, includesF3: c.includesF3, isControl: c.isControl };
    out.flows.push(f);
    for (const e of c.emails) {
      out.emails.push({ id: `e${nextId++}`, flowId: fid, flowType: c.flowType, templateKey: e.templateKey, offerKey: e.offerKey, status: e.status, scheduledFor: e.scheduledFor, sentAt: null });
    }
  }
  return out;
}
/** Marca todos os e-mails agendados até `until` como entregues. */
function deliverUntil(s: CustomerState, until: Date): CustomerState {
  return { ...s, emails: s.emails.map((e) => (e.status === "scheduled" && e.scheduledFor <= until ? { ...e, status: "sent", sentAt: e.scheduledFor } : e)) };
}
function endAll(s: CustomerState, at: Date): CustomerState {
  return { ...s, flows: s.flows.map((f) => (f.status === "active" ? { ...f, status: "completed", endedAt: at } : f)) };
}

describe("Fluxo A (abandono)", () => {
  it("agenda A1 em 30 min, A2 em 24 h e F3 em 72 h", () => {
    const d = decide(state(), ev({}), cfg, T0);
    const c = created(d.actions)!;
    expect(c.flowType).toBe("recovery_a");
    expect(c.emails.map((e) => [e.templateKey, e.scheduledFor.toISOString()])).toEqual([
      ["rec_a1", "2026-11-04T15:30:00.000Z"],
      ["rec_a2", "2026-11-05T15:00:00.000Z"],
      ["rec_f3", "2026-11-07T15:00:00.000Z"],
    ]);
  });

  it("abandono dentro de fluxo ativo não reinicia", () => {
    const s1 = applyCreate(state(), decide(state(), ev({}), cfg, T0).actions, T0);
    const d2 = decide(s1, ev({ occurredAt: new Date(T0.getTime() + H), eventKey: "k2" }), cfg, new Date(T0.getTime() + H));
    expect(d2.status).toBe("ignored");
    expect(created(d2.actions)).toBeUndefined();
  });

  it("abandono depois de compra aprovada não inicia nada", () => {
    const s = state({ purchases: [{ transactionId: "t", productKey: "main", status: "approved", purchasedAt: T0 }] });
    const d = decide(s, ev({ occurredAt: new Date(T0.getTime() - H) }), cfg, T0);
    expect(d.status).toBe("ignored");
    expect(d.reason).toContain("compra aprovada");
  });

  it("abandono de outro produto só registra", () => {
    expect(decide(state(), ev({ productKey: "knots" }), cfg, T0).status).toBe("ignored");
  });

  it("menos de 30 dias desde o último fluxo: não entra; depois de 30 dias entra sem F3", () => {
    let s = applyCreate(state(), decide(state(), ev({}), cfg, T0).actions, T0);
    s = deliverUntil(s, new Date(T0.getTime() + 4 * D));
    s = endAll(s, new Date(T0.getTime() + 3 * D));
    const at20 = new Date(T0.getTime() + 20 * D);
    expect(decide(s, ev({ occurredAt: at20, eventKey: "k20" }), cfg, at20).status).toBe("ignored");
    const at34 = new Date(T0.getTime() + 34 * D);
    const d = decide(s, ev({ occurredAt: at34, eventKey: "k34" }), cfg, at34);
    const c = created(d.actions)!;
    expect(c.includesF3).toBe(false);
    expect(c.emails.map((e) => e.templateKey)).toEqual(["rec_a1", "rec_a2"]);
  });
});

describe("Fluxo B (cartão recusado)", () => {
  it("recusa substitui o Fluxo A pelo B", () => {
    const s1 = applyCreate(state(), decide(state(), ev({}), cfg, T0).actions, T0);
    const at = new Date(T0.getTime() + 5 * 60_000);
    const d = decide(s1, ev({ type: "payment_declined", occurredAt: at, eventKey: "k2" }), cfg, at);
    const aFlow = s1.flows[0];
    expect(d.actions.find((a) => a.type === "end_flow" && a.flowId === aFlow.id)).toBeTruthy();
    const cancel = d.actions.find((a) => a.type === "cancel_emails") as Extract<Action, { type: "cancel_emails" }>;
    expect(cancel.emailIds).toHaveLength(3);
    const c = created(d.actions)!;
    expect(c.flowType).toBe("recovery_b");
    expect(c.emails.map((e) => [e.templateKey, e.scheduledFor.toISOString()])).toEqual([
      ["rec_b1", "2026-11-04T15:15:00.000Z"],
      ["rec_b2", "2026-11-05T15:05:00.000Z"],
      ["rec_f3", "2026-11-07T15:05:00.000Z"],
    ]);
  });

  it("recusa por saldo move o B2 para 48 h", () => {
    const d = decide(state(), ev({ type: "payment_declined", declineReason: "insufficient_funds" }), cfg, T0);
    const b2 = created(d.actions)!.emails.find((e) => e.templateKey === "rec_b2")!;
    expect(b2.scheduledFor.toISOString()).toBe("2026-11-06T15:00:00.000Z");
  });

  it("Fluxo B ativo não reinicia", () => {
    const s1 = applyCreate(state(), decide(state(), ev({ type: "payment_declined" }), cfg, T0).actions, T0);
    const d = decide(s1, ev({ type: "payment_declined", eventKey: "k9" }), cfg, T0);
    expect(d.status).toBe("ignored");
  });
});

describe("horários de recuperação", () => {
  it("janela 22h–7h adia para 8h", () => {
    // 23:00 em NY = 04:00Z do dia seguinte
    const late = new Date("2026-11-05T04:00:00Z");
    const d = decide(state(), ev({ occurredAt: late }), cfg, late);
    const a1 = created(d.actions)!.emails[0];
    expect(a1.scheduledFor.toISOString()).toBe("2026-11-05T13:00:00.000Z"); // 08:00 EST
    // madrugada (03:00) também vai para 08:00 do mesmo dia
    expect(adjustForQuiet(new Date("2026-11-05T08:00:00Z"), NY, cfg).toISOString()).toBe("2026-11-05T13:00:00.000Z");
  });

  it("limite de 1 e-mail de recuperação por dia (no agendamento)", () => {
    // 21:50 NY: A1 cai 22:20 → 8h do dia seguinte; A2 (21:50 do dia seguinte) bateria no mesmo dia → vai para o outro dia
    const at = new Date("2026-11-05T02:50:00Z");
    const c = created(decide(state(), ev({ occurredAt: at }), cfg, at).actions)!;
    expect(c.emails.map((e) => e.scheduledFor.toISOString())).toEqual([
      "2026-11-05T13:00:00.000Z",
      "2026-11-06T13:00:00.000Z",
      "2026-11-08T02:50:00.000Z",
    ]);
  });

  it("limite de 1 por dia na guarda: adia para 8h do dia seguinte", () => {
    const s = state({
      flows: [{ id: 1, type: "recovery_b", status: "active", anchorAt: T0, createdAt: T0, endedAt: null, includesF3: true, isControl: false }],
      emails: [
        { id: "a", flowId: 9, flowType: "recovery_a", templateKey: "rec_a1", offerKey: null, status: "sent", scheduledFor: T0, sentAt: T0 },
        { id: "b", flowId: 1, flowType: "recovery_b", templateKey: "rec_b1", offerKey: null, status: "sending", scheduledFor: T0, sentAt: null },
      ],
    });
    const now = new Date(T0.getTime() + 10 * 60_000);
    const r = guard({ email: s.emails[1] as EmailSnap, flowStatus: "active", state: s, cfg, now, globalPause: false, missingConfig: [], dryRun: true });
    expect(r).toEqual({ action: "reschedule", to: new Date("2026-11-05T13:00:00.000Z"), reason: "limite de 1 e-mail de recuperação por dia" });
  });

  it("fuso desconhecido usa Nova York", () => {
    expect(resolveZone(null)).toBe(NY);
    expect(resolveZone("Marte/Base")).toBe(NY);
  });
});

describe("compra do principal", () => {
  it("abandono seguido de compra cancela a recuperação e inicia o upsell", () => {
    const s1 = applyCreate(state(), decide(state(), ev({}), cfg, T0).actions, T0);
    const at = new Date(T0.getTime() + 2 * H);
    const d = decide(s1, ev({ type: "purchase_approved", occurredAt: at, transactionId: "tx1" }), cfg, at);
    const cancel = d.actions.find((a) => a.type === "cancel_emails") as Extract<Action, { type: "cancel_emails" }>;
    expect(cancel.reason).toBe("comprou");
    expect(cancel.emailIds).toHaveLength(3);
    expect(d.actions.find((a) => a.type === "end_flow")).toMatchObject({ status: "cancelled", reason: "comprou" });
    const c = created(d.actions)!;
    expect(c.flowType).toBe("upsell");
    expect(c.emails.map((e) => [e.templateKey, e.offerKey, e.scheduledFor.toISOString()])).toEqual([
      ["upsell_1", "nathan", "2026-11-05T15:00:00.000Z"],
      ["upsell_2", "knots", "2026-11-07T15:00:00.000Z"],
      ["upsell_3", "reclaim", "2026-11-09T15:00:00.000Z"],
      ["upsell_4", "nathan", "2026-11-11T15:00:00.000Z"],
      ["upsell_5", "knots", "2026-11-13T15:00:00.000Z"],
      ["upsell_6", "reclaim", "2026-11-15T15:00:00.000Z"],
      ["upsell_7", "reclaim", "2026-11-17T15:00:00.000Z"],
    ]);
  });

  it("comprar o principal de novo não reinicia o upsell", () => {
    const s1 = applyCreate(state(), decide(state(), ev({ type: "purchase_approved", transactionId: "t1" }), cfg, T0).actions, T0);
    const d = decide(s1, ev({ type: "purchase_approved", transactionId: "t2", occurredAt: new Date(T0.getTime() + D) }), cfg, T0);
    expect(created(d.actions)).toBeUndefined();
  });

  it("atribui ao último e-mail de recuperação entregue nos 7 dias anteriores", () => {
    let s = applyCreate(state(), decide(state(), ev({}), cfg, T0).actions, T0);
    s = deliverUntil(s, new Date(T0.getTime() + 25 * H)); // A1 e A2 entregues
    const a2 = s.emails.find((e) => e.templateKey === "rec_a2")!;
    const at = new Date(T0.getTime() + 30 * H);
    const d = decide(s, ev({ type: "purchase_approved", occurredAt: at, transactionId: "tx" }), cfg, at);
    expect(d.actions.find((a) => a.type === "record_purchase")).toMatchObject({ attributedEmailId: a2.id });
    // mais de 7 dias depois: compra direta
    const late = new Date(T0.getTime() + 9 * D);
    const d2 = decide(s, ev({ type: "purchase_approved", occurredAt: late, transactionId: "tx2" }), cfg, late);
    expect(d2.actions.find((a) => a.type === "record_purchase")).toMatchObject({ attributedEmailId: null });
  });
});

describe("upsell", () => {
  it("compra de upsell antes do principal: o fluxo criado depois já pula a oferta (inclui preço reduzido)", () => {
    // Knots comprado (qualquer variante de preço vira a chave "knots")
    const s0 = applyCreate(state(), decide(state(), ev({ type: "purchase_approved", productKey: "knots", transactionId: "k" }), cfg, T0).actions, T0);
    const d = decide(s0, ev({ type: "purchase_approved", transactionId: "m", occurredAt: new Date(T0.getTime() + H) }), cfg, T0);
    const c = created(d.actions)!;
    const knots = c.emails.filter((e) => e.offerKey === "knots");
    expect(knots.every((e) => e.status === "skipped")).toBe(true);
    expect(c.emails.filter((e) => e.status === "scheduled")).toHaveLength(5);
  });

  it("quem compra uma oferta continua recebendo as outras e a compra é atribuída ao e-mail certo", () => {
    let s = applyCreate(state(), decide(state(), ev({ type: "purchase_approved", transactionId: "m" }), cfg, T0).actions, T0);
    s = deliverUntil(s, new Date(T0.getTime() + 1.5 * D)); // upsell_1 (nathan) entregue
    const u1 = s.emails.find((e) => e.templateKey === "upsell_1")!;
    const at = new Date(T0.getTime() + 1.6 * D);
    const d = decide(s, ev({ type: "purchase_approved", productKey: "nathan", transactionId: "n", occurredAt: at }), cfg, at);
    expect(d.actions.find((a) => a.type === "record_purchase")).toMatchObject({ attributedEmailId: u1.id });
    const cancel = d.actions.find((a) => a.type === "cancel_emails") as Extract<Action, { type: "cancel_emails" }>;
    const cancelledKeys = s.emails.filter((e) => cancel.emailIds.includes(e.id)).map((e) => e.templateKey);
    expect(cancelledKeys).toEqual(["upsell_4"]);
    expect(d.actions.find((a) => a.type === "end_flow")).toBeUndefined();
  });

  it("compra direta de oferta sem e-mail", () => {
    const d = decide(state(), ev({ type: "purchase_approved", productKey: "reclaim", transactionId: "r" }), cfg, T0);
    expect(d.actions.find((a) => a.type === "record_purchase")).toMatchObject({ attributedEmailId: null });
  });

  it("comprou as 3 ofertas: fluxo termina como completo", () => {
    let s = applyCreate(state(), decide(state(), ev({ type: "purchase_approved", transactionId: "m" }), cfg, T0).actions, T0);
    s = applyCreate(s, decide(s, ev({ type: "purchase_approved", productKey: "nathan", transactionId: "n" }), cfg, T0).actions, T0);
    s = applyCreate(s, decide(s, ev({ type: "purchase_approved", productKey: "knots", transactionId: "k" }), cfg, T0).actions, T0);
    const d = decide(s, ev({ type: "purchase_approved", productKey: "reclaim", transactionId: "r" }), cfg, T0);
    expect(d.actions.find((a) => a.type === "end_flow")).toMatchObject({ status: "completed" });
  });

  it("upsell no fuso do cliente às 10h", () => {
    const la = upsellTime(new Date("2026-11-04T23:30:00Z"), 1, 10, "America/Los_Angeles");
    expect(la.toISOString()).toBe("2026-11-05T18:00:00.000Z"); // 10:00 PST do dia seguinte à compra (15:30 PST)
  });

  it("guarda: upsell pula oferta comprada (preço reduzido também)", () => {
    const s = state({
      flows: [{ id: 1, type: "upsell", status: "active", anchorAt: T0, createdAt: T0, endedAt: null, includesF3: false, isControl: false }],
      purchases: [
        { transactionId: "m", productKey: "main", status: "approved", purchasedAt: T0 },
        { transactionId: "n47", productKey: "nathan", status: "approved", purchasedAt: T0 },
      ],
      emails: [{ id: "u4", flowId: 1, flowType: "upsell", templateKey: "upsell_4", offerKey: "nathan", status: "sending", scheduledFor: T0, sentAt: null }],
    });
    const r = guard({ email: s.emails[0], flowStatus: "active", state: s, cfg, now: T0, globalPause: false, missingConfig: [], dryRun: true });
    expect(r).toMatchObject({ action: "skip", status: "skipped" });
  });
});

describe("reembolso e supressão", () => {
  it("reembolso de qualquer produto suprime e cancela tudo", () => {
    let s = applyCreate(state(), decide(state(), ev({ type: "purchase_approved", transactionId: "m" }), cfg, T0).actions, T0);
    s = applyCreate(s, decide(s, ev({ type: "purchase_approved", productKey: "knots", transactionId: "k" }), cfg, T0).actions, T0);
    const d = decide(s, ev({ type: "refunded", productKey: "knots", transactionId: "k" }), cfg, T0);
    expect(d.actions.find((a) => a.type === "suppress")).toBeTruthy();
    const cancel = d.actions.find((a) => a.type === "cancel_emails") as Extract<Action, { type: "cancel_emails" }>;
    expect(cancel.emailIds.length).toBe(5);
    expect(d.actions.filter((a) => a.type === "end_flow")).toHaveLength(1);
  });

  it("guarda cancela envio para suprimido e para quem comprou o principal", () => {
    const base = state({
      flows: [{ id: 1, type: "recovery_a", status: "active", anchorAt: T0, createdAt: T0, endedAt: null, includesF3: true, isControl: false }],
      emails: [{ id: "a1", flowId: 1, flowType: "recovery_a", templateKey: "rec_a1", offerKey: null, status: "sending", scheduledFor: T0, sentAt: null }],
    });
    const g = (s: CustomerState) => guard({ email: s.emails[0], flowStatus: "active", state: s, cfg, now: T0, globalPause: false, missingConfig: [], dryRun: true });
    expect(g({ ...base, suppressed: true, suppressedReason: "descadastro" })).toMatchObject({ status: "cancelled" });
    expect(g({ ...base, purchases: [{ transactionId: "m", productKey: "main", status: "approved", purchasedAt: T0 }] })).toMatchObject({
      status: "cancelled",
      reason: "já comprou o produto principal",
    });
    expect(g(base)).toEqual({ action: "send" });
  });

  it("guarda: atraso maior que o limite expira; pausa segura; F3 repetido é pulado", () => {
    const s = state({
      flows: [{ id: 1, type: "recovery_a", status: "active", anchorAt: T0, createdAt: T0, endedAt: null, includesF3: true, isControl: false }],
      emails: [
        { id: "old", flowId: 0, flowType: "recovery_a", templateKey: "rec_f3", offerKey: null, status: "sent", scheduledFor: T0, sentAt: new Date(T0.getTime() - 40 * D) },
        { id: "f3", flowId: 1, flowType: "recovery_a", templateKey: "rec_f3", offerKey: null, status: "sending", scheduledFor: T0, sentAt: null },
      ],
    });
    const base = { email: s.emails[1], flowStatus: "active" as const, state: s, cfg, now: T0, globalPause: false, missingConfig: [], dryRun: true };
    expect(guard(base)).toMatchObject({ action: "skip", reason: "já recebeu o F3 antes" });
    expect(guard({ ...base, globalPause: true })).toMatchObject({ action: "hold" });
    const s2 = { ...s, emails: [s.emails[1]] };
    expect(guard({ ...base, state: s2, now: new Date(T0.getTime() + 13 * H) })).toMatchObject({ action: "skip", status: "expired" });
    expect(guard({ ...base, state: s2, missingConfig: ["x"], dryRun: false })).toMatchObject({ action: "hold" });
  });

  it("evento pendente ou outro só registra", () => {
    expect(decide(state(), ev({ type: "purchase_pending" }), cfg, T0).actions).toHaveLength(0);
    expect(decide(state(), ev({ type: "other" }), cfg, T0).actions).toHaveLength(0);
  });

  it("grupo de controle: fluxo sem e-mails", () => {
    const d = decide(state(), ev({}), { ...cfg, controlPercent: 50 }, T0);
    const c = created(d.actions)!;
    // determinístico: o mesmo evento sempre cai no mesmo grupo
    const again = created(decide(state(), ev({}), { ...cfg, controlPercent: 50 }, T0).actions)!;
    expect(again.isControl).toBe(c.isControl);
    if (c.isControl) expect(c.emails).toHaveLength(0);
  });
});
