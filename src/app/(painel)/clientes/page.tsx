import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader, Pager } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { PRODUCT_SHORT, type ProductKey } from "@/lib/events/types";
import { money, n, one, qs } from "@/lib/queries/common";
import { JOURNEY_LABELS, listCustomers, parseCustomerFilters } from "@/lib/queries/customers";
import { formatBr } from "@/lib/util/time";

const JOURNEY_VARIANT: Record<string, "info" | "warning" | "success" | "danger" | "outline"> = {
  upsell: "info",
  recovery_a: "warning",
  recovery_b: "warning",
  completed: "success",
  suppressed: "danger",
  none: "outline",
};

export default async function Clientes(props: PageProps<"/clientes">) {
  const sp = await props.searchParams;
  const f = parseCustomerFilters(sp);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { list, hasNext } = await listCustomers(getDb(), f, page);
  return (
    <div>
      <PageHeader title="Clientes">
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/painel/clientes${qs(sp, { page: null })}`}>
          Exportar CSV
        </a>
      </PageHeader>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="q">Busca</Label>
          <Input id="q" name="q" placeholder="nome ou e-mail" defaultValue={f.q} className="w-56" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="journey">Status da jornada</Label>
          <Select id="journey" name="journey" defaultValue={f.journey}>
            <option value="">todos</option>
            {Object.entries(JOURNEY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="product">Produto comprado</Label>
          <Select id="product" name="product" defaultValue={f.product}>
            <option value="">todos</option>
            <option value="main">Principal</option>
            <option value="nathan">Nathan</option>
            <option value="knots">Knots</option>
            <option value="reclaim">Reclaim</option>
            <option value="none">não comprou</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="flow">Passou pelo fluxo</Label>
          <Select id="flow" name="flow" defaultValue={f.flow}>
            <option value="">qualquer</option>
            <option value="upsell">Upsell</option>
            <option value="recovery_a">Recuperação A</option>
            <option value="recovery_b">Recuperação B</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="since">Entrada de</Label>
          <Input id="since" type="date" name="since" defaultValue={f.since} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="until">até</Label>
          <Input id="until" type="date" name="until" defaultValue={f.until} className="w-40" />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} /> incluir dados de teste
        </label>
        <Button type="submit" size="sm" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Table>
        <THead>
          <TR>
            <TH>Nome</TH>
            <TH>E-mail</TH>
            <TH>País</TH>
            <TH>Status</TH>
            <TH>Produtos</TH>
            <TH>Último evento</TH>
            <TH className="text-right">Enviados</TH>
            <TH className="text-right">Abertos (aprox.)</TH>
            <TH className="text-right">Receita</TH>
          </TR>
        </THead>
        <TBody>
          {list.length === 0 && (
            <TR>
              <TD colSpan={9} className="text-center text-muted-foreground">
                Nenhum cliente encontrado.
              </TD>
            </TR>
          )}
          {list.map((c) => (
            <TR key={c.id}>
              <TD>
                <Link href={`/clientes/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                  {c.full_name || c.first_name || "—"}
                </Link>
                {c.is_test && (
                  <Badge variant="outline" className="ml-1">
                    teste
                  </Badge>
                )}
              </TD>
              <TD className="text-muted-foreground">{c.email}</TD>
              <TD>{c.country ?? "—"}</TD>
              <TD>
                <Badge variant={JOURNEY_VARIANT[c.journey]}>{JOURNEY_LABELS[c.journey]}</Badge>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {(c.products ?? "")
                    .split(",")
                    .filter(Boolean)
                    .map((p) => (
                      <Badge key={p} variant="secondary">
                        {PRODUCT_SHORT[p as ProductKey] ?? p}
                      </Badge>
                    ))}
                </div>
              </TD>
              <TD className="max-w-64">
                <div className="truncate text-xs" title={c.last_event ?? ""}>
                  {c.last_event ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">{formatBr(c.last_event_at ? new Date(c.last_event_at) : null)}</div>
              </TD>
              <TD className="text-right tabular-nums">{n(c.emails_sent)}</TD>
              <TD className="text-right tabular-nums">{n(c.emails_opened)}</TD>
              <TD className="text-right tabular-nums">{money(n(c.revenue_cents))}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager sp={sp} page={page} hasNext={hasNext} base="/clientes" />
    </div>
  );
}
