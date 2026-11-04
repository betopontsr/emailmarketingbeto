# Funil 11:22 — e-mails de recuperação e upsell

O app recebe os webhooks de vendas da Perfect Pay, descobre o produto, decide qual sequência de e-mails cada cliente recebe, envia pelo Resend e mostra tudo num painel em português.

- **Especificação:** `docs/PROMPT.md`
- **Fonte da verdade dos e-mails:** `docs/fontes/`
- **Plano:** `docs/PLANO.md`
- **Decisões e ambiguidades (leia antes de ativar):** `docs/DECISOES.md`

O app nasce em **simulação** (DRY_RUN): nada é enviado de verdade e os e-mails ficam gravados para você ver no painel.

---

## Como funciona, em 30 segundos

1. A Perfect Pay chama `POST /api/webhooks/perfectpay?key=…`. O app grava o payload bruto, responde 200 e processa logo depois.
2. O adaptador (`src/lib/perfectpay/adapter.ts`) transforma o payload num evento padrão e a tabela de Produtos diz qual dos 4 produtos é.
3. O motor (`src/lib/engine/`, funções puras) decide: iniciar o Fluxo A, o Fluxo B ou o upsell, cancelar pendentes, suprimir.
4. Os e-mails entram na fila do banco. A cada minuto, `/api/cron/dispatch` pega os vencidos, roda a **guarda de envio** (suprimido? já comprou? janela 22h–7h? 1 por dia? atrasado?) e envia pelo Resend, ou só grava, em simulação.
5. O Resend avisa em `POST /api/webhooks/resend` o que aconteceu (entregue, aberto, clicado, bounce, spam).

---

## (a) Variáveis de ambiente

| Variável | Para que serve | Como gerar |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (Neon) | Criada sozinha pela integração Neon da Vercel. Use a URL *pooled*. |
| `RESEND_API_KEY` | Envio de e-mails | Resend → API Keys → Create API Key (permissão “Sending access”). |
| `RESEND_WEBHOOK_SECRET` | Verificar a assinatura dos webhooks do Resend | Resend → Webhooks → (seu webhook) → Signing secret (`whsec_…`). |
| `PERFECTPAY_WEBHOOK_SECRET` | Segredo que vai na URL do webhook da Perfect Pay | Valor aleatório (comando abaixo). |
| `PERFECTPAY_TOKEN` | Opcional. Token que a Perfect Pay manda no payload (`token`) | Copie da Perfect Pay, se ela mostrar um token de webhook. Vazio = não valida. |
| `CRON_SECRET` | Protege `/api/cron/dispatch` | Valor aleatório. A Vercel o envia sozinha no cron. |
| `ADMIN_EMAIL` | Seu login do painel | Seu e-mail. |
| `ADMIN_PASSWORD_HASH` | Hash da sua senha | `npm run hash-password -- 'sua senha forte'` |
| `SESSION_SECRET` | Assina o cookie de login e os links de descadastro | Valor aleatório longo. **Não troque depois de enviar e-mails**, senão os links de descadastro antigos param de funcionar. |
| `EMAIL_FROM_NAME` | Nome do remetente | `Nathan Miller` |
| `EMAIL_FROM_ADDRESS` | E-mail do remetente | Endereço do domínio verificado no Resend, ex.: `nathan@seudominio.com`. |
| `EMAIL_REPLY_TO` | Para onde vão as respostas | Uma caixa que uma pessoa real lê. |
| `SUPPORT_EMAIL` | E-mail de suporte citado no rec_a2 | Ex.: `suporte@seudominio.com`. |
| `SUPPORT_WHATSAPP_URL` | Opcional. Link de WhatsApp no rec_a2 e no rec_b1 | Ex.: `https://wa.me/5511999999999`. Vazio = só “reply to this email”. |
| `POSTAL_ADDRESS` | Endereço físico no rodapé (CAN-SPAM) | Seu endereço postal completo. |
| `APP_BASE_URL` | URL pública do app, sem barra no fim | Ex.: `https://funil-1122.vercel.app` (ou seu domínio). |
| `DRY_RUN` | `true` = simulação | Deixe `true` até terminar o checklist. |
| `TEST_EMAIL_TO` | Opcional. Destino do “enviar teste para mim” | Padrão: `ADMIN_EMAIL`. |

