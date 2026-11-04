import { Resend } from "resend";
import { env } from "@/lib/env";

export type SendInput = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  tags: { name: string; value: string }[];
  idempotencyKey: string;
};
export type SendResult = { ok: true; id: string } | { ok: false; transient: boolean; error: string };
export interface Sender {
  send(i: SendInput): Promise<SendResult>;
}

const TRANSIENT = new Set(["rate_limit_exceeded", "internal_server_error", "application_error", "concurrent_idempotent_requests"]);

/** Valores de tag do Resend: só letras, números, _ e -. */
export const tagValue = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);

export function resendSender(): Sender {
  const key = env().RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  const client = new Resend(key);
  return {
    async send(i) {
      try {
        const r = await client.emails.send(
          { from: i.from, to: i.to, replyTo: i.replyTo, subject: i.subject, html: i.html, text: i.text, headers: i.headers, tags: i.tags },
          { idempotencyKey: i.idempotencyKey },
        );
        if (r.error) {
          const transient = TRANSIENT.has(r.error.name) || r.error.statusCode === null || (r.error.statusCode ?? 0) >= 500;
          return { ok: false, transient, error: `${r.error.name}: ${r.error.message}` };
        }
        return { ok: true, id: r.data.id };
      } catch (err) {
        // Erro de rede: tenta de novo
        return { ok: false, transient: true, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
