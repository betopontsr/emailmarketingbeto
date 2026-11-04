# Funil 11:22 — e-mails de recuperação e upsell

O app recebe os webhooks da Perfect Pay, decide qual sequência de e-mails cada cliente recebe, envia pelo Resend e mostra tudo num painel em português.

- Especificação: `docs/PROMPT.md` e `docs/fontes/` (fonte da verdade dos e-mails)
- Plano: `docs/PLANO.md`
- Decisões e ambiguidades: `docs/DECISOES.md`

## Rodar localmente

```bash
npm install
```

```bash
cp .env.example .env
```

Preencha o `.env` (veja abaixo). Depois:

```bash
npm run db:migrate
```

```bash
npm run dev
```

Testes (não precisam de banco nem de internet, usam PGlite):

```bash
npm test
```

## Variáveis de ambiente

Veja `.env.example`. Gere a senha do painel com:

```bash
node scripts/hash-password.mjs 'sua senha forte'
```

Gere segredos aleatórios (SESSION_SECRET, CRON_SECRET, PERFECTPAY_WEBHOOK_SECRET) com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

O passo a passo completo de publicação, webhooks e checklist entra no fim da Fase 6.
