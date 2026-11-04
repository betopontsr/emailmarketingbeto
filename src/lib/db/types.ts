import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Tipo comum para node-postgres (produção) e PGlite (testes). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Aceita o banco ou uma transação aberta. */
export type DbOrTx = Db | Tx;
