"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fromAddressProblem, saveSettings, settingsSchema, type Settings } from "@/lib/settings";
import { isValidZone } from "@/lib/util/time";

export type SettingsState = { error?: string; ok?: boolean };

const BOOL_KEYS: (keyof Settings)[] = [
  "globalPause",
  "dryRun",
  "upsell1ScarcityEnabled",
  "upsell4Testimonial1Authorized",
  "upsell4Testimonial2Authorized",
  "recA2TestimonialAuthorized",
  "upsell6CreditEnabled",
  "recB1OtherPaymentEnabled",
];

export async function saveSettingsAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireAdminPage();
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(settingsSchema.shape) as (keyof Settings)[]) {
    if (BOOL_KEYS.includes(key)) raw[key] = fd.get(key) === "on";
    else if (fd.has(key)) raw[key] = String(fd.get(key) ?? "");
  }
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return { error: `Valor inválido em: ${p.error.issues.map((i) => i.path.join(".")).join(", ")}` };
  if (!isValidZone(p.data.defaultTimezone)) return { error: "Fuso padrão inválido (use um nome IANA, ex.: America/New_York)." };
  for (const k of ["emailFromAddress", "emailReplyTo", "supportEmail"] as const) {
    if (p.data[k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.data[k])) return { error: `E-mail inválido em ${k}.` };
  }
  if (p.data.emailFromAddress) {
    const problem = fromAddressProblem(p.data.emailFromAddress);
    if (problem) return { error: `Remetente: ${problem}.` };
  }
  if (p.data.supportWhatsappUrl && !/^https:\/\//.test(p.data.supportWhatsappUrl)) return { error: "O link de WhatsApp deve começar com https://" };
  await saveSettings(getDb(), p.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
