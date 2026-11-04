import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  PERFECTPAY_WEBHOOK_SECRET: z.string().optional(),
  PERFECTPAY_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  SUPPORT_EMAIL: z.string().optional(),
  SUPPORT_WHATSAPP_URL: z.string().optional(),
  POSTAL_ADDRESS: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  DRY_RUN: bool,
  TEST_EMAIL_TO: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

/** Lê as variáveis de ambiente a cada chamada (fácil de trocar nos testes). */
export function env(): Env {
  const e = schema.parse(process.env);
  // Sem a variável, o app fica SEMPRE em simulação.
  if (e.DRY_RUN === undefined) e.DRY_RUN = true;
  return e;
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const v = env()[key];
  if (v === undefined || v === null || v === "") throw new Error(`Variável de ambiente ${String(key)} não configurada`);
  return v as NonNullable<Env[K]>;
}

export function baseUrl(): string {
  return (env().APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
