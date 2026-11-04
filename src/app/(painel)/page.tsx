import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FilterBar, PageHeader, Stat } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { PRODUCT_SHORT, type ProductKey } from "@/lib/events/types";
import { money, n, parseFilters } from "@/lib/queries/common";
import { overview } from "@/lib/queries/overview";

const ORIGIN: Record<string, string> = {
  direct: "Compra direta",
  recovery_email: "E-mail de recuperação",
  upsell_email: "E-mail de upsell",
};

export default async function VisaoGeral(props: PageProps<"/">) {
  const f = parseFilters(await props.searchParams);
  const o = await overview(getDb(), f);
  const totalCents = o.revenue.reduce((s, r) => s + n(r.cents), 0);
  const totalBuys = o.revenue.reduce((s, r) => s + n(r.count), 0);
  return (
    <div>
      <PageHeader title="Visão geral" description="Números do período escolhido. “Agora” mostra o estado atual." />
      <FilterBar f={f} />

      {o.alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {o.alerts.map((a) => (
            <div
              key={a.text}
              className={
                "flex items-center justify-between rounded-md border px-3 py-2 text-sm " +
                (a.level === "danger" ? "border-red-300 bg-red-50 dark:bg-red-950/30" : a.level === "warning" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-sky-300 bg-sky-50 dark:bg-sky-950/30")
              }
            >
              <span>{a.text}</span>
              {a.href && (
                <Link href={a.href} className="text-xs underline">
                  ver
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Eventos recebidos" value={n(o.events.total)} hint={`${n(o.events.processed)} processados · ${n(o.events.dup)} duplicados`} />
        <Stat label="Clientes novos" value={n(o.cust.created)} hint={`${n(o.cust.total)} no total · ${n(o.cust.suppressed)} suprimidos`} />
        <Stat label="Agora em upsell" value={o.activeFlows.upsell ?? 0} />
        <Stat
          label="Agora em recuperação"
          value={(o.activeFlows.recovery_a ?? 0) + (o.activeFlows.recovery_b ?? 0)}
          hint={`A: ${o.activeFlows.recovery_a ?? 0} · B: ${o.activeFlows.recovery_b ?? 0}`}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">E-mails</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Stat label="Enviados" value={n(o.emails.sent)} />
        <Stat label="Simulados" value={n(o.emails.dry)} />
        <Stat label="Entregues" value={n(o.ev.delivered)} />
        <Stat label="Abertos (aprox.)" value={n(o.ev.opened)} />
        <Stat label="Clicados" value={n(o.ev.clicked)} />
        <Stat label="Bounces" value={n(o.ev.bounced)} />
        <Stat label="Spam" value={n(o.ev.complained)} />
        <Stat label="Descadastros" value={o.unsub} />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Compras e receita por origem</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Compras" value={totalBuys} />
        <Stat label="Receita" value={money(totalCents)} hint="Soma dos valores do webhook (moeda informada pela Perfect Pay)" />
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">Atribuição</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Recuperação: último e-mail de recuperação nos 7 dias antes da compra. Upsell: último e-mail daquela oferta.
          </CardContent>
        </Card>
      </div>
      <div className="mt-3">
        <Table>
          <THead>
            <TR>
              <TH>Produto</TH>
              <TH>Origem</TH>
              <TH className="text-right">Compras</TH>
              <TH className="text-right">Receita</TH>
            </TR>
          </THead>
          <TBody>
            {o.revenue.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma compra no período.
                </TD>
              </TR>
            )}
            {o.revenue.map((r) => (
              <TR key={r.product_key + r.origin}>
                <TD>
                  <Badge variant="secondary">{PRODUCT_SHORT[r.product_key as ProductKey] ?? r.product_key}</Badge>
                </TD>
                <TD>{ORIGIN[r.origin] ?? r.origin}</TD>
                <TD className="text-right tabular-nums">{n(r.count)}</TD>
                <TD className="text-right tabular-nums">{money(n(r.cents), r.currency ?? "USD")}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
