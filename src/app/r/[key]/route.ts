import { LINKS, type LinkKey } from "@/emails/links";

export const dynamic = "force-dynamic";

/** Redireciona os botões dos e-mails (domínio próprio) para o checkout da Perfect Pay. */
export async function GET(req: Request, ctx: RouteContext<"/r/[key]">) {
  const { key } = await ctx.params;
  if (!Object.prototype.hasOwnProperty.call(LINKS, key)) return new Response("Not found", { status: 404 });
  const target = new URL(LINKS[key as LinkKey]);
  // Mantém parâmetros (ex.: utm) que vierem no link
  new URL(req.url).searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return Response.redirect(target.toString(), 302);
}
