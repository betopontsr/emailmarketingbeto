-- Códigos PPU dos links de checkout, pré-cadastrados como referência.
-- Podem não coincidir com os códigos que a Perfect Pay manda no webhook: confira na página Produtos.
INSERT INTO "product_mappings" ("product_key", "match_type", "value", "label") VALUES
  ('main',    'code', 'PPU38CQFMQH', 'The 11:22 Abundance Sequence — $47'),
  ('main',    'code', 'PPU38CQFMQG', 'The 11:22 Abundance Sequence — oferta $27'),
  ('nathan',  'code', 'PPU38CQFMSE', 'Acompanhamento do Nathan — $67'),
  ('nathan',  'code', 'PPU38CQGGFQ', 'Acompanhamento do Nathan — $47'),
  ('knots',   'code', 'PPU38CQFMS1', 'The Five Knots of the Body — $47'),
  ('knots',   'code', 'PPU38CQFMS2', 'The Five Knots of the Body — $19'),
  ('reclaim', 'code', 'PPU38CQFMS7', 'Reclaim Your Peace of Mind — $97'),
  ('reclaim', 'code', 'PPU38CQFMS9', 'Reclaim Your Peace of Mind — $47')
ON CONFLICT DO NOTHING;
