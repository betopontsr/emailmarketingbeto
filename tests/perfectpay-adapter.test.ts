import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adaptPerfectPay, sanitizeRaw } from "@/lib/perfectpay/adapter";
import { resolveProduct } from "@/lib/products/resolve";
import { properCase } from "@/lib/util/names";
import { createTestDb } from "./helpers/db";
import { receiveAndProcess } from "@/lib/pipeline/run";
import { customers, webhookEvents } from "@/lib/db/schema";

const fx = (name: string) => JSON.parse(readFileSync(`tests/fixtures/perfectpay/${name}.json`, "utf8"));

describe("adaptador Perfect Pay (hipotético)", () => {
  it("compra aprovada do principal", () => {
    const r = adaptPerfectPay(fx("hipotetico-aprovada-main"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.type).toBe("purchase_approved");
    expect(r.event.customer.email).toBe("john.smith@example.com");
    expect(r.event.customer.timezone).toBe("America/Los_Angeles");
    expect(r.event.transactionId).toBe("PPCPMTB5BMTEST1");
    expect(r.event.occurredAt).toBe("2026-11-04T13:00:05.000Z");
    expect(r.dedupeKey).toContain("tx:PPCPMTB5BMTEST1");
  });

  it("abandono, recusa por saldo e reembolso", () => {
    const a = adaptPerfectPay(fx("hipotetico-abandono-main"));
    const d = adaptPerfectPay(fx("hipotetico-recusada-saldo"));
    const rf = adaptPerfectPay(fx("hipotetico-reembolso-knots"));
    expect(a.ok && a.event.type).toBe("checkout_abandoned");
    expect(d.ok && d.event.type).toBe("payment_declined");
    expect(d.ok && d.event.declineReason).toBe("insufficient_funds");
    expect(rf.ok && rf.event.type).toBe("refunded");
  });

  it("evento desconhecido não é reconhecido", () => {
    const r = adaptPerfectPay(fx("desconhecido"));
    expect(r.ok).toBe(false);
  });

  it("descarta dados que parecem cartão", () => {
    const s = sanitizeRaw(fx("hipotetico-com-cartao")) as Record<string, unknown>;
    expect(s.card_number).toBeUndefined();
    expect(s.cvv).toBeUndefined();
    expect(String(s.notes)).toContain("removido");
    expect((s.customer as Record<string, unknown>).identification_number).toBe("12345678909");
  });
});

describe("adaptador Perfect Pay (payload REAL)", () => {
  it("compra aprovada real do principal", async () => {
    const r = adaptPerfectPay(fx("real-aprovada-main"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event).toMatchObject({
      type: "purchase_approved",
      transactionId: "PPCPMTB5HN02FDGT8U",
      amount: 43.72,
      currency: "USD",
      product: { code: "PPPBFBLH", planCode: "PPLQQQBNF" },
      customer: { email: "cliente@example.com", firstName: "Jane", country: "GB", phone: "+447000000000", timezone: "Europe/London" },
    });
    const { db, close } = await createTestDb();
    const out = await receiveAndProcess(db, { provider: "perfectpay", raw: fx("real-aprovada-main") });
    expect(out.status).toBe("processed"); // mapeado pela migration 0002 (PPPBFBLH → principal)
    await close();
  });
});

describe("mapeamento de produtos", () => {
  const maps = [
    { productKey: "main", matchType: "code", value: "PPU38CQFMQH" },
    { productKey: "knots", matchType: "code", value: "PPU38CQFMS2" },
    { productKey: "nathan", matchType: "name_pattern", value: "Five Knots" },
  ];
  it("qualquer código bate", () => {
    expect(resolveProduct({ code: "X", planCode: "PPU38CQFMQH", offerCode: null, name: null }, maps)).toEqual({ ok: true, productKey: "main" });
  });
  it("ambíguo não dispara", () => {
    const r = resolveProduct({ code: null, planCode: "PPU38CQFMS2", offerCode: null, name: "The Five Knots of the Body" }, maps);
    expect(r.ok).toBe(false);
  });
  it("sem mapeamento", () => {
    expect(resolveProduct({ code: "Z", planCode: null, offerCode: null, name: "Outro" }, maps).ok).toBe(false);
  });
});

describe("nomes", () => {
  it("capitaliza", () => {
    expect(properCase("JOHN")).toBe("John");
    expect(properCase("mary-ann smith")).toBe("Mary-Ann");
    expect(properCase("  ")).toBeNull();
  });
});

describe("captura do webhook", () => {
  it("grava, processa e marca repetido como duplicado", async () => {
    const { db, close } = await createTestDb();
    const raw = fx("hipotetico-aprovada-main");
    const first = await receiveAndProcess(db, { provider: "perfectpay", raw });
    const second = await receiveAndProcess(db, { provider: "perfectpay", raw });
    expect(first.status).not.toBe("error");
    expect(second.status).toBe("duplicate");
    const rows = await db.select().from(webhookEvents);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.isDuplicate)?.status).toBe("duplicate");
    const cs = await db.select().from(customers);
    expect(cs).toHaveLength(1);
    expect(cs[0].firstName).toBe("John");
    await close();
  });

  it("produto sem mapeamento fica como não mapeado e não cria cliente", async () => {
    const { db, close } = await createTestDb();
    const raw = fx("hipotetico-com-cartao");
    const r = await receiveAndProcess(db, { provider: "perfectpay", raw });
    expect(r.status).toBe("unmapped");
    expect(await db.select().from(customers)).toHaveLength(0);
    const [ev] = await db.select().from(webhookEvents);
    expect(JSON.stringify(ev.rawPayload)).not.toContain("4111111111111111");
    await close();
  });

  it("não reconhecido não dispara nada", async () => {
    const { db, close } = await createTestDb();
    const r = await receiveAndProcess(db, { provider: "perfectpay", raw: fx("desconhecido") });
    expect(r.status).toBe("unrecognized");
    await close();
  });
});
