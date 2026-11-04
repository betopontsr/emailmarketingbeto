import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { customers, scheduledEmails } from "@/lib/db/schema";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import type { TemplateKey } from "@/lib/engine/types";
import { formatBr } from "@/lib/util/time";
import { advanceAction, deleteTestDataAction } from "./actions";
import { SimForm } from "./sim-form";

export default async function Simulador() {
  const db = getDb();
  const tests = await db.select().from(customers).where(eq(customers.isTest, true)).orderBy(desc(customers.createdAt)).limit(50);
  const next = await db
    .select({ customerId: scheduledEmails.customerId, templateKey: scheduledEmails.templateKey, at: scheduledEmails.scheduledFor })
    .from(scheduledEmails)
    .where(sql`${scheduledEmails.status} = 'scheduled' and ${scheduledEmails.isTest} = true`)
    .orderBy(asc(scheduledEmails.scheduledFor));
  const nextBy = new Map<number, { templateKey: string; at: Date; count: number }>();
  for (const n of next) {
    const cur = nextBy.get(n.customerId);
    if (cur) cur.count++;
    else nextBy.set(n.customerId, { templateKey: n.templateKey, at: n.at, count: 1 });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador"
        description="Cria eventos falsos pelo mesmo pipeline do webhook. Clientes de teste nunca recebem e-mail de verdade."
      />
      <SimForm />

      <section>
        <h2 className="mb-1 text-sm font-semibold">Clientes de teste</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          “Próximo e-mail agora” adianta o relógio só desse cliente até o próximo e-mail pendente e o processa. As regras (janela de silêncio no horário real, 1 por dia, 30 dias) continuam
          valendo.
        </p>
        <Table>
          <THead>
            <TR>
              <TH>Cliente</TH>
              <TH>Próximo e-mail</TH>
              <TH>Pendentes</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {tests.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-center text-muted-foreground">
                  Nenhum cliente de teste ainda.
                </TD>
              </TR>
            )}
            {tests.map((c) => {
              const n = nextBy.get(c.id);
              return (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/clientes/${c.id}`} className="underline-offset-2 hover:underline">
                      {c.email}
                    </Link>
                    {c.suppressed && (
                      <Badge variant="danger" className="ml-1">
                        suprimido
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-xs">{n ? `${TEMPLATE_INFO[n.templateKey as TemplateKey]?.label} · ${formatBr(n.at)}` : "—"}</TD>
                  <TD className="tabular-nums">{n?.count ?? 0}</TD>
                  <TD>
                    {n && (
                      <div className="flex flex-wrap gap-2">
                        <form action={advanceAction}>
                          <input type="hidden" name="customerId" value={c.id} />
                          <Button size="sm" variant="outline">
                            Próximo e-mail agora
                          </Button>
                        </form>
                        <form action={advanceAction}>
                          <input type="hidden" name="customerId" value={c.id} />
                          <input type="hidden" name="all" value="1" />
                          <Button size="sm" variant="ghost">
                            Até o fim
                          </Button>
                        </form>
                      </div>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </section>

      <form action={deleteTestDataAction}>
        <Button variant="destructive" size="sm">
          Apagar todos os dados de teste
        </Button>
      </form>
    </div>
  );
}