Valor aleatório para os segredos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Os campos de remetente, contato, endereço e trechos opcionais também podem ser editados em **Configurações**. O valor do painel tem prioridade sobre a variável.

> **Hash da senha no `.env` local:** o carregador de `.env` do Next.js interpreta `$`. O script mostra as duas versões: a da Vercel (cole como está) e a do `.env` (com `\$`).

---

## (b) Publicar na Vercel com o banco

1. **Suba o código no GitHub** (este repositório).
2. Na Vercel: **Add New → Project**, importe o repositório. O framework é detectado como Next.js. Não mude o *Build Command*: o app tem um script `vercel-build` que aplica as migrations e depois faz o build, e a Vercel o usa automaticamente.
3. **Banco:** no projeto, abra **Storage → Create Database → Neon (Postgres)** e conecte ao projeto, em todos os ambientes. A Vercel cria a `DATABASE_URL` sozinha.
4. **Variáveis:** em **Settings → Environment Variables**, cadastre as variáveis da tabela acima (com `DRY_RUN=true`).
5. **Deploy.** No log do build deve aparecer “Migrations aplicadas.”
6. Abra `https://SEU-APP/login` e entre com `ADMIN_EMAIL` e a sua senha.
7. **Cron a cada minuto.** Escolha uma das opções:
   - **Plano Pro:** o `vercel.json` já agenda `/api/cron/dispatch` a cada minuto (`* * * * *`). A Vercel manda `Authorization: Bearer <CRON_SECRET>` sozinha. Confira em **Settings → Cron Jobs**.
   - **Plano Hobby:** o Hobby só permite cron uma vez por dia, e o deploy pode ser recusado com `* * * * *`. Troque o `schedule` no `vercel.json` para `0 12 * * *` (fica como reserva) e crie um job grátis no **cron-job.org**:
     - URL: `https://SEU-APP/api/cron/dispatch?key=SEU_CRON_SECRET` (ou, melhor, o cabeçalho `Authorization: Bearer SEU_CRON_SECRET` em “Advanced → Headers”)
     - Frequência: a cada 1 minuto
     - Método: GET (POST também funciona)
   - Confira os limites atuais do seu plano na documentação da Vercel (*Cron Jobs → Usage & Pricing*).
8. Para testar o dispatcher na mão:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-APP/api/cron/dispatch
```

A resposta mostra se está em simulação, quantos e-mails pegou e o resultado de cada um.

---

## (c) URLs dos webhooks

| Serviço | URL | Onde cadastrar |
| --- | --- | --- |
| Perfect Pay | `https://SEU-APP/api/webhooks/perfectpay?key=SEU_PERFECTPAY_WEBHOOK_SECRET` | No painel da Perfect Pay, na área de **Webhooks / Postback** (ferramentas ou integrações). Marque **todos os status** de venda (aprovada, recusada, cancelada, abandono/pré-checkout, reembolso, chargeback, aguardando pagamento) e todos os produtos. Se houver campo de token, copie para `PERFECTPAY_TOKEN`. |
| Resend | `https://SEU-APP/api/webhooks/resend` | Resend → **Webhooks → Add Endpoint**. Eventos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.suppressed`. Copie o *Signing secret* para `RESEND_WEBHOOK_SECRET`. |

Descadastro (automático, não precisa cadastrar): página `https://SEU-APP/u/<token>` e um clique em `https://SEU-APP/api/unsubscribe/<token>` (cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post`).

**Primeiros payloads reais:** depois de cadastrar o webhook, faça um abandono e uma compra de teste. Em **Eventos**, abra cada evento e veja o payload bruto. Se algum aparecer como “não reconhecido” ou com campos errados, me mande o payload (sem dados pessoais) para eu ajustar o `adapter.ts`. Depois, em **Produtos**, confira se os códigos que chegaram estão mapeados para os 4 produtos e reprocesse os eventos “não mapeados”.

---

