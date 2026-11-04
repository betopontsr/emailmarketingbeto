/**
 * Upsells: texto copiado de docs/fontes/Upsells (quem comprou).md.
 * Únicas mudanças (confirmadas pelo dono em 04/11/2026, ver docs/DECISOES.md):
 *   - upsell_1: “60 days” → “30 days”
 *   - upsell_4: “60-day guarantee” → “30-day guarantee”
 */
import { LINKS } from "./links";
import type { Block, EmailContext, Template } from "./types";

const p = (text: string): Block => ({ kind: "p", text });
const ul = (...items: string[]): Block => ({ kind: "ul", items });
const ol = (...items: string[]): Block => ({ kind: "ol", items });
const button = (text: string, href: string): Block => ({ kind: "button", text, href });
export const greeting = (c: EmailContext) => p(c.firstName ? `Hi ${c.firstName},` : "Hi there,");

export const upsell_1: Template = (c) => ({
  subject: "[11:22] did you close the page by accident?",
  preview: "Plus what to expect from today’s session",
  blocks: [
    greeting(c),
    p("Quick note before today’s session."),
    p("Right after you got your access to the 11:22 Sequence, a video came up."),
    p("In it, I told you about something I only offer at that moment: direct support from me throughout your whole 11:22 journey."),
    p("If you closed that page, I get it. Maybe it was an accident. Maybe your card failed. Maybe you thought, “let me feel the first session and then decide.”"),
    p("I get messages like these all the time:"),
    p("“Nathan, I closed the page by accident and now I can’t get back.”"),
    p("“My card was declined and I want to try again.”"),
    p("“I said no, but after the first session I changed my mind.”"),
    p("So I’m opening it again for you."),
    p("Here’s what it is:"),
    ul(
      "Direct access to me, whenever you need it, during your journey with the 11:22 Sequence",
      "Your questions answered, so you’re never guessing if you’re doing it right",
      "Mistakes corrected early, before they cost you days or weeks",
      "Someone on the other side when something emotional comes up (it can)",
    ),
    button("Yes, I want Nathan by my side — $67, one time →", LINKS.nathan67),
    p("No monthly fee. No renewal. Your payment details are already saved, so it takes one click."),
    p("And you have 30 days to try it. If it’s not for you, I refund everything."),
    p("If this doesn’t interest you, just ignore this part. No problem at all."),
    p("Now go enjoy today’s session. Today is Family Release, the one where many people start to notice something."),
    p("Nathan"),
    ...(c.opts.upsell1ScarcityEnabled && c.opts.upsell1ScarcityText.trim() ? [p(`P.S. ${c.opts.upsell1ScarcityText.trim()}`)] : []),
  ],
});

export const upsell_2: Template = (c) => ({
  subject: "[11:22] the tension that never goes away",
  preview: "It might not be yours",
  blocks: [
    greeting(c),
    p("Let me ask you something."),
    p("Do your shoulders feel heavier than they should, even when you haven’t carried anything?"),
    p("Do you wake up with a sore jaw, or has someone told you that you clench your teeth at night?"),
    p("Does the tension come back after every massage?"),
    p("In the video you watched, I explained how fears can be inherited and recorded in your cells."),
    p("Your body does something very similar."),
    p("The weight your father or mother carried without complaining or asking for help can stay in your shoulders."),
    p("And your jaw can hold everything that was never said in your family."),
    p("The 11:22 Sequence works from the inside out, through your emotions."),
    p("The Five Knots of the Body works from the outside in, through your body."),
    p("When you do both at the same time, the work goes deeper and moves faster."),
    p("Here’s how it works:"),
    ol(
      "You take a 3-minute test. It ranks your five areas from the most affected to the least.",
      "You choose where to start. Each area has its own guided release session, with movements led by my voice.",
      "An integration lesson helps everything settle.",
      "A five-night journal helps you notice what changes in your body.",
    ),
    p("No experience needed. You just follow my voice."),
    button("Get The Five Knots of the Body — $47, one time →", LINKS.knots47),
    p("It’s added to your 11:22 order. You don’t need to enter your details again."),
    p("You have 30 days to try it. If it’s not for you, send me an email and I’ll refund you. You can even keep the program."),
    p("This is not medical treatment. If you have persistent or severe pain, please talk to your doctor."),
    p("Nathan"),
    p("P.S. Shoulders and jaw are two of the five areas. The other three tend to surprise people."),
  ],
});

