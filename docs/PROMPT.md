# Funil 11:22 — aplicativo de e-mails de recuperação e upsell (Perfect Pay + Resend)

Construa, neste repositório, um aplicativo web completo. Ele recebe os webhooks de vendas da Perfect Pay, descobre qual produto cada cliente comprou ou abandonou, decide qual sequência de e-mails ele deve receber, envia os e-mails pelo Resend e tem um painel de controle para eu acompanhar tudo. Leia este documento inteiro antes de escrever código e, antes da Fase 1, escreva um plano curto em /docs/PLANO.md.

## 0. Regras de trabalho

- Há dois arquivos anexados: "Upsells (quem comprou)" e "Recuperação (quem não comprou)". Eles são a FONTE DA VERDADE de textos, assuntos, previews, links, horários, ordem e regras dos e-mails. Salve uma cópia de cada um em /docs/fontes/. Se não conseguir ler os anexos, pare e me avise.
- TODOS os e-mails são em inglês e devem ser copiados exatamente dos anexos (aspas e apóstrofos tipográficos, assuntos em minúsculas, prefixo [11:22], assinatura "Nathan"). Nos anexos o markdown escapa colchetes como \[11:22\]; no e-mail final escreva [11:22]. Não traduza, reescreva nem "melhore" nenhum texto. A interface do painel é em português do Brasil.
- Não invente. Se algo estiver ambíguo ou faltar, escolha o comportamento mais seguro (não enviar), registre em /docs/DECISOES.md e continue.
- Trabalhe em fases (seção 13), com um commit por fase e testes passando.
- Nunca coloque chaves ou segredos no código. Só .env.example com placeholders; .env fica no .gitignore.
- O app nasce em modo simulação (DRY_RUN=true): nada é enviado de verdade; os e-mails são renderizados e gravados para eu ver no painel.
- Você não consegue publicar na Vercel nem acessar meu Resend ou minha Perfect Pay. Entregue o código pronto e um README com o passo a passo; eu faço a publicação e as conexões. Nunca me peça para colar chaves neste chat.

## 1. Stack e arquitetura

- Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Postgres (Neon, via Vercel) com Drizzle ORM e migrations, SDK do Resend, Luxon (fusos), Zod, Vitest. Deploy na Vercel. Use versões estáveis atuais e confira a documentação oficial atual de: Resend (envio, chave de idempotência, webhooks, cabeçalhos de descadastro) e Vercel Cron (limite de frequência por plano).
- Quem decide tudo é ESTE app. O Resend só envia os e-mails e avisa o que aconteceu com eles (entregue, aberto, clicado, bounce, spam). Não use Audiences, Broadcasts nem Automations do Resend para a lógica.
- Fila de envios no banco. Um endpoint GET/POST /api/cron/dispatch, protegido por CRON_SECRET, processa os e-mails vencidos e roda a cada minuto (Vercel Cron). O endpoint deve funcionar independente do agendador, porque, se meu plano da Vercel não permitir cron por minuto, vou chamá-lo por um serviço externo gratuito (ex.: cron-job.org). Documente as duas opções no README.
- A lógica de decisão (quem entra em qual fluxo, o que agendar, o que cancelar) fica em funções puras e testáveis em src/lib/engine/, separadas de banco, Resend e HTTP.
- Os testes devem rodar sem serviços externos (use PGlite ou Postgres local).

## 2. Webhook da Perfect Pay

