"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { Settings } from "@/lib/settings";
import { saveSettingsAction, type SettingsState } from "./actions";

function Field({ name, label, s, type = "text", hint }: { name: keyof Settings; label: string; s: Settings; type?: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={String(s[name] ?? "")} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Check({ name, label, s, hint }: { name: keyof Settings; label: string; s: Settings; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={Boolean(s[name])} className="mt-1" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsForm({ s, envDryRun }: { s: Settings; envDryRun: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Envio</CardTitle>
          <CardDescription>
            Envio real só acontece com a variável DRY_RUN=false na Vercel <b>e</b> a chave abaixo desligada. Variável agora: DRY_RUN={envDryRun ? "true" : "false"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Check name="dryRun" label="Simulação (DRY_RUN) — nada é enviado de verdade" s={s} />
          <Check name="globalPause" label="Pausa global — o dispatcher não processa nenhum e-mail" s={s} hint="Os e-mails ficam na fila; se a pausa passar do limite de atraso, eles expiram." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remetente e contato</CardTitle>
          <CardDescription>Valores salvos aqui têm prioridade sobre as variáveis de ambiente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field name="emailFromName" label="Nome do remetente" s={s} />
          <Field name="emailFromAddress" label="E-mail do remetente (domínio verificado no Resend)" s={s} />
          <Field name="emailReplyTo" label="Reply-to (uma pessoa real lê)" s={s} />
          <Field name="supportEmail" label="E-mail de suporte (rec_a2)" s={s} />
          <Field name="supportWhatsappUrl" label="Link de WhatsApp (opcional, rec_a2 e rec_b1)" s={s} hint="Sem link, os e-mails usam só “reply to this email”." />
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="postalAddress">Endereço postal (rodapé, exigido pelo CAN-SPAM)</Label>
            <Textarea id="postalAddress" name="postalAddress" defaultValue={s.postalAddress} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horários e regras</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Field name="upsellHour" label="Hora dos upsells (fuso do cliente)" type="number" s={s} />
          <Field name="defaultTimezone" label="Fuso padrão (sem fuso do cliente)" s={s} />
          <Field name="maxLatenessHours" label="MAX_LATENESS_HORAS" type="number" s={s} hint="E-mail mais atrasado que isso expira." />
          <Field name="quietStartHour" label="Silêncio começa (h)" type="number" s={s} />
          <Field name="quietEndHour" label="Silêncio termina (h)" type="number" s={s} />
          <Field name="quietResumeHour" label="Adiar para (h)" type="number" s={s} />
          <Field name="controlPercent" label="% do grupo de controle (recuperação)" type="number" s={s} hint="0 = desligado. Máximo 50." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trechos opcionais dos e-mails</CardTitle>
          <CardDescription>Só ligue o que for verdade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Check name="upsell1ScarcityEnabled" label="upsell_1: P.S. de escassez" s={s} />
            <Textarea name="upsell1ScarcityText" defaultValue={s.upsell1ScarcityText} />
            <p className="text-xs text-muted-foreground">Sai como “P.S. ” + este texto.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Field name="upsell4Testimonial1Name" label="upsell_4: nome do 1º depoimento" s={s} />
              <Check name="upsell4Testimonial1Authorized" label="autorizado" s={s} />
            </div>
            <div className="space-y-2">
              <Field name="upsell4Testimonial2Name" label="upsell_4: nome do 2º depoimento" s={s} />
              <Check name="upsell4Testimonial2Authorized" label="autorizado" s={s} />
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">O bloco de depoimentos do upsell_4 só aparece com os dois preenchidos e autorizados (o texto fala em “two students”).</p>
            <div className="space-y-2">
              <Field name="recA2TestimonialName" label="rec_a2: nome do depoimento" s={s} />
              <Check name="recA2TestimonialAuthorized" label="autorizado" s={s} />
            </div>
          </div>
          <div className="space-y-2">
            <Check name="upsell6CreditEnabled" label="upsell_6: parágrafo do crédito de $47" s={s} />
            <Textarea name="upsell6CreditInstructions" defaultValue={s.upsell6CreditInstructions} placeholder="Instruções de como usar o crédito (obrigatório para o parágrafo aparecer)" />
          </div>
          <div className="space-y-2">
            <Check name="recB1OtherPaymentEnabled" label="rec_b1: frase de outra forma de pagamento" s={s} />
            <Input name="recB1OtherPaymentText" defaultValue={s.recB1OtherPaymentText} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Salvando…" : "Salvar configurações"}</Button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-700">Salvo.</span>}
      </div>
    </form>
  );
}
