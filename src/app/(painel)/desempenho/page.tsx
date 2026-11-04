import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmailStatusBadge, FilterBar, PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/engine/types";
import { PRODUCT_LABELS, type ProductKey } from "@/lib/events/types";
import { money, n, parseFilters, pct } from "@/lib/queries/common";
import { performance, type TemplateStats } from "@/lib/queries/performance";

const FLOW: Record<string, string> = { recovery_a: "Fluxo A (abandono)", recovery_b: "Fluxo B (cartão recusado)" };

export default async function Desempenho(props: PageProps<"/desempenho">) {
  const f = parseFilters(await props.searchParams);
  const p = await performance(getDb(), f);
  const by = new Map(p.perTemplate.map((t) => [t.template_key, t]));
  const get = (k: string): TemplateStats | undefined => by.get(k);
  const conv = (k: string) => {
    const t = get(k);
    return t ? { sent: n(t.sent), buys: n(t.purchases), cents: n(t.revenue_cents) } : { sent: 0, buys: 0, cents: 0 };
  };
  const f3 = conv("rec_f3");
  const a2 = conv("rec_a2");
  const hasControl = p.recovery.some((r) => r.is_control);

  return (
    <div className="space-y-6">
      <PageHeader title="Desempenho" description="Por e-mail agendado no período. Aberturas são aproximadas (proteções de privacidade inflam o número): dê mais peso a cliques e compras." />
      <FilterBar f={f} />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Por e-mail</h2>
        <Table>
          <THead>
            <TR>
              <TH>E-mail</TH>
              <TH className="text-right">Agend.</TH>
              <TH className="text-right">Enviados</TH>
              <TH className="text-right">Pulados</TH>
              <TH className="text-right">Entregues</TH>
              <TH className="text-right">Aberturas (aprox.)</TH>
              <TH className="text-right">Cliques</TH>
              <TH className="text-right">Compras</TH>
              <TH className="text-right">Receita</TH>
              <TH className="text-right">Conversão</TH>
              <TH className="text-right">Descad.</TH>
              <TH className="text-right">Bounce</TH>
              <TH className="text-right">Spam</TH>
            </TR>
          </THead>
          <TBody>
            {TEMPLATE_KEYS.map((k) => {
              const t = get(k);
              const sent = n(t?.sent);
              return (
                <TR key={k}>
                  <TD className="whitespace-nowrap text-xs font-medium">{TEMPLATE_INFO[k].label}</TD>
                  <TD className="text-right tabular-nums">{n(t?.scheduled)}</TD>
                  <TD className="text-right tabular-nums">{sent}</TD>
                  <TD className="text-right tabular-nums" title="pulados + cancelados + expirados + falhos">
                    {n(t?.skipped) + n(t?.cancelled) + n(t?.expired) + n(t?.failed)}
                  </TD>
                  <TD className="text-right tabular-nums">{n(t?.delivered)}</TD>
                  <TD className="text-right tabular-nums">
                    {n(t?.opened)} <span className="text-xs text-muted-foreground">{pct(n(t?.opened), sent)}</span>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {n(t?.clicked)} <span className="text-xs text-muted-foreground">{pct(n(t?.clicked), sent)}</span>
                  </TD>
                  <TD className="text-right tabular-nums font-medium">{n(t?.purchases)}</TD>
                  <TD className="text-right tabular-nums">{money(n(t?.revenue_cents))}</TD>
                  <TD className="text-right tabular-nums">{pct(n(t?.purchases), sent)}</TD>
                  <TD className="text-right tabular-nums">{n(t?.unsubscribes)}</TD>
                  <TD className="text-right tabular-nums">{n(t?.bounced)}</TD>
                  <TD className="text-right tabular-nums">{n(t?.complained)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <p className="mt-1 text-xs text-muted-foreground">“Enviados” inclui os simulados (DRY_RUN). Conversão = compras atribuídas ÷ enviados.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Taxa de recuperação por fluxo</CardTitle>
            <CardDescription>Compras do principal em até 7 dias ÷ eventos de abandono ou recusa (fluxos iniciados no período).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Fluxo</TH>
                  <TH className="text-right">Eventos</TH>
                  <TH className="text-right">Recuperados</TH>
                  <TH className="text-right">Taxa</TH>
                  <TH className="text-right">Receita</TH>
                  <TH className="text-right">Upsell dos recuperados</TH>
                </TR>
              </THead>
              <TBody>
                {p.recovery.length === 0 && (
                  <TR>
                    <TD colSpan={6} className="text-center text-muted-foreground">
                      Sem dados no período.
                    </TD>
                  </TR>
                )}
                {p.recovery.map((r) => (
                  <TR key={r.type + r.is_control}>
                    <TD className="text-xs">
                      {FLOW[r.type]}
                      {r.is_control ? " — controle (sem e-mail)" : ""}
                    </TD>
                    <TD className="text-right tabular-nums">{n(r.flows)}</TD>
                    <TD className="text-right tabular-nums">{n(r.recovered)}</TD>
                    <TD className="text-right tabular-nums font-medium">{pct(n(r.recovered), n(r.flows))}</TD>
                    <TD className="text-right tabular-nums">{money(n(r.revenue_cents))}</TD>
                    <TD className="text-right tabular-nums">{money(n(r.upsell_cents))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!hasControl && <p className="mt-2 text-xs text-muted-foreground">Grupo de controle desligado (Configurações → % do grupo de controle).</p>}
            {hasControl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Compare a taxa do grupo de controle com a do fluxo normal: a diferença é o efeito real dos e-mails. Só vale com volume.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>F3 com desconto × A2 sem desconto</CardTitle>
            <CardDescription>Se o F3 não trouxer vendas a mais que o A2, o anexo sugere tirar o desconto.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>E-mail</TH>
                  <TH className="text-right">Enviados</TH>
                  <TH className="text-right">Compras</TH>
                  <TH className="text-right">Conversão</TH>
                  <TH className="text-right">Receita</TH>
                  <TH className="text-right">Receita por envio</TH>
                </TR>
              </THead>
              <TBody>
                {[
                  ["rec_a2", "A2 · $47 (sem desconto)", a2],
                  ["rec_f3", "F3 · $27 (desconto)", f3],
                ].map(([k, label, c]) => {
                  const v = c as typeof f3;
                  return (
                    <TR key={k as string}>
                      <TD className="text-xs">{label as string}</TD>
                      <TD className="text-right tabular-nums">{v.sent}</TD>
                      <TD className="text-right tabular-nums">{v.buys}</TD>
                      <TD className="text-right tabular-nums font-medium">{pct(v.buys, v.sent)}</TD>
                      <TD className="text-right tabular-nums">{money(v.cents)}</TD>
                      <TD className="text-right tabular-nums">{v.sent ? money(Math.round(v.cents / v.sent)) : "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversão por oferta de upsell</CardTitle>
            <CardDescription>Compradores do principal com fluxo de upsell iniciado no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Oferta</TH>
                  <TH className="text-right">Compradores do principal</TH>
                  <TH className="text-right">Compraram</TH>
                  <TH className="text-right">Via e-mail</TH>
                  <TH className="text-right">Conversão</TH>
                  <TH className="text-right">Receita</TH>
                </TR>
              </THead>
              <TBody>
                {p.offers.map((o) => (
                  <TR key={o.offer}>
                    <TD className="text-xs">{PRODUCT_LABELS[o.offer as ProductKey]}</TD>
                    <TD className="text-right tabular-nums">{n(o.flows)}</TD>
                    <TD className="text-right tabular-nums">{n(o.buyers)}</TD>
                    <TD className="text-right tabular-nums">{n(o.via_email)}</TD>
                    <TD className="text-right tabular-nums font-medium">{pct(n(o.buyers), n(o.flows))}</TD>
                    <TD className="text-right tabular-nums">{money(n(o.revenue_cents))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">“Compraram” inclui quem comprou na página de upsell logo após o principal (sem e-mail).</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pulados, cancelados, expirados e falhos por motivo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>E-mail</TH>
                  <TH>Status</TH>
                  <TH>Motivo</TH>
                  <TH className="text-right">Qtde</TH>
                </TR>
              </THead>
              <TBody>
                {p.skipReasons.length === 0 && (
                  <TR>
                    <TD colSpan={4} className="text-center text-muted-foreground">
                      Nenhum.
                    </TD>
                  </TR>
                )}
                {p.skipReasons.map((r, i) => (
                  <TR key={i}>
                    <TD className="text-xs">{TEMPLATE_INFO[r.template_key as TemplateKey]?.label ?? r.template_key}</TD>
                    <TD>
                      <EmailStatusBadge status={r.status} />
                    </TD>
                    <TD className="text-xs text-muted-foreground">{r.reason ?? "—"}</TD>
                    <TD className="text-right tabular-nums">{n(r.count)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
