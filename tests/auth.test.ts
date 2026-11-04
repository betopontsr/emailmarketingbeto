import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { createTestDb } from "./helpers/db";
import { rateLimit } from "@/lib/util/rate-limit";

describe("sessão do painel", () => {
  it("aceita token válido e rejeita adulterado ou vencido", () => {
    const t = createSessionToken("admin@x.com", "s1", 1_000_000);
    expect(verifySessionToken(t, "s1", 1_000_000)?.e).toBe("admin@x.com");
    expect(verifySessionToken(t, "outro", 1_000_000)).toBeNull();
    expect(verifySessionToken(t.replace(/.$/, "x"), "s1", 1_000_000)).toBeNull();
    expect(verifySessionToken(t, "s1", 1_000_000 + 13 * 3600 * 1000)).toBeNull();
  });
});

describe("limite de tentativas", () => {
  it("bloqueia depois do limite e libera na janela seguinte", async () => {
    const { db, close } = await createTestDb();
    const now = new Date("2026-11-04T12:00:00Z");
    for (let i = 0; i < 5; i++) expect(await rateLimit(db, "k", 5, 900, now)).toBe(true);
    expect(await rateLimit(db, "k", 5, 900, now)).toBe(false);
    expect(await rateLimit(db, "k", 5, 900, new Date(now.getTime() + 901_000))).toBe(true);
    await close();
  });
});

describe("migrations", () => {
  it("pré-cadastram os 8 códigos PPU", async () => {
    const { db, close } = await createTestDb();
    const rows = await db.query.productMappings.findMany();
    expect(rows).toHaveLength(8);
    await close();
  });
});