export const upsell_3: Template = (c) => ({
  subject: "[11:22] the noise at 3 a.m.",
  preview: "It didn’t start with you",
  blocks: [
    greeting(c),
    p("You know that moment when you turn off the light and, instead of falling asleep, everything starts?"),
    p("The thoughts. The doubts. The questions."),
    p("The quieter it gets outside, the louder it gets inside."),
    p("Or maybe you do fall asleep, and then you wake up at 3 a.m. and it all begins again."),
    p("I lived like that for years."),
    p("One phrase repeated in my head more than any other: “It’s not enough.”"),
    p("Is the business doing well? Not enough."),
    p("Am I loving with my child? Not enough."),
    p("Am I working hard? Not enough."),
    p("Then one day I realized those phrases weren’t mine. They were my mother’s and my father’s. I had absorbed them without knowing."),
    p("After working with more than 33,000 students, we found three frequencies of inherited mental noise:"),
    ul(
      "**The father frequency:** money, achievement. “You need to do more.” “If you relax, you’ll lose everything.”",
      "**The mother frequency:** deserving and control. “You don’t deserve this.” “Be careful.”",
      "**The ancestral frequency:** the oldest noise. “The world isn’t safe.”",
    ),
    p("I’m sure you recognized yourself in at least one."),
    p("That’s why I created Reclaim Your Peace of Mind:"),
    ul(
      "A 9-question test (3 minutes) that shows which frequency has the most power over you, and ranks all three",
      "Three silencing sessions, guided by my voice, one per frequency: you name the phrase, separate it from yourself, and turn the volume down",
      "The 3 A.M. Kit: three short audios, one per frequency, for the nights you wake up",
      "A journal to track the phrases and how they change",
    ),
    button("Reclaim Your Peace of Mind — $97, one time →", LINKS.reclaim97),
    p("Your access arrives by email within minutes. You don’t need to enter your details again."),
    p("You have 30 days to try it. If it does nothing for you, email us and we refund every dollar. No questions."),
    p("Nathan"),
    p("P.S. Tonight, when you turn off the light, notice which phrase shows up first. That’s the one to start with."),
  ],
});

export const upsell_4: Template = (c) => {
  const o = c.opts;
  // O texto de introdução fala em “two students”: o bloco só entra com os DOIS depoimentos autorizados.
  const testimonials =
    o.upsell4Testimonial1Authorized && o.upsell4Testimonial1Name && o.upsell4Testimonial2Authorized && o.upsell4Testimonial2Name
      ? [
          p("Here’s what two students told me about having support during the process:"),
          p(
            `“There were moments I felt lost, not knowing if I was doing it right. Having Nathan to answer was what kept me steady until the end. It’s not only the method. It’s knowing there’s someone on the other side when you need it.” — ${o.upsell4Testimonial1Name}`,
          ),
          p(
            `“I thought my block was only about money. In a conversation with Nathan, he helped me see it came from a much older tension connected to my father. Alone, I would never have seen that connection. Once I understood it, I could really release it.” — ${o.upsell4Testimonial2Name}`,
          ),
        ]
      : [];
  return {
    subject: "[11:22] I’d rather you didn’t do this part alone",
    preview: "Lower price, 48 hours only",
    blocks: [
      greeting(c),
      p("By now you’re deep into the 11:22 Sequence."),
      p("And the next sessions are the ones that tend to touch the most: separation, your inner child, your youth, your purpose."),
      p("That’s when many people feel lost, or wonder if they’re doing it right."),
      ...testimonials,
      p("That’s what direct support with me is:"),
      ul(
        "Access to me whenever you need it, during your 11:22 journey",
        "Your questions answered",
        "Mistakes corrected, so you apply the method exactly as it was designed",
      ),
      p(`It’s $67. But for the next 48 hours, until ${c.deadline}, I’m lowering it to $47.`),
      button("Yes, I want Nathan with me — $47, one time →", LINKS.nathan47),
      p("One payment. No monthly fee. 30-day guarantee: if it’s not for you, I refund everything."),
      p("After that, the offer closes and this is the last time I’ll mention it."),
      p("Nathan"),
      p("P.S. If you decide this isn’t for you, that’s completely fine. Keep breathing. Your sessions are all yours."),
    ],
  };
};

