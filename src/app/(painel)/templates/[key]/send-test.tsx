"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendTestAction, type TestState } from "./actions";

export function SendTest({ k, flowB }: { k: string; flowB: boolean }) {
  const [state, action, pending] = useActionState<TestState, FormData>(sendTestAction, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="key" value={k} />
      {flowB && <input type="hidden" name="flowB" value="1" />}
      <Button size="sm" variant="outline" disabled={pending}>
        {pending ? "Enviando…" : "Enviar teste para mim"}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
    </form>
  );
}
