import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { simEvent } from "./helpers/sim";
import { receiveAndProcess } from "@/lib/pipeline/run";
import { advanceTestCustomer, runDispatch } from "@/lib/dispatch/dispatcher";
import { customers } from "@/lib/db/schema";
import { overview } from "@/lib/queries/overview";
import { performance } from "@/lib/queries/performance";
import { allCustomers, listCustomers, parseCustomerFilters } from "@/lib/queries/customers";
import { customerDetail, emailHtml } from "@/lib/queries/customer-detail";
import { recordResendEvent } from "@/lib/email/events";
import type { Filters } from "@/lib/queries/common";

const now = new Date("2026-11-04T17:00:00Z"); // meio-dia em Nova York: fora da janela de silêncio
const f: Filters = { from: new Date(now.getTime() - 30 * 864e5), to: new Date(now.getTime() + 60 * 864e5), fromStr: "", toStr: "", includeTest: true };
const sender = () => ({ send: async () => ({ ok: true as const, id: "x" }) });

describe("consultas do painel", () => {
  it("rodam sem erro e dão números coerentes", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: now, email: "a@example.com" }), isTest: true }, { now });
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "payment_declined", at: now, email: "b@example.com", declineReason: "insufficient_funds" }), isTest: true }, { now });
    const [a] = await db.select().from(customers);
    const due = await advanceTestCustomer(db, a.id, now);
    await runDispatch(db, { now, getSender: sender, onlyIds: due });
    const later = new Date(now.getTime() + 60_000);
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: later, email: "a@example.com", tx: "T" }), isTest: true }, { now: later });
    const d0 = await customerDetail(db, a.id);
    const a1 = d0!.emails.find((e) => e.templateKey === "rec_a1")!;
    await recordResendEvent(db, "e1", { type: "email.opened", data: { email_id: "x", tags: { scheduled_email_id: a1.id } } });

    const o = await overview(db, f);
    expect(Number(o.events.total)).toBe(3);
    expect(o.activeFlows.upsell).toBe(1);
    expect(o.activeFlows.recovery_b).toBe(1);
    expect(o.revenue.find((r) => r.origin === "recovery_email")).toBeTruthy();

    const p = await performance(db, f);
    const ra1 = p.perTemplate.find((t) => t.template_key === "rec_a1")!;
    expect(Number(ra1.sent)).toBe(1);
    expect(Number(ra1.purchases)).toBe(1);
    expect(Number(ra1.opened)).toBe(1);
    expect(Number(p.recovery.find((r) => r.type === "recovery_a")?.recovered)).toBe(1);
    expect(p.offers).toHaveLength(3);

    const cf = parseCustomerFilters({ test: "1" });
    const l = await listCustomers(db, cf, 1);
    expect(l.list).toHaveLength(2);
    expect(l.list.find((c) => c.email === "a@example.com")?.journey).toBe("upsell");
    expect(l.list.find((c) => c.email === "b@example.com")?.journey).toBe("recovery_b");
    expect((await listCustomers(db, { ...cf, product: "none" }, 1)).list.map((c) => c.email)).toEqual(["b@example.com"]);
    expect((await listCustomers(db, { ...cf, q: "b@ex" }, 1)).list).toHaveLength(1);
    expect((await listCustomers(db, { ...cf, flow: "recovery_a" }, 1)).list).toHaveLength(1);
    expect((await listCustomers(db, parseCustomerFilters({}), 1)).list).toHaveLength(0); // sem dados de teste
    expect(await allCustomers(db, cf)).toHaveLength(2);

    const d = await customerDetail(db, a.id);
    expect(d!.flags.get(a1.id)?.opened).toBeTruthy();
    const html = await emailHtml(db, d!.emails.find((e) => e.templateKey === "upsell_1")!.id);
    expect(html!.preview).toBe(true);
    expect(html!.html).toContain("Yes, I want Nathan by my side");
    await close();
  });
});
