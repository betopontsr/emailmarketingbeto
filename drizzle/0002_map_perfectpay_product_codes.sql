-- Códigos de produto confirmados nos primeiros webhooks reais da Perfect Pay (05/11/2026).
-- "Código do produto" cobre todos os planos/preços do produto.
INSERT INTO "product_mappings" ("product_key", "match_type", "value", "label") VALUES
  ('main',   'product_code', 'PPPBFBLH', 'The 11:22 Abundance Sequence (código do produto na Perfect Pay)'),
  ('nathan', 'product_code', 'PPPBFBLS', 'Exclusive Support Nathan (código do produto na Perfect Pay)')
ON CONFLICT DO NOTHING;