## (d) Domínio no Resend (SPF, DKIM, DMARC) e rastreamento

1. Resend → **Domains → Add Domain**. Use um subdomínio de envio, ex.: `mail.seudominio.com` (o remetente pode continuar `nathan@seudominio.com` se você verificar o domínio raiz; siga o que o Resend mostrar).
2. O Resend mostra os registros DNS. Crie todos no seu provedor de DNS:
   - **SPF:** registro TXT (e MX) no subdomínio de envio que o Resend indicar.
   - **DKIM:** registro TXT `resend._domainkey…` com a chave pública.
   - **DMARC:** crie um TXT em `_dmarc.seudominio.com`. Para começar: `v=DMARC1; p=none; rua=mailto:dmarc@seudominio.com`. Depois de algumas semanas sem problemas, suba para `p=quarantine`.
3. Clique em **Verify** e espere ficar *Verified* (pode levar de minutos a horas).
4. **Rastreamento:** em Domains → (seu domínio) → **Configuration**, ative **Open tracking** e **Click tracking**. Sem isso, o painel não mostra aberturas e cliques.
5. Use em `EMAIL_FROM_ADDRESS` um endereço desse domínio verificado.

As aberturas são aproximadas (Apple Mail e outros abrem e-mails sozinhos). O painel as rotula como “aberturas (aprox.)”. Olhe mais para cliques e compras.

---

## (e) Checklist antes de ativar (DRY_RUN=false)

### Do anexo “Recuperação (quem não comprou)”

- [ ] **Webhook:** a Perfect Pay separa “carrinho abandonado” de “checkout abandonado” e informa o motivo da recusa do cartão? Se tudo vier como um evento só, o Fluxo A cobre os dois e o B só entra quando houver recusa. Confira em **Eventos**.
- [ ] **Saldo insuficiente:** veja no payload de uma recusa como vem o motivo e confirme que o app marca `insufficient_funds` (o B2 passa para 48 h).
- [ ] **Link de recuperação:** a Perfect Pay gera um link que reabre o checkout com os dados preenchidos? Se o webhook trouxer, o adaptador precisa lê-lo (`recoveryUrl`). Se não, fica o link normal do checkout.
- [ ] **Checkout de $27** (`PPU38CQFMQG`): tem os mesmos upsells e **expira de verdade**? Sem expiração, tire a frase de prazo do F3.
- [ ] **Upsells também no link recuperado:** compre pelo link de recuperação e pelo de $27 e confirme que aparecem as três páginas de upsell e que a pessoa entra na sequência de upsell.
- [ ] **Promessas do produto no rec_a2:** garantia de 30 dias com os bônus mantidos, e o valor pago pode ser reinvestido ao concluir as 11 sessões.
- [ ] **Depoimento da Evelyn (rec_a2):** só ligue em Configurações com a permissão dela, ou troque por outro real.
- [ ] **Contato de suporte:** e-mail e link de WhatsApp (rec_a2 e rec_b1).
- [ ] **Outras formas de pagamento:** se o checkout aceitar PayPal ou outro método, ligue a frase do rec_b1. Senão, deixe desligada.
- [ ] **Rodapé:** link de descadastro e endereço físico aparecem (veja em **E-mails (prévia)**).
- [ ] **SMS (opcional):** só com consentimento expresso coletado no checkout. O app não envia SMS.

### Do anexo “Upsells (quem comprou)”

