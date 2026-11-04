import { sql } from "drizzle-orm";
import { rateLimits } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";

/**
 * Janela fixa guardada no banco (funciona entre instâncias serverless).
 * Retorna true se a requisição está dentro do limite.
 */
export async function rateLimit(
  db: DbOrTx,
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = ${windowStart} then ${rateLimits.count} + 1 else 1 end`,
        windowStart,
      },
    })
    .returning({ count: rateLimits.count });
  return (rows[0]?.count ?? 1) <= limit;
}

export async function resetRateLimit(db: DbOrTx, key: string): Promise<void> {
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}

export function clientIp(req: Request | Headers): string {
  const h = req instanceof Headers ? req : req.headers;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}
