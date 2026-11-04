# Recuperação do produto principal ($47)

Este tab trata de quem **quase comprou** o produto de $47: carrinho ou checkout abandonado e cartão recusado. Quem já comprou recebe a sequência de upsells da primeira aba, não esta.

## O que o mercado mostra

As fontes concordam em quatro pontos: mande o primeiro e-mail rápido, use poucos e-mails, deixe o desconto para o fim e, no cartão recusado, facilite ao máximo a segunda tentativa. Os números vêm de blogs de fornecedores de software e mudam de uma fonte para outra, então use-os como direção, não como promessa de resultado.

| Tema | O que as fontes dizem | O que faremos |
| --- | --- | --- |
| Primeiro e-mail | Quem já digitou os dados (checkout) tem intenção alta: primeiro e-mail em 30 a 60 minutos. A sequência-padrão de carrinho usa 1 a 4 horas, 24 horas e 48 a 72 horas. | Primeiro e-mail 30 minutos depois |
| Quantidade | Para produto abaixo de $50, 3 e-mails em 3 dias. Passar de 3 ou 4 aumenta descadastros sem ganho proporcional. | 3 e-mails de checkout abandonado |
| Desconto | Não no primeiro e-mail, porque ensina a pessoa a abandonar para ganhar cupom. Guardar para o último, com prazo. | Desconto só no 3º e-mail |
| Cartão recusado | Avisar em até 1 hora, explicar em linguagem simples, dar um link direto sem etapas extras e fazer a resposta chegar a uma pessoa. | E-mail em 10 minutos e outro em 24 horas |
| Tipo de recusa | Recusa “dura” (cartão vencido, bloqueado) só se resolve com outro cartão. Recusa “suave” (saldo, bloqueio temporário) pode funcionar mais tarde. | Mensagem muda conforme o motivo, quando a plataforma informar |
| Expectativa | Cerca de 70% dos carrinhos são abandonados, e uma parte grande só estava olhando. Muitos motivos são confiança no pagamento e dúvida sobre o produto. | O e-mail 2 trata dúvida e confiança com garantia |

Ressalva: as fontes de cartão recusado falam de assinaturas (SaaS). Como o seu produto é compra única, aproveitei só a parte que serve: rapidez, linguagem simples, link direto e suporte humano. Não há nova cobrança automática, então a segunda tentativa depende sempre da pessoa.

