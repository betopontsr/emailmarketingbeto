import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { deleteTestData, simulate } from "@/lib/simulator";
import { customers, purchases, scheduledEmails, webhookEvents } from "@/lib/db/schema";

const base = { email: "sim@example.com", name: "JOHN SMITH", country: "US", region: "CA" };

describe("simulador", () => {
  it("usa o pipeline do webhook, marca teste e o reembolso acha a última compra", async () => {
    const { db, close } = await createTestDb();
    expect((await simulate(db, { ...base, action: "abandon" })).status).toBe("processed");
    expect((await simulate(db, { ...base, action: "buy_main27" })).status).toBe("processed");
    expect((await simulate(db, { ...base, action: "buy_knots19" })).status).toBe("processed");
    const [c] = await db.select().from(customers);
    expect(c.isTest).toBe(true);
    expect(c.timezone).toBe("America/Los_Angeles");
    expect(c.firstName).toBe("John");
    const ps = await db.select().from(purchases);
    expect(ps.map((p) => p.productKey).sort()).toEqual(["knots", "main"]);
    expect((await simulate(db, { ...base, action: "refund" })).status).toBe("processed");
    const [c2] = await db.select().from(customers);
    expect(c2.suppressed).toBe(true);
    expect((await db.select().from(webhookEvents)).every((w) => w.isTest && w.provider === "simulator")).toBe(true);

    expect(await deleteTestData(db)).toBe(1);
    expect(await db.select().from(customers)).toHaveLength(0);
    expect(await db.select().from(scheduledEmails)).toHaveLength(0);
    await close();
  });
});
