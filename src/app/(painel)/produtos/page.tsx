import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { productMappings } from "@/lib/db/schema";
import { PRODUCT_LABELS, type ProductKey } from "@/lib/events/types";
import { MATCH_TYPE_LABELS } from "@/lib/products/resolve";
import { rows } from "@/lib/queries/common";
import { deleteMappingAction } from "./actions";
import { AddMappingForm } from "./add-form";

export default async function Produtos() {
  const db = getDb();
  const maps = await db.select().from(productMappings).orderBy(asc(productMappings.productKey), asc(productMappings.id));
  const unmapped = await rows<{ code: string | null; plan: string | null; offer: string | null; name: string | null; count: string }>(
    db,
    sql`select normalized->'product'->>'code' code, normalized->'product'->>'planCode' plan,
          normalized->'product'->>'offerCode' offer, normalized->'product'->>'name' name, count(*) count
        from webhook_events where status = 'unmapped' group by 1, 2, 3, 4 order by count(*) desc limit 50`,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Liga os códigos que a Perfect Pay manda no webhook aos 4 produtos do funil. Preço cheio e reduzido do mesmo produto apontam para a mesma chave."
      />
      <AddMappingForm />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Mapeamentos</h2>
        <Table>
          <THead>
            <TR>
              <TH>Produto</TH>
              <TH>Tipo</TH>
              <TH>Valor</TH>
              <TH>Descrição</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {maps.map((m) => (
              <TR key={m.id}>
                <TD>
                  <Badge variant="secondary">{PRODUCT_LABELS[m.productKey as ProductKey] ?? m.productKey}</Badge>
                </TD>
                <TD className="text-xs">{MATCH_TYPE_LABELS[m.matchType as keyof typeof MATCH_TYPE_LABELS] ?? m.matchType}</TD>
                <TD className="font-mono text-xs">{m.value}</TD>
                <TD className="text-xs text-muted-foreground">{m.label ?? "—"}</TD>
                <TD>
                  <form action={deleteMappingAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-red-600 underline">remover</button>
                  </form>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Os códigos PPU dos links de checkout vieram pré-cadastrados como referência. Eles podem não ser os mesmos que a Perfect Pay manda no webhook.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Produtos não mapeados recebidos</h2>
        {unmapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Código do produto</TH>
                <TH>Plano</TH>
                <TH>Oferta</TH>
                <TH>Nome</TH>
                <TH className="text-right">Eventos</TH>
              </TR>
            </THead>
            <TBody>
              {unmapped.map((u, i) => (
                <TR key={i}>
                  <TD className="font-mono text-xs">{u.code ?? "—"}</TD>
                  <TD className="font-mono text-xs">{u.plan ?? "—"}</TD>
                  <TD className="font-mono text-xs">{u.offer ?? "—"}</TD>
                  <TD className="text-xs">{u.name ?? "—"}</TD>
                  <TD className="text-right">
                    <Link href="/eventos?status=unmapped" className="underline">
                      {u.count}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Eventos de outros produtos seus aparecem aqui também: só mapeie os 4 produtos do funil.</p>
      </section>
    </div>
  );
}
