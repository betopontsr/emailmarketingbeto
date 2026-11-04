import { PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings, isDryRun, missingRequiredConfig } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function Configuracoes() {
  const s = await getSettings(getDb());
  const missing = missingRequiredConfig(s);
  return (
    <div>
      <PageHeader title="Configurações" description={isDryRun(s) ? "Modo atual: simulação." : "Modo atual: ENVIO REAL."} />
      {missing.length > 0 && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
          Falta para o envio real: {missing.join(", ")}.
        </p>
      )}
      <SettingsForm s={s} envDryRun={env().DRY_RUN !== false} />
    </div>
  );
}
