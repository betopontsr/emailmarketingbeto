"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/util/rate-limit";

const form = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const parsed = form.safeParse({ email: fd.get("email"), password: fd.get("password") });
  const typed = String(fd.get("email") ?? "").slice(0, 200);
  if (!parsed.success) return { error: "Preencha e-mail e senha.", email: typed };

  const e = env();
  if (!e.ADMIN_EMAIL || !e.ADMIN_PASSWORD_HASH || !e.SESSION_SECRET) {
    return { error: "Login não configurado: defina ADMIN_EMAIL, ADMIN_PASSWORD_HASH e SESSION_SECRET." };
  }

  const db = getDb();
  const ip = clientIp(await headers());
  const key = `login:${ip}`;
  // 5 tentativas a cada 15 minutos por IP
  if (!(await rateLimit(db, key, 5, 15 * 60))) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente de novo.", email: typed };
  }

  const emailOk = parsed.data.email === e.ADMIN_EMAIL.toLowerCase();
  const passOk = await bcrypt.compare(parsed.data.password, e.ADMIN_PASSWORD_HASH);
  if (!emailOk || !passOk) return { error: "E-mail ou senha incorretos.", email: typed };

  await resetRateLimit(db, key);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(parsed.data.email, e.SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