**Fontes:** [Attribuly, timing de e-mails de carrinho](https://attribuly.com/blog/abandoned-cart-email-timing/) e [DEV Community, sequência de cobrança de pagamentos recusados](https://dev.to/insightlab/the-dunning-email-sequence-that-recovers-30-of-failed-payments-2edh) (li as duas páginas inteiras). Também consultei, só pelo resumo da busca, [Growth Suite sobre desconto no 3º e-mail](https://www.growthsuite.net/questions/what-s-the-best-email-sequence-for-abandoned-cart-discount-recovery) e [Stackmatix sobre quantidade de e-mails](https://www.stackmatix.com/blog/cart-abandonment-email-sequence). Consulta feita em 04/11/2026.

## Estratégia

São **dois fluxos curtos**, um para quem abandonou o checkout e outro para quem teve o cartão recusado. Os dois terminam no mesmo e-mail final, que é o único com desconto. Cada pessoa recebe no máximo 3 e-mails em 3 dias.

A sua intuição está certa: o primeiro e-mail deve sair logo (30 minutos), e quem teve o cartão recusado recebe o primeiro em 10 minutos, porque aí o problema é técnico e a pessoa ainda quer comprar. A única parte que eu mudaria é o desconto no primeiro e-mail. As fontes alertam que isso ensina a pessoa a abandonar de propósito, e a maioria dos abandonos é distração, não preço. Por isso o desconto fica para o último e-mail, com prazo.

### O que o aplicativo faz com cada evento do webhook

| Evento | Ação |
| --- | --- |
| Compra aprovada | Cancela qualquer recuperação pendente daquele e-mail. Inicia a sequência de upsells (aba “Upsells”) |
| Carrinho ou checkout abandonado | Inicia o **Fluxo A** |
| Cartão recusado | Cancela o Fluxo A se estiver ativo e inicia o **Fluxo B** |
| Reembolso, chargeback ou descadastro | Remove a pessoa de tudo |

### Os dois fluxos

- **Fluxo A, abandono:** A1 em 30 minutos (lembrete, sem desconto) → A2 em 24 horas (dúvidas e garantia) → **F3** em 72 horas (última chamada com desconto).
- **Fluxo B, cartão recusado:** B1 em 10 minutos (como resolver) → B2 em 24 horas (ainda quer começar?) → **F3** em 72 horas, o mesmo e-mail final do Fluxo A, com um parágrafo extra sobre o cartão.

### Regras para o aplicativo

1. **Sem duplicar:** use o ID do evento do webhook. O mesmo evento recebido duas vezes não inicia dois fluxos.
2. **Conferir antes de cada envio:** se a pessoa já tem compra aprovada, cancele o envio. É o erro mais caro de cometer (cobrar “termine sua compra” de quem já comprou).
3. **Um fluxo por vez:** um novo abandono dentro de um fluxo ativo não reinicia nada. Quem abandona de novo depois de 30 dias entra de novo, mas sem receber o desconto outra vez.
4. **Horário:** não envie entre 22h e 7h no fuso da pessoa. Se o evento ocorrer à noite, envie às 8h. Se o webhook não informar o fuso, use o horário do leste dos EUA.
5. **Recusa por saldo:** se o webhook informar “saldo insuficiente”, mande o B2 em 48 horas em vez de 24, para dar tempo de cair o pagamento. Qualquer outro motivo segue o prazo normal.
6. **Link do e-mail:** use o link de recuperação da plataforma, que reabre o checkout com os dados já preenchidos, se ele existir. Senão, use o link normal do checkout. Cada passo a mais custa vendas.
7. **Upsells também no link recuperado:** quem compra depois de um e-mail de recuperação, inclusive pelo link de $27, tem que passar pelas três páginas de upsell e entrar na sequência de upsells como qualquer comprador. Teste isso antes de ativar.
8. **Remetente e resposta:** envie como “Nathan Miller” e deixe as respostas chegarem a uma pessoa da sua equipe. Dúvidas respondidas rápido vendem.
9. **Limite diário:** nunca mais de 1 e-mail de recuperação por dia por pessoa.

### O desconto

Sugestão: **$27 no lugar de $47, por 48 horas**, só no F3. O link da oferta de $27 já existe: confirme que ele tem os mesmos upsells e que expira na data do e-mail. É um desconto de $20 (43%), bem acima dos 5% a 10% que as fontes citam para lojas, então o teste abaixo importa. Depois de algumas semanas, compare as vendas do F3 com o desconto e as do A2 sem desconto. Se o desconto não trouxer vendas a mais do que o A2, tire-o e use só a garantia.

Outros dois pontos já estão no seu produto e funcionam melhor do que cupom: a **garantia de 30 dias** (a pessoa mantém os bônus) e a promessa de que **o valor pago volta para investir em outros cursos** ao concluir as 11 sessões. Os e-mails 2 e 3 usam as duas.

## Calendário

Os tempos contam a partir do evento do webhook. Cinco e-mails escritos cobrem os dois fluxos, porque o F3 é compartilhado.

| E-mail | Fluxo | Quando | Objetivo | Link | Desconto |
| --- | --- | --- | --- | --- | --- |
| A1 | Abandono | 30 min | Lembrar e remover o atrito | Checkout $47 | Não |
| A2 | Abandono | 24 h | Responder as dúvidas e mostrar a garantia | Checkout $47 | Não |
| B1 | Cartão recusado | 10 min | Explicar como resolver e dar o link direto | Checkout $47 | Não |
| B2 | Cartão recusado | 24 h (48 h se for saldo) | Reabrir sem pressão | Checkout $47 | Não |
| F3 | Os dois | 72 h | Última chamada com prazo | Checkout $27 | Sim, 48 h |

Depois do F3, a recuperação termina. Se a pessoa não comprar, ela segue para a sua rotina normal de e-mails, se você tiver uma.

## Cópias dos e-mails (em inglês)

Assine como “Nathan”. Os links dos botões são: **checkout de $47** https://go.centerpag.com/PPU38CQFMQH e **oferta de $27** https://go.centerpag.com/PPU38CQFMQG (só no F3, com prazo real).

### A1 · Abandono · 30 minutos depois

**Ângulo:** utilidade pura. Lembrete curto, sem desconto, com o que a pessoa leva e a garantia.

**Assunto:** {{first\_name}}, did something go wrong?

**Preview:** Your 11:22 Sequence order isn’t finished

Hi {{first\_name}},

A few minutes ago you started your order for The 11:22 Abundance Sequence, but it wasn’t completed.

Maybe you got interrupted. Maybe the page didn’t load. It happens.

You can pick up right where you left off:

**\[BOTÃO\]** Finish my order → https://go.centerpag.com/PPU38CQFMQH

Here’s what you get:

- 11 conscious hypnobreathing sessions, one per day, about 22 minutes each
- 3 bonuses: the Holographic Money Hypnobreathing Session, the Break Free from Your Parents Masterclass, and Millionaire Mind
- Access to our private community and email support
- Lifetime access

All for $47, one time.

And you’re covered: you have 30 days to try it. If it’s not for you, we refund your money and you keep the bonuses.

If you have any question, just reply to this email. A real person will answer.

Nathan

### A2 · Abandono · 24 horas depois

**Ângulo:** responde as três dúvidas que mais seguram a compra (nunca fiz, já tentei de tudo, e se não for para mim) e fecha com garantia e um depoimento.

**Assunto:** “I’ve never done anything like this”

**Preview:** The question I hear most before people start

Hi {{first\_name}},

Yesterday you were about to start the 11:22 Sequence.

If you stopped to think about it, I understand. Starting something new asks for a little trust.

These are the three questions I hear most:

**“I’ve never done breathwork. Will I know how?”**

Yes. Before the first session there’s a welcome module where I explain everything step by step: what you’ll feel, how to prepare, and what to do if this or that happens. After that, you just lie down, put on your headphones, press play, and follow the guidance.

**“I’ve already tried so many things. Why would this be different?”**

Most programs work through the mind: reading, affirmations, understanding. This one works through the body, combining a specific way of breathing with hypnosis. That’s the difference.

**“What if it’s not for me?”**

You have 30 days. If you’re not surprised by what you feel, write to my team and we’ll refund you. You keep the bonuses as a thank-you for trying.

And if you complete the full journey, eleven days with one session per day, you can use your $47 again to invest in more of our courses.

Here’s what one student wrote:

“It is a gradual process, and every morning I find something new within myself. I feel a great deal of peace, and I am becoming increasingly present.” \[Evelyn, with permission\]

**\[BOTÃO\]** Start The 11:22 Sequence → https://go.centerpag.com/PPU38CQFMQH

Nathan

P.S. Some banks block online purchases for security. If your card is declined, call your bank or write to us at \[support email / WhatsApp link\] and we’ll help you.

### B1 · Cartão recusado · 10 minutos depois

**Ângulo:** problema técnico, não decisão. Linguagem simples, três passos e o link direto.

**Assunto:** your payment didn’t go through

**Preview:** It’s usually a quick fix

Hi {{first\_name}},

Your payment for The 11:22 Abundance Sequence didn’t go through, so your order isn’t complete yet.

This happens more often than you’d think, and it’s usually the bank, not you. Here’s how to fix it in a couple of minutes:

1. Check the card number, expiration date, security code, and billing address.
2. Try a different card. \[Or another payment method, if your checkout offers one.\]
3. If everything is correct, call or message your bank and ask them to allow online purchases. Some banks block them by default for security.

**\[BOTÃO\]** Try again → https://go.centerpag.com/PPU38CQFMQH

If it still doesn’t work, reply to this email or message us on WhatsApp \[link\]. We’ll help you finish.

Nathan

### B2 · Cartão recusado · 24 horas depois (48 horas se o motivo for saldo)

**Ângulo:** reabrir sem pressão, repetir o link e oferecer ajuda humana.

**Assunto:** still want to start?

**Preview:** Here’s the quickest way back in

Hi {{first\_name}},

Yesterday your payment for The 11:22 Abundance Sequence didn’t go through.

If you still want to start, this is the direct link:

**\[BOTÃO\]** Complete my order → https://go.centerpag.com/PPU38CQFMQH

A quick reminder of what’s waiting for you: 11 hypnobreathing sessions at about 22 minutes a day, 3 bonuses, the community, email support, and a 30-day guarantee.

If the problem was your card, a different card or a call to your bank usually solves it. If you’d like help, just reply with a short note and my team will get you through.

Nathan

P.S. If now isn’t the right moment, that’s okay. The program will be here.

### F3 · Os dois fluxos · 72 horas depois (desconto de 48 horas)

**Ângulo:** último aviso, preço de $27 com prazo real, mesma proteção. Um parágrafo extra só para quem teve o cartão recusado.

**Assunto:** {{first\_name}}, $27 instead of $47 (48 hours)

**Preview:** My last note about your order

Hi {{first\_name}},

This is my last note about your order.

I’d rather see you start than see this fade away.

So for the next 48 hours, until \[DATE, TIME, TIME ZONE\], you can start for $27 instead of $47.

It’s exactly the same program:

- 11 conscious hypnobreathing sessions, one per day
- The 3 bonuses
- The private community and email support
- Lifetime access

One payment. No subscription.

You have the same protection as always: 30 days to try it. If it’s not for you, we refund you and you keep the bonuses.

**\[BOTÃO\]** Start for $27 → https://go.centerpag.com/PPU38CQFMQG

&#91;Só para o Fluxo B: If your card gave you trouble before, try a different card or ask your bank to allow online purchases. If you need help, reply to this email and my team will take care of it.\]

After \[DATE\], the price goes back to $47 and I won’t send more reminders about this.

Nathan

P.S. You don’t have to be sure. You only have to be curious enough to press play on the first session.

## Medição e o que confirmar antes de ativar

### O que o aplicativo deve registrar

- **Taxa de recuperação por fluxo:** compras feitas até 7 dias depois do evento, divididas pelos eventos de abandono. As fontes citam de 5% a 15% para carrinhos, mas são faixas de lojas de e-commerce físico; compare com você mesmo ao longo das semanas.
- **Vendas e receita por e-mail** (A1, A2, B1, B2, F3), para saber qual e-mail paga a sequência.
- **Receita de upsells dos recuperados.** É onde o lucro maior costuma estar, porque a venda de $47 sozinha paga pouco.
- **Descadastros por e-mail.** Se subirem no F3, o desconto está cansando a lista.
- **Grupo de controle (opcional):** segure 10% dos eventos sem e-mail. Mostra quantos teriam comprado sozinhos. Só vale quando houver volume.

### O que confirmar

1. **Webhook:** ele separa “carrinho abandonado” de “checkout abandonado” e informa o motivo da recusa do cartão? Se tudo vier como um evento só, o Fluxo A cobre os dois e o B só entra quando houver recusa.
2. **Link de recuperação:** a plataforma gera um link que reabre o checkout com os dados preenchidos? Se não, use o link normal.
3. **Checkout de $27:** o link da oferta já existe: confirme que tem os mesmos upsells e expira no prazo do e-mail. Sem expiração, tire a frase de prazo do F3.
4. **Promessas do produto no A2:** confirme que a garantia é de 30 dias com bônus mantidos e que o valor pago pode ser reinvestido ao concluir as 11 sessões, como diz a sua VSL.
5. **Depoimento da Evelyn (A2):** use só com a permissão dela, ou troque por outro real.
6. **Contato de suporte:** e-mail e link de WhatsApp para o P.S. do A2 e o B1.
7. **Outras formas de pagamento:** se o checkout aceitar PayPal ou outro método, deixe a frase no B1. Senão, apague.
8. **Rodapé:** mantenha o link de descadastro e o endereço físico nos e-mails.

### Reforço opcional

As fontes citam mensagem de texto 1 a 2 horas depois como reforço. Nos EUA isso exige consentimento expresso da pessoa para receber mensagens de marketing. Só considere se o seu checkout já coletar esse consentimento.
