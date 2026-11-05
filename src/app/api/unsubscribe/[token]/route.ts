import { getDb } from "@/lib/db";
import { TEST_UNSUBSCRIBE_TOKEN, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { suppressCustomer } from "@/lib/pipeline/suppress";
import { clientIp, rateLimit } from "@/lib/util/rate-limit";

export const dynamic = "force-dynamic";

/** Descadastro em um clique (List-Unsubscribe-Post) e envio do formulário da página /u/[token]. */
export async function POST(req: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const db = getDb();
  if (!(await rateLimit(db, `unsub:${clientIp(req)}`, 30, 600))) return new Response("Too many requests", { status: 429 });
  if (token === TEST_UNSUBSCRIBE_TOKEN) return new Response("Test email: nothing to unsubscribe", { status: 200 });
  const customerId = verifyUnsubscribeToken(token);
  if (!customerId) return new Response("Invalid link", { status: 400 });
  await db.transaction((tx) => suppressCustomer(tx, customerId, "descadastro pelo link"));
  const fromForm = (req.headers.get("content-type") ?? "").includes("form") && !(await req.clone().text()).includes("List-Unsubscribe=One-Click");
  if (fromForm) return Response.redirect(new URL(`/u/${token}?done=1`, req.url), 303);
  return new Response("Unsubscribed", { status: 200 });
}
