# Plano — Funil 11:22

Fontes: `docs/PROMPT.md` e `docs/fontes/`. Decisões e ambiguidades vão para `docs/DECISOES.md`.

## Arquitetura em uma frase

Next.js (App Router) na Vercel recebe webhooks → grava o payload bruto → adaptador normaliza → motor puro (`src/lib/engine/`) decide o que agendar/cancelar → fila em Postgres (`scheduled_emails`) → `/api/cron/dispatch` pega os vencidos com `FOR UPDATE SKIP LOCKED`, roda a guarda de envio e envia pelo Resend (ou grava em DRY_RUN) → webhook do Resend alimenta `email_events` → painel em pt-BR.

## Estrutura de pastas

```
src/app/(painel)/...        páginas do painel (login obrigatório)
src/app/api/webhooks/...    perfectpay, resend
src/app/api/cron/dispatch   dispatcher
src/app/u/[token]           descadastro público
src/lib/engine/             funções puras: fluxos, horários, guarda, atribuição
src/lib/perfectpay/adapter.ts
src/lib/db/                 schema Drizzle, migrations, consultas
src/lib/email/              render, envio Resend, prazos
src/emails/                 12 templates (texto copiado dos anexos)
tests/                      Vitest + PGlite, fixtures/perfectpay/
```

## Princípios

- O motor recebe estado + evento e devolve uma lista de ações (criar fluxo, agendar, cancelar, suprimir, atribuir). Sem I/O. Fácil de testar.
- Tempo sempre em UTC no banco; Luxon converte para o fuso do cliente (padrão America/New_York).
- Na dúvida, não enviar e registrar o motivo.
- Textos dos e-mails copiados literalmente; trechos entre colchetes viram configurações (desligados por padrão).

## Fases (um commit por fase, testes passando)

1. Projeto Next.js + Tailwind + shadcn/ui, Drizzle + migrations com todas as tabelas, login do painel (cookie httpOnly, limite de tentativas), `.env.example`, README inicial.
2. Webhook Perfect Pay (segredo em tempo constante, payload bruto antes de processar, idempotência, adaptador defensivo + fixtures), `product_mappings` pré-cadastrados, linha do tempo.
3. Motor de decisão + todos os testes da seção 12 do prompt.
4. Fila, dispatcher, guarda de envio, 12 templates (HTML + texto + preheader), Resend com idempotência e tags, DRY_RUN, descadastro com List-Unsubscribe one-click, webhook do Resend com verificação de assinatura.
5. Painel: visão geral, clientes, detalhe/jornada, desempenho, fila, eventos, produtos, configurações.
6. Simulador (mesmo pipeline do webhook, `is_test`, "tornar pendentes vencidos"), relatórios, README final com checklist antes de ativar.

## Pendências já identificadas nos anexos (detalhar em DECISOES.md)

- Nomes de campos da Perfect Pay: desconhecidos até você colar payloads reais. O adaptador começa defensivo e não dispara nada que não reconheça.
- Upsell_4: os dois depoimentos estão sem nome → bloco omitido até você preencher e autorizar.
- Upsell_1 (P.S. de escassez), upsell_6 (crédito de $47), rec_b1 ("another payment method"), depoimento da Evelyn no rec_a2: desligados por padrão.
- Links de preço reduzido (upsell_4, 5, 7 e rec_f3) precisam realmente expirar; isso é configuração na Perfect Pay, não no app.
- Garantia do acompanhamento: 60 dias nos e-mails 1 e 4 (como no anexo), 30 nos demais; copio como está.
