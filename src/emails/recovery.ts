/** Recuperação: texto copiado de docs/fontes/Recuperacao (quem nao comprou).md. */
import { LINKS } from "./links";
import { greeting } from "./upsells";
import type { Block, EmailContext, Template } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const ul = (...items: string[]): Block => ({ kind: "ul", items });
const ol = (...items: string[]): Block => ({ kind: "ol", items });
const button = (text: string, href: string): Block => ({ kind: "button", text, href });

/** “{{first_name}}, ” sai do assunto quando não há nome. */
const named = (c: EmailContext, rest: string) => (c.firstName ? `${c.firstName}, ${rest}` : rest);

export const rec_a1: Template = (c) => ({
  subject: named(c, "did something go wrong?"),
  preview: "Your 11:22 Sequence order isn’t finished",
  blocks: [
    greeting(c),
    p("A few minutes ago you started your order for The 11:22 Abundance Sequence, but it wasn’t completed."),
    p("Maybe you got interrupted. Maybe the page didn’t load. It happens."),
    p("You can pick up right where you left off:"),
    button("Finish my order →", c.mainCheckoutUrl),
    p("Here’s what you get:"),
    ul(
      "11 conscious hypnobreathing sessions, one per day, about 22 minutes each",
      "3 bonuses: the Holographic Money Hypnobreathing Session, the Break Free from Your Parents Masterclass, and Millionaire Mind",
      "Access to our private community and email support",
      "Lifetime access",
    ),
    p("All for $47, one time."),
    p("And you’re covered: you have 30 days to try it. If it’s not for you, we refund your money and you keep the bonuses."),
    p("If you have any question, just reply to this email. A real person will answer."),
    p("Nathan"),
  ],
});

export const rec_a2: Template = (c) => {
  const o = c.opts;
  const testimonial =
    o.recA2TestimonialAuthorized && o.recA2TestimonialName
      ? [
          p("Here’s what one student wrote:"),
          p(
            `“It is a gradual process, and every morning I find something new within myself. I feel a great deal of peace, and I am becoming increasingly present.” — ${o.recA2TestimonialName}`,
          ),
        ]
      : [];
  const contact = c.supportWhatsappUrl
    ? `write to us at ${c.supportEmail} or on [WhatsApp](${c.supportWhatsappUrl})`
    : c.supportEmail
      ? `write to us at ${c.supportEmail}`
      : "reply to this email";
  return {
    subject: "“I’ve never done anything like this”",
    preview: "The question I hear most before people start",
    blocks: [
      greeting(c),
      p("Yesterday you were about to start the 11:22 Sequence."),
      p("If you stopped to think about it, I understand. Starting something new asks for a little trust."),
      p("These are the three questions I hear most:"),
      p("**“I’ve never done breathwork. Will I know how?”**"),
      p(
        "Yes. Before the first session there’s a welcome module where I explain everything step by step: what you’ll feel, how to prepare, and what to do if this or that happens. After that, you just lie down, put on your headphones, press play, and follow the guidance.",
      ),
      p("**“I’ve already tried so many things. Why would this be different?”**"),
      p("Most programs work through the mind: reading, affirmations, understanding. This one works through the body, combining a specific way of breathing with hypnosis. That’s the difference."),
      p("**“What if it’s not for me?”**"),
      p("You have 30 days. If you’re not surprised by what you feel, write to my team and we’ll refund you. You keep the bonuses as a thank-you for trying."),
      p("And if you complete the full journey, eleven days with one session per day, you can use your $47 again to invest in more of our courses."),
      ...testimonial,
      button("Start The 11:22 Sequence →", c.mainCheckoutUrl),
      p("Nathan"),
      p(`P.S. Some banks block online purchases for security. If your card is declined, call your bank or ${contact} and we’ll help you.`),
    ],
  };
};

export const rec_b1: Template = (c) => ({
  subject: "your payment didn’t go through",
  preview: "It’s usually a quick fix",
  blocks: [
    greeting(c),
    p("Your payment for The 11:22 Abundance Sequence didn’t go through, so your order isn’t complete yet."),
    p("This happens more often than you’d think, and it’s usually the bank, not you. Here’s how to fix it in a couple of minutes:"),
    ol(
      "Check the card number, expiration date, security code, and billing address.",
      c.opts.recB1OtherPaymentEnabled && c.opts.recB1OtherPaymentText.trim()
        ? `Try a different card. ${c.opts.recB1OtherPaymentText.trim()}`
        : "Try a different card.",
      "If everything is correct, call or message your bank and ask them to allow online purchases. Some banks block them by default for security.",
    ),
    button("Try again →", c.mainCheckoutUrl),
    p(
      c.supportWhatsappUrl
        ? `If it still doesn’t work, reply to this email or message us on [WhatsApp](${c.supportWhatsappUrl}). We’ll help you finish.`
        : "If it still doesn’t work, reply to this email. We’ll help you finish.",
    ),
    p("Nathan"),
  ],
});

export const rec_b2: Template = (c) => ({
  subject: "still want to start?",
  preview: "Here’s the quickest way back in",
  blocks: [
    greeting(c),
    p("Yesterday your payment for The 11:22 Abundance Sequence didn’t go through."),
    p("If you still want to start, this is the direct link:"),
    button("Complete my order →", c.mainCheckoutUrl),
    p("A quick reminder of what’s waiting for you: 11 hypnobreathing sessions at about 22 minutes a day, 3 bonuses, the community, email support, and a 30-day guarantee."),
    p("If the problem was your card, a different card or a call to your bank usually solves it. If you’d like help, just reply with a short note and my team will get you through."),
    p("Nathan"),
    p("P.S. If now isn’t the right moment, that’s okay. The program will be here."),
  ],
});

export const rec_f3: Template = (c) => ({
  subject: named(c, "$27 instead of $47 (48 hours)"),
  preview: "My last note about your order",
  blocks: [
    greeting(c),
    p("This is my last note about your order."),
    p("I’d rather see you start than see this fade away."),
    p(`So for the next 48 hours, until ${c.deadline}, you can start for $27 instead of $47.`),
    p("It’s exactly the same program:"),
    ul(
      "11 conscious hypnobreathing sessions, one per day",
      "The 3 bonuses",
      "The private community and email support",
      "Lifetime access",
    ),
    p("One payment. No subscription."),
    p("You have the same protection as always: 30 days to try it. If it’s not for you, we refund you and you keep the bonuses."),
    button("Start for $27 →", LINKS.main27),
    ...(c.flowType === "recovery_b"
      ? [
          p(
            "If your card gave you trouble before, try a different card or ask your bank to allow online purchases. If you need help, reply to this email and my team will take care of it.",
          ),
        ]
      : []),
    p(`After ${c.deadline}, the price goes back to $47 and I won’t send more reminders about this.`),
    p("Nathan"),
    p("P.S. You don’t have to be sure. You only have to be curious enough to press play on the first session."),
  ],
});
