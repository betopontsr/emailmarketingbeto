import { sql, type SQL } from "drizzle-orm";
import { DateTime } from "luxon";
import type { DbOrTx } from "@/lib/db/types";

export const PANEL_TZ = "America/Sao_Paulo";

export type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type Filters = { from: Date; to: Date; fromStr: string; toStr: string; includeTest: boolean };

/** Período (datas no fuso do painel) e "incluir dados de teste". Padrão: últimos 30 dias. */
export function parseFilters(sp: SP): Filters {
  const today = DateTime.now().setZone(PANEL_TZ);
  const f = DateTime.fromISO(one(sp.from), { zone: PANEL_TZ });
  const t = DateTime.fromISO(one(sp.to), { zone: PANEL_TZ });
  const from = (f.isValid ? f : today.minus({ days: 29 })).startOf("day");
  const to = (t.isValid ? t : today).endOf("day");
  return { from: from.toJSDate(), to: to.toJSDate(), fromStr: from.toISODate()!, toStr: to.toISODate()!, includeTest: one(sp.test) === "1" };
}

export async function rows<T>(db: DbOrTx, q: SQL): Promise<T[]> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}

/** Condição de teste para uma coluna is_test. */
export const testCond = (f: Filters, col: SQL) => (f.includeTest ? sql`true` : sql`${col} = false`);

export const n = (v: unknown) => Number(v ?? 0);

export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${((a / b) * 100).toFixed(1).replace(".", ",")}%`;
}

export function qs(sp: SP, patch: Record<string, string | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = one(v);
    if (s) p.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