export const upsell_5: Template = (c) => ({
  subject: "[11:22] $19 until midnight",
  preview: "The Five Knots of the Body, last call",
  blocks: [
    greeting(c),
    p("Short one today."),
    p("A few days ago I told you about The Five Knots of the Body."),
    p("The program that works from the outside in, through your body, while the 11:22 Sequence works from the inside out, through your emotions."),
    p("If your shoulders, your jaw, or that tension that never leaves caught your attention, this is for you."),
    p("And this is the best moment for it: while your emotions are still moving, your body is more ready to let go."),
    p("The regular price is $47."),
    p(`Until tonight at midnight ${c.zoneAbbr}, it’s $19.`),
    p("For $19 you get:"),
    ul(
      "The 3-minute test that ranks your five areas",
      "Five guided release sessions, one per area",
      "The integration lesson",
      "The five-night journal",
    ),
    button("Get The Five Knots of the Body — $19, one time →", LINKS.knots19),
    p("30-day guarantee. If you try it and it’s not for you, send me an email, I refund you, and you keep the program."),
    p("After midnight, this page closes."),
    p("Nathan"),
    p("P.S. If you’re not interested, ignore this email. I won’t mention it again."),
  ],
});

export const upsell_6: Template = (c) => ({
  subject: "[11:22] what you hear after you let go",
  preview: "Quiet is not the same as calm",
  blocks: [
    greeting(c),
    p("By now you’ve either finished the 11 sessions or you’re very close."),
    p("That takes courage. Most people never even try."),
    p("You’ve been releasing a lot: ancestral memories, your parents’ patterns, birth, childhood."),
    p("And something interesting can happen afterward."),
    p("When there’s less weight, you start to hear things you couldn’t hear before."),
    p("The phrases that repeat in your head at night."),
    p("“It’s not enough.” “Be careful.” “The world isn’t safe.”"),
    p("That doesn’t mean you’re going backward. It means you can finally hear them."),
    p("And they didn’t start with you."),
    p("That’s exactly what Reclaim Your Peace of Mind is for."),
    p("You find out which of the three inherited frequencies (father, mother, ancestral) has the most power over you, and then you silence it, one session at a time:"),
    ul(
      "The 9-question test (3 minutes) that ranks your three frequencies",
      "Three silencing sessions guided by my voice",
      "The 3 A.M. Kit: three audios for when the noise wakes you up",
      "A journal to track the phrases and how they begin to change",
    ),
    p("I used to charge $500 for this in private, one-on-one sessions. Today it’s one complete program you can do at your own pace, with no appointments and no waiting lists."),
    ...(c.opts.upsell6CreditEnabled && c.opts.upsell6CreditInstructions.trim()
      ? [
          p(
            `Remember, when you complete the 11:22 Sequence you can use your $47 again to reinvest in our courses. Here’s how to use it: ${c.opts.upsell6CreditInstructions.trim()}`,
          ),
        ]
      : []),
    button("Reclaim Your Peace of Mind — $97, one time →", LINKS.reclaim97),
    p("You have 30 days to try it. If it doesn’t work for you, email us and we refund every dollar."),
    p("Nathan"),
    p("P.S. Being able to lie down at night with far less noise running the show is, to me, priceless."),
  ],
});

export const upsell_7: Template = (c) => ({
  subject: "[11:22] less than half price (48 hours)",
  preview: "The last time I’ll mention this",
  blocks: [
    greeting(c),
    p("This is the last time I’ll talk about Reclaim Your Peace of Mind."),
    p("Tonight, when you turn off the light, the noise will probably still be there, just like always."),
    p("The question isn’t whether it will show up."),
    p("The question is whether this will be one more night where it controls you, or the last one."),
    p("So I’m making it easier."),
    p(`The program is $97. Until ${c.deadline}, it’s $47.`),
    p("You get:"),
    ul(
      "The 9-question test that ranks your three frequencies",
      "Three silencing sessions, one for each frequency",
      "The 3 A.M. Kit, for the nights you wake up",
      "The journal",
    ),
    button("Reclaim Your Peace of Mind — $47, one time →", LINKS.reclaim47),
    p("It’s added to your order with one click, and your access arrives by email within minutes."),
    p("30-day guarantee. Try it. If it does nothing for you, email us and we refund every dollar."),
    p(`After ${c.deadline}, the price goes back up and this page closes.`),
    p("Nathan"),
    p("P.S. If this isn’t for you, that’s okay. Thank you for trusting me with the 11:22 Sequence. I’m glad you’re here."),
  ],
});
