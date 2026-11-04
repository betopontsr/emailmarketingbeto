# Decisões e ambiguidades

Quando algo estava ambíguo ou faltava, escolhi o comportamento mais seguro (não enviar) e registrei aqui.

## Decisões confirmadas por você (04/11/2026)

1. **Garantia de 30 dias em todos os produtos.** O anexo de Upsells diz 60 dias no acompanhamento (e-mails 1 e 4). Você confirmou que nada tem 60 dias. Nos templates: upsell_1 usa “And you have 30 days to try it.” e upsell_4 usa “30-day guarantee”. O resto do texto está igual ao anexo. Os arquivos em `docs/fontes/` ficaram sem alteração.
2. **Escassez real.** Você confirmou que as “7 vagas restantes” são verdadeiras. O P.S. de escassez do upsell_1 vem **ligado** por padrão, com o texto do anexo (“I limit how many people I support directly, so I can really answer every one of you.”). O anexo não traz uma frase com o número de vagas e eu não inventei uma. O texto do P.S. pode ser editado em Configurações. Atenção: um número fixo de vagas num e-mail automático fica falso com o tempo.

## Infraestrutura

3. **Sem acesso à documentação online nesta sessão** (resend.com e vercel.com bloqueados pela rede). Para o Resend, usei os tipos do SDK instalado (`resend@6`): `emails.send(payload, { idempotencyKey })`, `webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret })` e os nomes de evento `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.suppressed`. O limite do Vercel Cron por plano vem da minha memória (Hobby: no máximo 1 vez por dia; Pro: a cada minuto). Confira na Vercel antes de publicar.
4. **shadcn/ui:** o registro online estava bloqueado. Os componentes (Button, Card, Badge, Input, Table) foram escritos à mão no mesmo padrão do shadcn (Tailwind + class-variance-authority), e o `components.json` está pronto para adicionar outros com `npx shadcn add`.
5. **Next.js 16:** `cacheComponents` desligado. O painel lê cookies e banco a cada requisição, então todas as páginas são dinâmicas.
6. **Migrations:** o script `vercel-build` aplica as migrations antes do build. A Vercel usa esse script automaticamente.

## Simulação e envio real

7. **DRY_RUN em duas camadas.** O envio real só acontece se a variável `DRY_RUN=false` **e** a chave “Simulação” do painel estiver desligada. Qualquer uma das duas ligada mantém a simulação. Sem a variável, o padrão é simulação.
8. **Pausa global:** enquanto estiver ligada, o dispatcher não processa nada e os e-mails continuam na fila. Se a pausa passar de `MAX_LATENESS_HORAS`, eles expiram quando a pausa acabar (regra 7). Assim a pausa para tudo sem perder o histórico.
9. **Configuração incompleta** (remetente, reply-to, endereço postal, e-mail de suporte, RESEND_API_KEY): o envio real não roda e aparece um alerta. A simulação continua funcionando.
10. **Configurações:** um valor salvo no painel tem prioridade sobre a variável de ambiente. A variável é o valor padrão.

## Webhook da Perfect Pay

11. **Nomes de campo são hipóteses.** Sem payloads reais e sem acesso à documentação, o adaptador (`src/lib/perfectpay/adapter.ts`) usa o formato público que eu conhecia do postback da Perfect Pay (`sale_status_enum`, `sale_status_detail`, `code`, `customer.email`, `product.code`, `plan.code`, `date_approved`...). Os fixtures em `tests/fixtures/perfectpay/` se chamam `hipotetico-*`. **Confirme com payloads reais antes de desligar a simulação.** Qualquer evento que não bata com o esperado vira “não reconhecido” e não dispara nada.
12. **Mapa de status (hipótese):** 1 → aguardando; 2 e 10 → aprovada; 5 → recusada; 6, 12 e 13 → abandono; 7 → reembolso; 9 → chargeback; o resto → “outro”. “Saldo insuficiente” é detectado no texto de `sale_status_detail` (insufficient / saldo / funds).
13. **Datas sem fuso** (“2026-11-04 10:00:00”) são tratadas como horário de São Paulo, porque a Perfect Pay é brasileira. A confirmar.
14. **Moeda:** só uso um código de 3 letras se vier. O `currency_enum` numérico não é interpretado.
15. **Evento repetido:** o primeiro fica com índice único (provider, chave). As repetições também são gravadas, como “duplicado”, sem nenhum efeito, para auditoria.
16. **Sem ID de evento:** a chave é `transactionId + status + data`. Sem transactionId, é um hash de e-mail + produto + status + data.
17. **Produto ambíguo** (bate com mais de uma chave): tratado como não mapeado, sem disparo.
18. **Eventos de produto não mapeado** não criam cliente. Ficam só na lista de eventos.
19. **Fuso do cliente:** o webhook não traz fuso. Para clientes dos EUA uso o fuso principal do estado (`src/lib/util/zones.ts`). Isso evita, por exemplo, mandar e-mail às 5h para a Califórnia. Sem estado, ou fora dos EUA, uso America/New_York.
20. **Token opcional:** se `PERFECTPAY_TOKEN` estiver definido, o campo `token` do payload (ou o cabeçalho `x-perfectpay-token`) precisa ser igual a ele.
21. **Processamento logo depois da resposta** (`after()` do Next.js). Eventos que ficarem como “recebido” por mais de 2 minutos são processados pelo dispatcher, e qualquer evento pode ser reprocessado pelo painel (o adaptador roda de novo sobre o payload bruto).
22. **Limite de requisições:** 600 por minuto por IP no webhook, e tentativas com segredo errado são contadas à parte.
