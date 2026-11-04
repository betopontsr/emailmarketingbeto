import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EventStatusBadge, PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { formatBr } from "@/lib/util/time";
import { reprocessAction } from "../actions";

export default async function Evento(props: PageProps<"/eventos/[id]">) {
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();
  const [w] = await getDb().select().from(webhookEvents).where(eq(webhookEvents.id, Number(id)));
  if (!w) notFound();
  return (
    <div className="space-y-4">
      <PageHeader title={`Evento #${w.id}`} description={`${w.provider} · recebido ${formatBr(w.receivedAt)} · chave ${w.dedupeKey}`}>
        <Link href="/eventos" className="text-sm underline">
          ← eventos
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <EventStatusBadge status={w.status} />
        <span className="text-muted-foreground">{w.error ?? w.statusReason}</span>
        {!w.isDuplicate && (
          <form action={reprocessAction}>
            <input type="hidden" name="eventId" value={w.id} />
            <Button size="sm" variant="outline">
              Reprocessar
            </Button>
          </form>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-1 text-sm font-semibold">Payload bruto</h2>
          <pre className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{JSON.stringify(w.rawPayload, null, 2)}</pre>
        </div>
        <div>
          <h2 className="mb-1 text-sm font-semibold">Evento normalizado</h2>
          <pre className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{w.normalized ? JSON.stringify(w.normalized, null, 2) : "—"}</pre>
        </div>
      </div>
    </div>
  );
}
