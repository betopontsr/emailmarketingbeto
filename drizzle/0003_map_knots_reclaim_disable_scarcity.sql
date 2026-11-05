-- Códigos de produto da Perfect Pay informados pelo dono (05/11/2026).
INSERT INTO "product_mappings" ("product_key", "match_type", "value", "label") VALUES
  ('reclaim', 'product_code', 'PPPBFBLR', 'Reclaim Your Peace of Mind (código do produto na Perfect Pay)'),
  ('knots',   'product_code', 'PPPBFBLP', 'The 5 Body Knots Release Program (código do produto na Perfect Pay)')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- O dono pediu para não usar a frase das vagas (P.S. de escassez do upsell_1).
INSERT INTO "settings" ("key", "value", "updated_at") VALUES ('upsell1ScarcityEnabled', 'false'::jsonb, now())
ON CONFLICT ("key") DO UPDATE SET "value" = 'false'::jsonb, "updated_at" = now();
