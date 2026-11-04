import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailStatusBadge, PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import type { TemplateKey } from "@/lib/engine/types";
import { emailHtml } from "@/lib/queries/customer-detail";
import { formatBr } from "@/lib/util/time";

export default async function EmailView(props: PageProps<"/clientes/[id]/email/[emailId]">) {
  const { id, emailId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(emailId)) notFound();
  const r = await emailHtml(getDb(), emailId);
  if (!r || String(r.email.customerId) !== id) notFound();
  return (
    <div className="space-y-3">
      <PageHeader title={TEMPLATE_INFO[r.email.templateKey as TemplateKey]?.label ?? r.email.templateKey} description={`Assunto: ${r.subject ?? ""}`}>
        <Link href={`/clientes/${id}`} className="text-sm underline">
          ← voltar ao cliente
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EmailStatusBadge status={r.email.status} />
        <span className="text-muted-foreground">{r.email.sentAt ? `enviado ${formatBr(r.email.sentAt)}` : `agendado ${formatBr(r.email.scheduledFor)}`}</span>
        {r.preview && <span className="text-amber-700">Prévia com as configurações atuais (o HTML final é gerado no envio).</span>}
      </div>
      <iframe title="e-mail" sandbox="" srcDoc={r.html} className="h-[75vh] w-full rounded-lg border bg-white" />
    </div>
  );
}
