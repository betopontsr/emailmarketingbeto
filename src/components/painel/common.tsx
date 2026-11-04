import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Filters, SP } from "@/lib/queries/common";
import { qs } from "@/lib/queries/common";
import { EMAIL_STATUS_LABELS, type EmailStatus } from "@/lib/engine/types";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

/** Filtro de período + "incluir dados de teste" (formulário GET, funciona sem JavaScript). */
export function FilterBar({ f, extra, children }: { f: Filters; extra?: Record<string, string>; children?: React.ReactNode }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3">
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="space-y-1">
        <Label htmlFor="from">De</Label>
        <Input id="from" type="date" name="from" defaultValue={f.fromStr} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Até</Label>
        <Input id="to" type="date" name="to" defaultValue={f.toStr} className="w-40" />
      </div>
      {children}
      <label className="flex h-9 items-center gap-2 text-sm">
        <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} /> incluir dados de teste
      </label>
      <Button type="submit" size="sm" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

const EMAIL_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "secondary" | "outline"> = {
  scheduled: "info",
  sending: "info",
  sent: "success",
  dry_run: "secondary",
  skipped: "outline",
  cancelled: "outline",
  failed: "danger",
  expired: "warning",
};

export function EmailStatusBadge({ status }: { status: string }) {
  return <Badge variant={EMAIL_VARIANT[status] ?? "outline"}>{EMAIL_STATUS_LABELS[status as EmailStatus] ?? status}</Badge>;
}

const EVENT_STATUS: Record<string, { label: string; v: "success" | "warning" | "danger" | "info" | "secondary" | "outline" }> = {
  received: { label: "recebido", v: "info" },
  processed: { label: "processado", v: "success" },
  duplicate: { label: "duplicado", v: "outline" },
  ignored: { label: "ignorado", v: "secondary" },
  error: { label: "erro", v: "danger" },
  unmapped: { label: "não mapeado", v: "warning" },
  unrecognized: { label: "não reconhecido", v: "warning" },
};
export const EVENT_STATUS_LABELS = Object.fromEntries(Object.entries(EVENT_STATUS).map(([k, v]) => [k, v.label]));

export function EventStatusBadge({ status }: { status: string }) {
  const s = EVENT_STATUS[status] ?? { label: status, v: "outline" as const };
  return <Badge variant={s.v}>{s.label}</Badge>;
}

export function Pager({ sp, page, hasNext, base }: { sp: SP; page: number; hasNext: boolean; base: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      {page > 1 ? <Link className="underline" href={`${base}${qs(sp, { page: String(page - 1) })}`}>← anterior</Link> : <span className="text-muted-foreground">← anterior</span>}
      <span className="text-muted-foreground">página {page}</span>
      {hasNext ? <Link className="underline" href={`${base}${qs(sp, { page: String(page + 1) })}`}>próxima →</Link> : <span className="text-muted-foreground">próxima →</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}
