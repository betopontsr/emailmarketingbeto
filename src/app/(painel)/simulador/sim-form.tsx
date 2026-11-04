"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SIM_ACTIONS } from "@/lib/simulator/labels";
import { simulateAction, type SimState } from "./actions";

export function SimForm() {
  const [state, action, pending] = useActionState<SimState, FormData>(simulateAction, {});
  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
      <div className="space-y-1 md:col-span-3">
        <Label htmlFor="action">Evento</Label>
        <Select id="action" name="action" className="w-full">
          {Object.entries(SIM_ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">E-mail do cliente de teste</Label>
        <Input id="email" name="email" type="email" required placeholder="teste1@example.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="John Smith (vazio = sem nome)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="country">País</Label>
          <Input id="country" name="country" defaultValue="US" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="region">Estado (EUA)</Label>
          <Input id="region" name="region" placeholder="NY, CA…" />
        </div>
      </div>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button disabled={pending}>{pending ? "Enviando…" : "Criar evento"}</Button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
