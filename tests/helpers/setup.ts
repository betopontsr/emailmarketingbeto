import { vi } from "vitest";

// "server-only" lança erro fora do Next; nos testes é inofensivo.
vi.mock("server-only", () => ({}));

process.env.SESSION_SECRET ??= "segredo-de-teste";
process.env.DRY_RUN ??= "true";