- [ ] **Preço do acompanhamento:** a VSL diz $97, mas os links são $67 e $47. Ajuste a VSL ou me avise.
- [ ] **Garantia:** você confirmou 30 dias em tudo. A VSL do acompanhamento ainda diz 60 dias? Ajuste.
- [ ] **Nomes das ofertas:** “Reclaim Your Peace of Mind” e “The Five Knots of the Body” nos e-mails. Use o mesmo nome no checkout e no vídeo.
- [ ] **Escassez:** você confirmou que as vagas são reais. O P.S. do upsell_1 está ligado. Se a limitação deixar de existir, desligue em Configurações (e tire da VSL).
- [ ] **Prazos reais:** os links de preço reduzido (upsell_4 $47, upsell_5 $19, upsell_7 $47) precisam expirar na data e hora do e-mail. Se a Perfect Pay não permitir, retire as frases de prazo.
- [ ] **Depoimentos do upsell_4:** só reais, com nome e permissão (Configurações).
- [ ] **Números e histórias:** “33,000 students”, “$500 in private sessions” e a história das 3 da manhã devem ser verdade.
- [ ] **Corpo e saúde:** o upsell_2 tem o aviso médico. Não acrescente promessas de cura.
- [ ] **Crédito dos $47 (upsell_6):** só ligue quando a forma de resgate existir. Escreva as instruções em Configurações. A VSL do principal fala em $37: atualize.
- [ ] **Pagamento salvo (“one click”):** teste o link do upsell_1 com uma compra real.
- [ ] **E-mail de entrega das sessões:** se a plataforma de membros manda e-mail às 10h, mude a hora do upsell em Configurações para 4 a 5 horas depois.

### Do app

- [ ] **Produtos:** os códigos que chegam no webhook estão mapeados para os 4 produtos (preço cheio e reduzido). Os eventos “não mapeados” do funil foram reprocessados.
- [ ] **Configurações:** remetente, reply-to, suporte e endereço postal preenchidos (o alerta de “configuração incompleta” some da Visão geral).
- [ ] **Domínio verificado** no Resend, com rastreamento de abertura e clique ligado. O webhook do Resend responde (Resend → Webhooks mostra entregas com sucesso).
- [ ] **Prévia:** abra cada um dos 12 e-mails em **E-mails (prévia)** e use “Enviar teste para mim”. Confira no celular e no computador.
- [ ] **Simulador:** rode todos os fluxos com clientes de teste:
  - abandono → “Até o fim” (A1, A2, F3);
  - abandono → compra (a recuperação é cancelada e o upsell começa);
  - recusa por saldo (o B2 sai em 48 h) e recusa comum;
  - compra → uma oferta comprada no meio (os e-mails dela somem, os outros continuam);
  - reembolso (o cliente é suprimido e tudo é cancelado).

  Depois, **Apagar todos os dados de teste**.
- [ ] **Compra real:** faça uma compra real de verdade (pode reembolsar depois) e uma tentativa de checkout abandonada, com DRY_RUN ainda ligado. Confira em Eventos e no detalhe do cliente que tudo foi reconhecido e agendado certo.
- [ ] **Só então:** na Vercel, mude `DRY_RUN=false` e faça redeploy. Em Configurações, desligue “Simulação”. As duas chaves precisam estar desligadas para enviar de verdade.
- [ ] Acompanhe a **Fila de envios** e a **Visão geral** nas primeiras horas. A **Pausa global** em Configurações para tudo na hora.

---

## Desenvolvimento local

```bash
npm install
```

```bash
cp .env.example .env
```

Preencha o `.env` com um Postgres local ou de teste e depois:

```bash
npm run db:migrate
```

```bash
npm run dev
```

Testes (rodam sem banco e sem internet, com PGlite):

```bash
npm test
```

Outros comandos: `npm run typecheck`, `npm run lint`, `npm run db:generate` (gera uma migration depois de mudar `src/lib/db/schema.ts`).

### Onde fica cada coisa

| Pasta | O quê |
| --- | --- |
| `src/lib/engine/` | Motor de decisão e guarda de envio (funções puras, testadas em `tests/engine.test.ts`) |
| `src/lib/perfectpay/adapter.ts` | Único lugar que conhece o formato da Perfect Pay |
| `src/lib/pipeline/` | Captura do webhook, aplicação das decisões no banco, supressão |
| `src/lib/dispatch/dispatcher.ts` | Fila: claim atômico (`FOR UPDATE SKIP LOCKED`), guarda, envio, tentativas |
| `src/emails/` | Os 12 e-mails (texto copiado dos anexos) e a renderização HTML/texto |
| `src/app/(painel)/` | Páginas do painel |
| `src/app/api/` | Webhooks, cron, descadastro, CSV |
| `drizzle/` | Migrations SQL |
| `tests/` | Testes e fixtures (`tests/fixtures/perfectpay/`) |
