// Aplica as migrations da pasta ./drizzle no banco de DATABASE_URL.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada.");
  console.error("Na Vercel: abra o projeto → Storage → crie/conecte um banco Neon (Postgres) a todos os ambientes → faça Redeploy.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migrations aplicadas.");
