import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { previewTemplate } from "@/lib/email/preview";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { TEMPLATE_KEYS } from "@/lib/engine/types";
import { getSettings } from "@/lib/settings";

export default async function Templates() {
  const s = await getSettings(getDb());
  return (
    <div>
      <PageHeader title="E-mails (prévia)" description="Os 12 e-mails com dados de exemplo e as configurações atuais." />
      <Table>
        <THead>
          <TR>
            <TH>E-mail</TH>
            <TH>Assunto</TH>
            <TH>Preview</TH>
          </TR>
        </THead>
        <TBody>
          {TEMPLATE_KEYS.map((k) => {
            const r = previewTemplate(k, s);
            return (
              <TR key={k}>
                <TD>
                  <Link href={`/templates/${k}`} className="font-medium underline-offset-2 hover:underline">
                    {TEMPLATE_INFO[k].label}
                  </Link>
                </TD>
                <TD className="text-sm">{r.subject}</TD>
                <TD className="text-xs text-muted-foreground">{r.preview}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
