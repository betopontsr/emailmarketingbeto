import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function getAdmin(): Promise<{ email: string } | null> {
  const secret = env().SESSION_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const p = verifySessionToken(jar.get(SESSION_COOKIE)?.value, secret);
  if (!p) return null;
  const admin = env().ADMIN_EMAIL?.toLowerCase();
  if (!admin || p.e !== admin) return null;
  return { email: p.e };
}

/** Para páginas: redireciona ao login se não houver sessão. */
export async function requireAdminPage(): Promise<{ email: string }> {
  const a = await getAdmin();
  if (!a) redirect("/login");
  return a;
}

/** Para APIs do painel: devolve uma resposta 401 se não houver sessão. */
export async function requireAdminApi(): Promise<Response | null> {
  const a = await getAdmin();
  return a ? null : Response.json({ error: "não autorizado" }, { status: 401 });
}
