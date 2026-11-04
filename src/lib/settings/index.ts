import { z } from "zod";
import { inArray, sql } from "drizzle-orm";
import { settings as settingsTable } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import { env } from "@/lib/env";
import { isValidZone } from "@/lib/util/time";

/**
 * Configurações editáveis no painel. Valores do banco têm prioridade;
 * quando não existem, valem as variáveis de ambiente e depois os padrões abaixo.
 */
export const settingsSchema = z.object({
  emailFromName: z.string().trim().default("Nathan Miller"),
  emailFromAddress: z.string().trim().default(""),
  emailReplyTo: z.string().trim().default(""),
  supportEmail: z.string().trim().default(""),
  supportWhatsappUrl: z.string().trim().default(""),
  postalAddress: z.string().trim().default(""),
  upsellHour: z.coerce.number().int().min(0).max(23).default(10),
  defaultTimezone: z.string().default("America/New_York"),
  quietStartHour: z.coerce.number().int().min(0).max(23).default(22),
  quietEndHour: z.coerce.number().int().min(0).max(23).default(7),
  quietResumeHour: z.coerce.number().int().min(0).max(23).default(8),
  maxLatenessHours: z.coerce.number().min(1).max(168).default(12),
  controlPercent: z.coerce.number().int().min(0).max(50).default(0),
  globalPause: z.boolean().default(false),
  dryRun: z.boolean().default(true),

  // Trechos opcionais (seção 8 do prompt)
  upsell1ScarcityEnabled: z.boolean().default(true),
  upsell1ScarcityText: z
    .string()
    .default("I limit how many people I support directly, so I can really answer every one of you."),
  upsell4Testimonial1Name: z.string().trim().default(""),
  upsell4Testimonial1Authorized: z.boolean().default(false),
  upsell4Testimonial2Name: z.string().trim().default(""),
  upsell4Testimonial2Authorized: z.boolean().default(false),
  recA2TestimonialName: z.string().trim().default("Evelyn"),
  recA2TestimonialAuthorized: z.boolean().default(false),
  upsell6CreditEnabled: z.boolean().default(false),
  upsell6CreditInstructions: z.string().trim().default(""),
  recB1OtherPaymentEnabled: z.boolean().default(false),
  recB1OtherPaymentText: z.string().trim().default("Or another payment method."),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

function envDefaults(): Partial<Settings> {
  const e = env();
  const d: Partial<Settings> = {};
  if (e.EMAIL_FROM_NAME) d.emailFromName = e.EMAIL_FROM_NAME;
  if (e.EMAIL_FROM_ADDRESS) d.emailFromAddress = e.EMAIL_FROM_ADDRESS;
  if (e.EMAIL_REPLY_TO) d.emailReplyTo = e.EMAIL_REPLY_TO;
  if (e.SUPPORT_EMAIL) d.supportEmail = e.SUPPORT_EMAIL;
  if (e.SUPPORT_WHATSAPP_URL) d.supportWhatsappUrl = e.SUPPORT_WHATSAPP_URL;
  if (e.POSTAL_ADDRESS) d.postalAddress = e.POSTAL_ADDRESS;
  return d;
}

export function parseSettings(stored: Record<string, unknown>): Settings {
  const merged = { ...envDefaults(), ...stored };
  // Valores inválidos no banco não derrubam o app: volta ao padrão campo a campo.
  const out: Record<string, unknown> = {};
  const shape = settingsSchema.shape;
  for (const key of Object.keys(shape) as SettingKey[]) {
    const r = shape[key].safeParse(merged[key]);
    out[key] = r.success ? r.data : shape[key].parse(undefined);
  }
  const s = out as Settings;
  if (!isValidZone(s.defaultTimezone)) s.defaultTimezone = "America/New_York";
  return s;
}

export async function getSettings(db: DbOrTx): Promise<Settings> {
  const rows = await db.select().from(settingsTable);
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.key] = r.value;
  return parseSettings(stored);
}

export async function saveSettings(db: DbOrTx, values: Partial<Settings>): Promise<void> {
  const entries = Object.entries(values).filter(([k]) => k in settingsSchema.shape);
  if (!entries.length) return;
  for (const [key, value] of entries) {
    await db
      .insert(settingsTable)
      .values({ key, value: value as unknown as object, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });
  }
}

export async function deleteSettings(db: DbOrTx, keys: SettingKey[]): Promise<void> {
  if (keys.length) await db.delete(settingsTable).where(inArray(settingsTable.key, keys));
}

/** Simulação vale se a variável DRY_RUN não for "false" OU se o painel estiver em simulação. */
export function isDryRun(s: Settings): boolean {
  return env().DRY_RUN !== false || s.dryRun;
}

/** Itens obrigatórios para envio real (seção 7, item 1). */
export function missingRequiredConfig(s: Settings): string[] {
  const missing: string[] = [];
  if (!s.emailFromAddress) missing.push("remetente (EMAIL_FROM_ADDRESS)");
  if (!s.postalAddress) missing.push("endereço postal (POSTAL_ADDRESS)");
  if (!s.supportEmail) missing.push("e-mail de suporte (SUPPORT_EMAIL)");
  if (!s.emailReplyTo) missing.push("reply-to (EMAIL_REPLY_TO)");
  if (!env().RESEND_API_KEY) missing.push("RESEND_API_KEY");
  return missing;
}
