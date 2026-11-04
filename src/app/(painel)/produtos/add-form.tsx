"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PRODUCT_KEYS, PRODUCT_LABELS } from "@/lib/events/types";
import { MATCH_TYPES, MATCH_TYPE_LABELS } from "@/lib/products/resolve";
import { addMappingAction, type MappingState } from "./actions";

export function AddMappingForm({ defaults }: { defaults?: { value?: string; matchType?: string } }) {
  const [state, action, pending] = useActionState<MappingState, FormData>(addMappingAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label htmlFor="productKey">Produto</Label>
        <Select id="productKey" name="productKey" required>
          {PRODUCT_KEYS.map((k) => (
            <option key={k} value={k}>
              {PRODUCT_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="matchType">Tipo</Label>
        <Select id="matchType" name="matchType" defaultValue={defaults?.matchType ?? "code"}>
          {MATCH_TYPES.map((k) => (
            <option key={k} value={k}>
              {MATCH_TYPE_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="value">Valor</Label>
        <Input id="value" name="value" required defaultValue={defaults?.value} className="w-56" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="label">Descrição (opcional)</Label>
        <Input id="label" name="label" className="w-56" />
      </div>
      <Button size="sm" disabled={pending}>
        Adicionar
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-emerald-700">Adicionado. Reprocesse os eventos não mapeados na página Eventos.</p>}
    </form>
  );
}