- Rota POST /api/webhooks/perfectpay. Autenticação: segredo na URL (?key=...) igual a PERFECTPAY_WEBHOOK_SECRET, comparado em tempo constante, e, se a Perfect Pay enviar um token no payload ou no header, valide também.
- SEMPRE salve o payload bruto completo na tabela webhook_events ANTES de processar e responda 200 rápido. Se o processamento falhar, o evento fica marcado como "erro" e pode ser reprocessado pelo painel.
- NÃO INVENTE nomes de campos da Perfect Pay. Crie um único arquivo adaptador (src/lib/perfectpay/adapter.ts) que converte o payload bruto em um evento normalizado. Comece com um adaptador defensivo; quando não reconhecer o evento, registre como "não reconhecido" e não dispare nada. Vou colar payloads reais de exemplo depois, e você ajusta o adaptador. Deixe fixtures e testes em /tests/fixtures/perfectpay/.
- Evento normalizado: providerEventId, type, occurredAt, customer {email, fullName, firstName, country, region, phone}, product {code, planCode, offerCode, name}, transactionId, amount, currency, rawStatus, declineReason.
- Tipos: purchase_approved | checkout_abandoned | payment_declined | refunded | chargeback | purchase_pending | other. Mapeamento: carrinho ou checkout abandonado → checkout_abandoned; compra cancelada ou expirada sem pagamento → checkout_abandoned (confirmar com payloads reais); cartão/compra recusada → payment_declined, com declineReason="insufficient_funds" quando o motivo for saldo insuficiente; aprovada/completa → purchase_approved; reembolso → refunded; chargeback → chargeback; aguardando pagamento (boleto/PIX) → purchase_pending (só registra, sem e-mails).
- Idempotência: índice único (provider, providerEventId). Se a Perfect Pay não enviar ID de evento, gere uma chave determinística (transactionId + status + data). Evento repetido vira status "duplicado", sem nenhum efeito.
- O webhook traz eventos de TODOS os meus produtos e eles podem chegar fora de ordem ou atrasados. O motor tem que ser correto nesses casos (seções 4 e 7).

## 3. Identificação dos produtos

