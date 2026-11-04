"use server";

import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { previewTemplate } from "@/lib/email/preview";
import { resendSender } from "@/lib/email/sender";
import { TEMPLATE_KEYS } from "@/lib/engine/types";
import { getSettings } from "@/lib/settings";

export type TestState = { error?: string; ok?: string };

/** Envia a prévia para o seu e-mail (TEST_EMAIL_TO ou ADMIN_EMAIL). Não afeta nenhum cliente. */
export async function sendTestAction(_: TestState, fd: FormData): Promise<TestState> {
  const admin = await requireAdminPage();
  const key = z.enum(TEMPLATE_KEYS).parse(fd.get("key"));
  const s = await getSettings(getDb());
  const to = env().TEST_EMAIL_TO || admin.email;
  if (!env().RESEND_API_KEY) return { error: "RESEND_API_KEY não configurada." };
  if (!s.emailFromAddress) return { error: "Configure o e-mail do remetente primeiro." };
  const r = previewTemplate(key, s, { flowB: fd.get("flowB") === "1" });
  const res = await resendSender().send({
    from: `${s.emailFromName} <${s.emailFromAddress}>`,
    to,
    replyTo: s.emailReplyTo || undefined,
    subject: `[TESTE] ${r.subject}`,
    html: r.html,
    text: r.text,
    headers: {},
    tags: [{ name: "template", value: key }, { name: "test", value: "1" }],
    idempotencyKey: `test/${key}/${Date.now()}`,
  });
  return res.ok ? { ok: `Enviado para ${to}.` } : { error: res.error };
}
