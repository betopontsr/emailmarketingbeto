import type { ProcessHandler } from "./ingest";

/** Fase 2: o motor de decisão entra na Fase 3. Por enquanto só registra. */
export const handleEvent: ProcessHandler = async () => ({ status: "ignored", reason: "motor de decisão ainda não ligado" });
