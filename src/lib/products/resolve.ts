import type { NormalizedEvent, ProductKey } from "@/lib/events/types";
import { PRODUCT_KEYS } from "@/lib/events/types";

export type MappingRow = { productKey: string; matchType: string; value: string };

export const MATCH_TYPES = ["code", "product_code", "plan_code", "offer_code", "name_pattern"] as const;
export const MATCH_TYPE_LABELS: Record<(typeof MATCH_TYPES)[number], string> = {
  code: "Qualquer código (produto, plano ou oferta)",
  product_code: "Código do produto",
  plan_code: "Código do plano",
  offer_code: "Código da oferta",
  name_pattern: "Nome contém",
};

export type ResolveResult =
  | { ok: true; productKey: ProductKey }
  | { ok: false; reason: "unmapped" | "ambiguous"; candidates: string[] };

const eq = (a: string | null, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Descobre a chave interna do produto. Se bater com mais de uma chave, é ambíguo e nada é disparado. */
export function resolveProduct(product: NormalizedEvent["product"], mappings: MappingRow[]): ResolveResult {
  const hits = new Set<string>();
  for (const m of mappings) {
    if (!(PRODUCT_KEYS as readonly string[]).includes(m.productKey)) continue;
    const v = m.value;
    let match = false;
    switch (m.matchType) {
      case "code":
        match = eq(product.code, v) || eq(product.planCode, v) || eq(product.offerCode, v);
        break;
      case "product_code":
        match = eq(product.code, v);
        break;
      case "plan_code":
        match = eq(product.planCode, v);
        break;
      case "offer_code":
        match = eq(product.offerCode, v);
        break;
      case "name_pattern":
        match = !!product.name && !!v.trim() && product.name.toLowerCase().includes(v.trim().toLowerCase());
        break;
    }
    if (match) hits.add(m.productKey);
  }
  if (hits.size === 1) return { ok: true, productKey: [...hits][0] as ProductKey };
  return { ok: false, reason: hits.size === 0 ? "unmapped" : "ambiguous", candidates: [...hits] };
}
