import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { simEvent } from "./helpers/sim";
import { receiveAndProcess } from "@/lib/pipeline/run";
import { customers, flows, purchases, scheduledEmails } from "@/lib/db/schema";

const T0 = new Date("2026-11-04T15:00:00Z");

describe("pipeline com banco", () => {
  it("abandono → compra: cancela recuperação, cria upsell e registra compra", async () => {
    const { db, close } = await createTestDb();
    const r1 = await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }), isTest: true }, { now: T0 });
    expect(r1.status).toBe("processed");
    expect((await db.select().from(scheduledEmails)).map((e) => e.templateKey)).toEqual(["rec_a1", "rec_a2", "rec_f3"]);

    const t1 = new Date(T0.getTime() + 10 * 60_000);
    const r2 = await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: t1, tx: "TX1" }), isTest: true }, { now: t1 });
    expect(r2.status).toBe("processed");

    const emails = await db.select().from(scheduledEmails);
    expect(emails.filter((e) => e.templateKey.startsWith("rec_")).every((e) => e.status === "cancelled" && e.statusReason === "comprou")).toBe(true);
    expect(emails.filter((e) => e.templateKey.startsWith("upsell_"))).toHaveLength(7);
    const fl = await db.select().from(flows);
    expect(fl.find((f) => f.type === "recovery_a")?.status).toBe("cancelled");
    expect(fl.find((f) => f.type === "upsell")?.status).toBe("active");
    const [p] = await db.select().from(purchases);
    expect(p.transactionId).toBe("TX1");
    expect(p.attribution).toBe("direct");
    expect(p.isTest).toBe(true);

    // a mesma compra repetida (outro ID de evento, mesma transação) não cria nada
    const r3 = await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: t1, tx: "TX1" }), isTest: true }, { now: t1 });
    expect(r3.status).toBe("ignored");
    expect(await db.select().from(purchases)).toHaveLength(1);
    await close();
  });

  it("reembolso suprime o cliente", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: T0, tx: "M" }) }, { now: T0 });
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "refunded", at: T0, tx: "M" }) }, { now: T0 });
    const [c] = await db.select().from(customers);
    expect(c.suppressed).toBe(true);
    expect((await db.select().from(scheduledEmails).where(eq(scheduledEmails.status, "scheduled")))).toHaveLength(0);
    expect((await db.select().from(purchases))[0].status).toBe("refunded");
    await close();
  });
});
