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