Só quatro produtos interessam. Chaves internas e dados (links e preços estão nos anexos):
- main: The 11:22 Abundance Sequence. Checkout $47 (https://go.centerpag.com/PPU38CQFMQH) e oferta $27 (https://go.centerpag.com/PPU38CQFMQG).
- nathan: Acompanhamento do Nathan. $67 (PPU38CQFMSE) e $47 (PPU38CQGGFQ).
- knots: The Five Knots of the Body. $47 (PPU38CQFMS1) e $19 (PPU38CQFMS2).
- reclaim: Reclaim Your Peace of Mind. $97 (PPU38CQFMS7) e $47 (PPU38CQFMS9).

- Tabela product_mappings: um ou mais identificadores da Perfect Pay (código do produto, do plano, da oferta ou padrão de nome) → chave interna. Várias entradas por chave, porque preço cheio e preço reduzido são o mesmo produto. Comprar qualquer variante de preço conta como "comprou aquele produto".
- Página "Produtos" no painel para eu criar e editar os mapeamentos. Pré-cadastre os códigos PPU dos links acima como referência (podem não coincidir com os códigos do webhook).
- Evento de produto sem mapeamento: registre, mostre um alerta no painel ("N eventos de produtos não mapeados") e não dispare nada.

## 4. O que fazer com cada evento

- purchase_approved do main: registrar a compra; cancelar toda recuperação pendente desse cliente (motivo "comprou"); se o cliente ainda não tem fluxo de upsell, criar o fluxo de upsell com D+0 = data da compra; atribuir a compra ao último e-mail de recuperação enviado nos 7 dias anteriores, se houver. Comprar o main de novo não reinicia o fluxo de upsell.
- purchase_approved de nathan, knots ou reclaim: registrar; marcar "comprou aquela oferta"; cancelar os e-mails pendentes daquela oferta; atribuir ao último e-mail daquela oferta enviado (se não houve nenhum, marcar como compra direta, sem e-mail). Isso NÃO cria fluxo de upsell sozinho: o fluxo nasce da compra do main. Se a compra do upsell chegar antes da do main (fora de ordem), o fluxo criado depois já ignora essa oferta. Se as 3 ofertas foram compradas, o fluxo termina como "completo".
- checkout_abandoned do main: iniciar o Fluxo A (seção 6) se: não existe compra aprovada do main para esse e-mail; o cliente não está suprimido; não há fluxo de recuperação ativo; e já se passaram 30 dias desde o último fluxo de recuperação. Caso contrário, registrar o evento com o motivo de não ter iniciado. Abandono de qualquer outro produto: só registrar.
- payment_declined do main: cancelar os e-mails pendentes do Fluxo A e iniciar o Fluxo B, com as mesmas condições acima. Se já houver Fluxo B ativo, não reinicia.
- refunded ou chargeback de QUALQUER produto mapeado: remover o cliente de tudo (suprimir), cancelar tudo que está pendente e registrar o motivo.
- Descadastro pelo link, bounce permanente e reclamação de spam: suprimir o cliente.
- purchase_pending, other e produtos sem mapeamento: só registrar.

## 5. Fluxo de upsell (anexo "Upsells")

Sete e-mails em 13 dias. D+0 é a data da compra do main no fuso do cliente. Envio às 10:00 no fuso do cliente (hora configurável nas Configurações, padrão 10). Se o fuso for desconhecido, use America/New_York.
- upsell_1: D+1, oferta nathan, reabertura, $67
- upsell_2: D+3, oferta knots, reabertura, $47
- upsell_3: D+5, oferta reclaim, reabertura, $97
- upsell_4: D+7, oferta nathan, final com prazo de 48h, $47
- upsell_5: D+9, oferta knots, final, vence à meia-noite, $19
- upsell_6: D+11, oferta reclaim, segundo toque, $97
- upsell_7: D+13, oferta reclaim, final com prazo de 48h, $47

Regras: cada e-mail só vai para quem NÃO comprou a oferta daquele e-mail (qualquer variante de preço) e não está suprimido; quem compra sai daquela oferta e continua recebendo as outras; depois do upsell_7 o fluxo termina como "completo" e nenhum upsell é enviado depois disso; um e-mail, uma oferta.

## 6. Fluxos de recuperação (anexo "Recuperação")

Os tempos contam a partir do evento do webhook.
- Fluxo A (abandono): rec_a1 em 30 min; rec_a2 em 24 h; rec_f3 em 72 h.
- Fluxo B (cartão recusado): rec_b1 em 10 min; rec_b2 em 24 h (48 h se declineReason for saldo insuficiente); rec_f3 em 72 h.
- rec_f3 é o mesmo e-mail nos dois fluxos (checkout de $27, prazo de 48h). O parágrafo "Só para o Fluxo B" aparece apenas no Fluxo B.
- Quem já recebeu o rec_f3 alguma vez NÃO o recebe de novo se reentrar após 30 dias (o fluxo reentrado termina depois de rec_a2 ou rec_b2).
- Horário: não enviar e-mails de recuperação entre 22h e 7h no fuso do cliente. Se o horário cair nessa janela, adie para as 8h. Sem fuso, use America/New_York.
- Máximo de 1 e-mail de recuperação por dia por cliente; se estourar, adie para o próximo horário válido.
- Link: use o link de recuperação da plataforma se o webhook trouxer um; senão, o link normal do checkout.
- Opcional, configurável (padrão 0%): grupo de controle. Uma porcentagem dos eventos de recuperação é segurada sem e-mail (escolha determinística por hash do evento) e marcada como "controle" para comparação nos relatórios.

## 7. Guarda de envio (executada imediatamente antes de CADA e-mail)

O dispatcher pega os e-mails vencidos de forma atômica (status scheduled → sending, com FOR UPDATE SKIP LOCKED ou equivalente) para que execuções sobrepostas nunca enviem duas vezes. Antes de enviar, confira nesta ordem. Se qualquer item falhar, o e-mail vira "skipped" ou "cancelled" com o motivo gravado:
1. Pausa global desligada e configuração obrigatória completa (remetente, endereço postal, e-mail de suporte). Se faltar configuração, só DRY_RUN pode rodar.
2. Cliente não suprimido (descadastro, reembolso, chargeback, bounce, spam).
3. Fluxo ainda ativo.
4. Recuperação: o cliente NÃO tem compra aprovada do main (é o erro mais caro: cobrar "termine sua compra" de quem já comprou).
5. Upsell: o cliente não comprou a oferta daquele e-mail.
6. Recuperação: janela 22h–7h e limite de 1 por dia.
7. Atraso: se o e-mail estiver mais de MAX_LATENESS_HORAS (padrão 12) atrasado, marque como "expired" e não envie.
Falhas temporárias do Resend: até 3 tentativas com espera crescente; depois, "failed". Use a chave de idempotência do Resend com o id do e-mail agendado. Fora de ordem: se um abandono chegar depois da compra aprovada, ele nem inicia o fluxo; se a compra aprovada chegar depois do início, cancela os pendentes.

## 8. E-mails

- Crie um template por e-mail em src/emails/: upsell_1 a upsell_7, rec_a1, rec_a2, rec_b1, rec_b2, rec_f3. Cada um tem assunto, preview (renderizado como preheader oculto), versão HTML e versão texto.
- Visual simples, de e-mail pessoal: texto, sem imagens, largura máxima ~560px, botão de chamada em destaque (o texto do botão está nos anexos). Remetente: "Nathan Miller" <EMAIL_FROM_ADDRESS>, reply-to EMAIL_REPLY_TO (uma pessoa real lê).
- {{first_name}}: use o primeiro nome do cliente com capitalização correta ("JOHN" → "John"). Sem nome, use "Hi there," na saudação e retire o "{{first_name}}, " dos assuntos.
- Prazos calculados pelo app no momento do envio, formatados no fuso do cliente (ex.: "Friday, Nov 20 at 10:00 AM EST"): upsell_4, upsell_7 e rec_f3 = hora de envio + 48h ("[DATE, TIME, TIME ZONE]" e "After [DATE]"); upsell_5 = "midnight" + sigla do fuso do cliente.
- Trechos entre colchetes nos anexos são configuráveis na página Configurações (nada vai hardcoded):
  - P.S. de escassez do upsell_1: desligado por padrão (só ligue se for verdade).
  - Depoimentos do upsell_4 e da Evelyn no rec_a2: só entram se estiverem com nome preenchido E marcados como "autorizado"; senão o bloco inteiro é omitido.
  - Parágrafo do crédito de $47 do upsell_6: desligado por padrão; precisa do texto das instruções.
  - Frase "Or another payment method" do rec_b1: desligada por padrão.
  - Contato de suporte (e-mail e link de WhatsApp opcional) usado no rec_a2 e rec_b1. Sem WhatsApp, use só "reply to this email".
- Rodapé em todos: link de descadastro e endereço postal (POSTAL_ADDRESS). Cabeçalhos List-Unsubscribe e List-Unsubscribe-Post (one-click). Página pública /u/[token] (token assinado) que confirma o descadastro e suprime o cliente.
- Página de pré-visualização de cada template com dados de exemplo e botão "enviar teste para mim".

## 9. Integração com o Resend

- Envio pelo SDK, com tags (id do e-mail agendado, chave do template, oferta) para correlacionar eventos.
- Webhook POST /api/webhooks/resend com verificação de assinatura (RESEND_WEBHOOK_SECRET). Registre em email_events: enviado, entregue, atraso na entrega, bounce, reclamação de spam, aberto, clicado (com a URL). Bounce permanente e spam suprimem o cliente. Confira na documentação os nomes exatos dos eventos.
- Aberturas são aproximadas (proteção de privacidade de e-mail infla os números); no painel, rotule como "aberturas (aprox.)" e dê mais peso aos cliques e às compras.

## 10. Banco de dados (sugestão, ajuste se precisar)

customers (e-mail único em minúsculas, nome, país, região, fuso, is_test, suprimido + motivo + data); product_mappings; webhook_events (payload bruto, tipo, status do processamento, erro); purchases (transactionId único, produto, valor, moeda, status, data, reembolso, e-mail atribuído, is_test); flows (cliente, tipo: upsell | recovery_a | recovery_b, status: active | completed | cancelled, motivo, âncora, F3 já enviado, controle); scheduled_emails (fluxo, template, oferta, agendado para, status: scheduled | sending | sent | dry_run | skipped | cancelled | failed | expired, motivo, tentativas, id do Resend, HTML renderizado para pré-visualização); email_events (eventos do Resend); customer_events (linha do tempo, somente inclusão: tipo, resumo, metadados, data); settings (chave/valor); admin_sessions se necessário. Tudo com índices adequados (e-mail, status + agendado_para).

## 11. Painel de controle (em português do Brasil)

Login com ADMIN_EMAIL + ADMIN_PASSWORD_HASH, sessão em cookie httpOnly, limite de tentativas. Todas as rotas e APIs do painel exigem login. Interface limpa, com filtro de período e alternância "incluir dados de teste".
1. Visão geral: eventos recebidos; clientes; clientes em cada fluxo agora; e-mails enviados, entregues, abertos (aprox.), clicados, bounces, spam, descadastros; compras e receita por origem; alertas (produtos sem mapeamento, eventos com erro, configuração incompleta, DRY_RUN ligado, pausa global).
2. Clientes: lista com busca por nome e e-mail e filtros por status da jornada (em upsell, em recuperação A ou B, completo, suprimido), por produto comprado (principal, Nathan, Knots, Reclaim, não comprou), por fluxo e por data de entrada; colunas: nome, e-mail, país, status, produtos comprados (selos), último evento, e-mails enviados e abertos, receita total; paginação e exportação em CSV.
3. Detalhe do cliente: resumo e produtos comprados com datas e valores; "Jornada" visual de cada fluxo com cada e-mail na ordem (estado, data/hora, aberto, clicado, motivo se pulado) e o ponto da compra marcado (ex.: "viu o e-mail 1, viu o e-mail 2, viu o e-mail 3, comprou após o e-mail 4"); linha do tempo completa e cronológica (webhooks recebidos, e-mails agendados/enviados/abertos/clicados/pulados com motivo, compras, mudanças de fluxo, cancelamentos com motivo); clicar num e-mail mostra o HTML renderizado; ações: cancelar pendentes, suprimir/reativar, enviar agora (só DRY_RUN).
4. Desempenho por e-mail (upsell_1 a 7, rec_a1, rec_a2, rec_b1, rec_b2, rec_f3): agendados, enviados, pulados (por motivo), entregues, abertos (aprox.), clicados, compras atribuídas, receita, descadastros, bounces, spam, taxas. Além disso: taxa de recuperação por fluxo (compras em até 7 dias ÷ eventos de abandono ou recusa), receita de upsell de quem foi recuperado, comparação F3 com desconto vs rec_a2 sem desconto, conversão por oferta de upsell e comparação com o grupo de controle quando ativo.
5. Fila de envios: agendados, enviando, falhos e expirados, com filtros e botões de reenviar e cancelar.
6. Eventos (webhooks): lista com status (processado, duplicado, ignorado, erro, não mapeado), visualização do payload bruto e botão de reprocessar.
7. Produtos: mapeamentos (seção 3).
8. Configurações: remetente, reply-to, suporte, endereço postal, hora do upsell, fuso padrão, janela de silêncio, MAX_LATENESS_HORAS, % de controle, os trechos opcionais da seção 8, pausa global e DRY_RUN.
9. Simulador: criar eventos falsos pelo MESMO pipeline do webhook (abandono, recusa com e sem saldo, compra do main, compra de cada upsell, reembolso), com e-mail, nome e país. Marque is_test, e inclua o botão "tornar os pendentes vencidos agora" (só para clientes de teste) para eu testar os fluxos inteiros em minutos sem esperar dias.

## 12. Segurança, conformidade e testes

- Segredos só em variáveis de ambiente. Valide toda entrada com Zod. Nunca registre dados de cartão (se algum campo parecer dado de cartão, descarte). Limite de requisições nas rotas públicas.
- Os e-mails vão para clientes dos EUA: descadastro funcionando, endereço postal no rodapé e nenhum envio a suprimidos (CAN-SPAM).
- Testes (Vitest) para a lógica de decisão, no mínimo: abandono agenda A1/A2/F3 nos tempos certos; abandono seguido de compra aprovada cancela a recuperação e inicia o upsell; recusa substitui o Fluxo A pelo B; recusa por saldo move o B2 para 48h; evento duplicado não faz nada; abandono dentro de fluxo ativo não reinicia; reentrada após 30 dias não recebe F3 de novo; janela 22h–7h adia para 8h; limite de 1 recuperação por dia; upsell pula ofertas já compradas (inclusive preço reduzido); compra de upsell antes da compra do main; quem compra uma oferta continua recebendo as outras; reembolso de qualquer produto suprime tudo; fim do fluxo após o upsell_7; fuso desconhecido usa Nova York; atribuição da compra ao e-mail certo.

## 13. Fases e entrega

1. Estrutura do projeto, banco, migrations, login do painel, .env.example, README inicial.
2. Webhook da Perfect Pay (captura, adaptador, idempotência), mapeamento de produtos, linha do tempo.
3. Motor de decisão (funções puras) + testes da seção 12.
4. Fila, dispatcher, guarda de envio, templates dos 12 e-mails, envio pelo Resend em DRY_RUN, descadastro, webhook do Resend.
5. Páginas do painel (seção 11, itens 1 a 8).
6. Simulador, relatórios de desempenho, acabamento.

Entregáveis finais: README com (a) lista completa de variáveis de ambiente (DATABASE_URL, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, PERFECTPAY_WEBHOOK_SECRET, CRON_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET, EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, EMAIL_REPLY_TO, SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL, POSTAL_ADDRESS, APP_BASE_URL, DRY_RUN) e como gerar cada uma; (b) passo a passo para publicar na Vercel com o banco; (c) as URLs exatas dos dois webhooks (Perfect Pay e Resend) e onde cadastrá-las; (d) como configurar o domínio no Resend (SPF, DKIM, DMARC) e ativar o rastreamento de abertura e clique; (e) um "checklist antes de ativar" montado a partir das seções "o que confirmar" dos dois anexos, mais: testar todo o fluxo no Simulador, testar com uma compra real, só então trocar DRY_RUN para false.
