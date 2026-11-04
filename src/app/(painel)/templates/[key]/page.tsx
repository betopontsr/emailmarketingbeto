import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { previewTemplate } from "@/lib/email/preview";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/engine/types";
import { one } from "@/lib/queries/common";
import { getSettings } from "@/lib/settings";
import { SendTest } from "./send-test";

export default async function TemplatePreview(props: PageProps<"/templates/[key]">) {
  const { key } = await props.params;
  if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) notFound();
  const sp = await props.searchParams;
  const k = key as TemplateKey;
  const flowB = one(sp.flow) === "b";
  const noName = one(sp.nome) === "0";
  const r = previewTemplate(k, await getSettings(getDb()), { flowB, firstName: noName ? null : undefined });
  return (
    <div className="space-y-3">
      <PageHeader title={TEMPLATE_INFO[k].label} description="Dados de exemplo: John, Nova York, enviado agora.">
        <Link href="/templates" className="text-sm underline">
          ← todos os e-mails
        </Link>
      </PageHeader>
      <div className="space-y-1 rounded-lg border p-3 text-sm">
        <div>
          <span className="text-muted-foreground">Assunto:</span> {r.subject}
        </div>
        <div>
          <span className="text-muted-foreground">Preview:</span> {r.preview}
        </div>
        <div className="flex flex-wrap gap-3 pt-1 text-xs">
          <Link className="underline" href={`?${new URLSearchParams({ ...(flowB ? { flow: "b" } : {}), ...(noName ? {} : { nome: "0" }) })}`}>
            {noName ? "com nome" : "sem nome"}
          </Link>
          {k === "rec_f3" && (
            <Link className="underline" href={flowB ? "?" : "?flow=b"}>
              {flowB ? "versão do Fluxo A" : "versão do Fluxo B"}
            </Link>
          )}
        </div>
      </div>
      <SendTest k={k} flowB={flowB} />
      <div className="grid gap-3 lg:grid-cols-2">
        <iframe title="HTML" sandbox="" srcDoc={r.html} className="h-[75vh] w-full rounded-lg border bg-white" />
        <pre className="h-[75vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs">{r.text}</pre>
      </div>
    </div>
  );
}
