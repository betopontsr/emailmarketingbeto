import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import type { Db } from "./types";

declare global {
  var __funilDb: Db | undefined;
  var __funilPool: Pool | undefined;
}

/** Conexão única por instância (reaproveitada entre requisições). */
export function getDb(): Db {
  if (globalThis.__funilDb) return globalThis.__funilDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const pool = new Pool({ connectionString: url, max: 5 });
  globalThis.__funilPool = pool;
  globalThis.__funilDb = drizzle(pool, { schema }) as unknown as Db;
  return globalThis.__funilDb;
}
