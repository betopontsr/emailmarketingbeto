import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { simEvent } from "./helpers/sim";
import { receiveAndProcess } from "@/lib/pipeline/run";
import { advanceTestCustomer, claimDue, runDispatch } from "@/lib/dispatch/dispatcher";
import { customers, emailEvents, flows, purchases, scheduledEmails } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { Sender, SendInput } from "@/lib/email/sender";
import { saveSettings } from "@/lib/settings";
import { renderEmail, TEMPLATES } from "@/emails/render";
import { buildContext } from "@/lib/email/context";
import { parseSettings } from "@/lib/settings";
import { recordResendEvent } from "@/lib/email/events";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { TEMPLATE_KEYS } from "@/lib/engine/types";

const T0 = new Date("2026-11-04T15:00:00Z");
const H = 3600_000;
const D = 24 * H;

function fakeSender(results: Array<"ok" | "transient" | "fatal"> = []) {
  const sent: SendInput[] = [];
  let i = 0;
  const sender: Sender = {
    async send(input) {
      sent.push(input);
      const r = results[i++] ?? "ok";
      if (r === "ok") return { ok: true, id: `re_${sent.length}` };
      return { ok: false, transient: r === "transient", error: r };
    },
  };
  return { sent, getSender: () => sender };
}

async function realMode(db: Db) {
  process.env.DRY_RUN = "false";
  process.env.RESEND_API_KEY = "re_test";
  await saveSettings(db, {
    dryRun: false,
    emailFromAddress: "nathan@example.com",
    emailReplyTo: "help@example.com",
    supportEmail: "help@example.com",
    postalAddress: "123 Main St, New York, NY",
  });
}
function restoreEnv() {
  process.env.DRY_RUN = "true";
  delete process.env.RESEND_API_KEY;
}

async function emails(db: Db) {
  return db.select().from(scheduledEmails).orderBy(scheduledEmails.scheduledFor);
}

describe("dispatcher", () => {
  it("simulação: grava como dry_run e nada sai pelo Resend", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    const s = fakeSender();
    const r = await runDispatch(db, { now: new Date(T0.getTime() + 31 * 60_000), getSender: s.getSender });
    expect(r.dryRun).toBe(true);
    expect(s.sent).toHaveLength(0);
    const [a1] = await emails(db);
    expect(a1.status).toBe("dry_run");
    expect(a1.renderedHtml).toContain("Finish my order");
    expect(a1.renderedSubject).toBe("John, did something go wrong?");
    await close();
  });

  it("envio real: cabeçalhos de descadastro, tags e chave de idempotência", async () => {
    const { db, close } = await createTestDb();
    await realMode(db);
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "payment_declined", at: T0 }) }, { now: T0 });
    const s = fakeSender();
    await runDispatch(db, { now: new Date(T0.getTime() + 11 * 60_000), getSender: s.getSender });
    expect(s.sent).toHaveLength(1);
    const m = s.sent[0];
    const [b1] = await emails(db);
    expect(m.idempotencyKey).toBe(`scheduled-email/${b1.id}`);
    expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(m.headers["List-Unsubscribe"]).toMatch(/^<http.*\/api\/unsubscribe\/\d+\.[^>]+>, <mailto:help@example\.com\?subject=unsubscribe>$/);
    expect(m.html).toContain("Unsubscribe");
    expect(m.tags).toContainEqual({ name: "template", value: "rec_b1" });
    expect(m.from).toBe("Nathan Miller <nathan@example.com>");
    expect(m.replyTo).toBe("help@example.com");
    expect(m.text).toContain("123 Main St");
    expect(b1.status).toBe("sent");
    expect(b1.resendId).toBe("re_1");
    restoreEnv();
    await close();
  });

  it("configuração incompleta bloqueia envio real; simulação segue", async () => {
    const { db, close } = await createTestDb();
    process.env.DRY_RUN = "false";
    await saveSettings(db, { dryRun: false });
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    const r = await runDispatch(db, { now: new Date(T0.getTime() + H), getSender: fakeSender().getSender });
    expect(r.blocked).toContain("configuração incompleta");
    expect((await emails(db))[0].status).toBe("scheduled");
    restoreEnv();
    await close();
  });

  it("falha temporária: 3 tentativas com espera crescente, depois failed", async () => {
    const { db, close } = await createTestDb();
    await realMode(db);
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    const s = fakeSender(["transient", "transient", "transient"]);
    let now = new Date(T0.getTime() + 31 * 60_000);
    await runDispatch(db, { now, getSender: s.getSender });
    let [a1] = await emails(db);
    expect(a1.status).toBe("scheduled");
    expect(a1.attempts).toBe(1);
    expect(a1.scheduledFor.getTime()).toBe(now.getTime() + 60_000);
    now = new Date(now.getTime() + 60_000);
    await runDispatch(db, { now, getSender: s.getSender });
    [a1] = await emails(db);
    expect(a1.attempts).toBe(2);
    expect(a1.scheduledFor.getTime()).toBe(now.getTime() + 5 * 60_000);
    now = new Date(now.getTime() + 5 * 60_000);
    await runDispatch(db, { now, getSender: s.getSender });
    [a1] = await emails(db);
    expect(a1.status).toBe("failed");
    expect(s.sent).toHaveLength(3);
    expect(new Set(s.sent.map((x) => x.idempotencyKey)).size).toBe(1);
    restoreEnv();
    await close();
  });

  it("execuções sobrepostas nunca pegam o mesmo e-mail", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    const now = new Date(T0.getTime() + 4 * D);
    const a = await claimDue(db, now, 50);
    const b = await claimDue(db, now, 50);
    expect(a.length).toBe(3);
    expect(b.length).toBe(0);
    await close();
  });

  it("atraso acima do limite expira", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    await runDispatch(db, { now: new Date(T0.getTime() + 14 * H), getSender: fakeSender().getSender });
    const [a1] = await emails(db);
    expect(a1.status).toBe("expired");
    await close();
  });

  it("compra aprovada depois do início cancela; guarda cancela se a compra entrou no meio", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    // simula compra registrada sem passar pelo motor (ex.: outra instância) — a guarda tem de barrar
    const [c] = await db.select().from(customers);
    await db.insert(purchases).values({ transactionId: "X", customerId: c.id, productKey: "main", purchasedAt: T0 });
    await runDispatch(db, { now: new Date(T0.getTime() + 31 * 60_000), getSender: fakeSender().getSender });
    const [a1] = await emails(db);
    expect(a1.status).toBe("cancelled");
    expect(a1.statusReason).toBe("já comprou o produto principal");
    await close();
  });

  it("fluxo de upsell inteiro: 7 e-mails, compra no meio, termina completo após o upsell_7", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: T0, tx: "M" }), isTest: true }, { now: T0 });
    const [c] = await db.select().from(customers);
    const s = fakeSender();
    const steps: string[] = [];
    for (let i = 0; i < 10; i++) {
      const due = await advanceTestCustomer(db, c.id, T0);
      if (!due.length) break;
      await runDispatch(db, { now: T0, getSender: s.getSender, onlyIds: due });
      const sent = (await emails(db)).filter((e) => e.status === "dry_run").map((e) => e.templateKey);
      steps.push(sent.at(-1)!);
      if (sent.length === 1) {
        // comprou o Nathan depois do upsell_1
        await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "purchase_approved", at: T0, code: "PPU38CQGGFQ", tx: "N", amount: 47 }), isTest: true }, { now: T0 });
      }
    }
    const all = await emails(db);
    expect(all.find((e) => e.templateKey === "upsell_4")?.status).toBe("cancelled");
    expect(all.filter((e) => e.status === "dry_run").map((e) => e.templateKey)).toEqual(["upsell_1", "upsell_2", "upsell_3", "upsell_5", "upsell_6", "upsell_7"]);
    const [flow] = await db.select().from(flows);
    expect(flow.status).toBe("completed");
    const [nathan] = await db.select().from(purchases).where(eq(purchases.transactionId, "N"));
    const u1 = all.find((e) => e.templateKey === "upsell_1")!;
    expect(nathan.attributedEmailId).toBe(u1.id);
    expect(s.sent).toHaveLength(0); // cliente de teste nunca envia de verdade
    await close();
  });

  it("Fluxo A inteiro e reentrada após 30 dias sem F3", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }), isTest: true }, { now: T0 });
    const [c] = await db.select().from(customers);
    for (let i = 0; i < 5; i++) {
      const due = await advanceTestCustomer(db, c.id, T0);
      if (!due.length) break;
      await runDispatch(db, { now: T0, getSender: fakeSender().getSender, onlyIds: due });
    }
    let all = await emails(db);
    expect(all.map((e) => [e.templateKey, e.status])).toEqual([
      ["rec_a1", "dry_run"],
      ["rec_a2", "dry_run"],
      ["rec_f3", "dry_run"],
    ]);
    const [f1] = await db.select().from(flows);
    expect(f1.status).toBe("completed");
    expect(f1.f3Sent).toBe(true);
    const f3 = all.find((e) => e.templateKey === "rec_f3")!;
    expect(f3.renderedHtml).toContain("https://go.centerpag.com/PPU38CQFMQG");
    expect(f3.renderedHtml).not.toContain("If your card gave you trouble before");

    const later = new Date(f1.endedAt!.getTime() + 31 * D);
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: later }), isTest: true }, { now: later });
    all = await emails(db);
    expect(all.filter((e) => e.status === "scheduled").map((e) => e.templateKey)).toEqual(["rec_a1", "rec_a2"]);
    await close();
  });
});

describe("templates", () => {
  const s = parseSettings({ supportEmail: "help@example.com" });
  const ctxFor = (firstName: string | null, type: "upsell" | "recovery_a" | "recovery_b" = "upsell") =>
    buildContext(s, { firstName, timezone: "America/New_York" }, { type, recoveryUrl: null }, new Date("2026-11-18T15:00:00Z")).ctx;
  const footer = { unsubscribeUrl: "https://app/u/x", postalAddress: "123 Main St" };

  it("os 12 templates existem e renderizam HTML, texto e preheader", () => {
    for (const k of TEMPLATE_KEYS) {
      const r = renderEmail(k, ctxFor("John"), footer);
      expect(r.subject.length).toBeGreaterThan(3);
      expect(r.html).toContain(r.preview.replace(/’/g, "’"));
      expect(r.html).toContain("Unsubscribe");
      expect(r.text).toContain("123 Main St");
      expect(r.html).not.toContain("{{");
      expect(r.html).not.toMatch(/\\\[/);
    }
    expect(Object.keys(TEMPLATES)).toHaveLength(12);
  });

  it("sem nome: “Hi there,” e assunto sem o nome", () => {
    const r = renderEmail("rec_a1", ctxFor(null, "recovery_a"), footer);
    expect(r.subject).toBe("did something go wrong?");
    expect(r.text.startsWith("Hi there,")).toBe(true);
    expect(renderEmail("rec_f3", ctxFor(null), footer).subject).toBe("$27 instead of $47 (48 hours)");
    expect(renderEmail("rec_f3", ctxFor("JOHN"), footer).subject).toBe("John, $27 instead of $47 (48 hours)");
  });

  it("prazos no fuso do cliente", () => {
    const r = renderEmail("upsell_4", ctxFor("John"), footer);
    expect(r.text).toContain("until Friday, Nov 20 at 10:00 AM EST, I’m lowering it to $47.");
    expect(renderEmail("upsell_5", ctxFor("John"), footer).text).toContain("Until tonight at midnight EST, it’s $19.");
    expect(renderEmail("rec_f3", ctxFor("John"), footer).text).toContain("After Friday, Nov 20 at 10:00 AM EST, the price goes back to $47");
  });

  it("garantia de 30 dias (decisão do dono) e prefixo [11:22]", () => {
    const u1 = renderEmail("upsell_1", ctxFor("John"), footer);
    const u4 = renderEmail("upsell_4", ctxFor("John"), footer);
    expect(u1.text).toContain("And you have 30 days to try it.");
    expect(u4.text).toContain("30-day guarantee");
    expect(u1.text + u4.text).not.toContain("60");
    expect(u1.subject).toBe("[11:22] did you close the page by accident?");
    // P.S. de escassez (vagas) desligado por decisão do dono
    expect(u1.text).not.toContain("P.S. I limit how many people I support directly");
  });

  it("trechos opcionais respeitam as configurações", () => {
    const u4 = renderEmail("upsell_4", ctxFor("John"), footer);
    expect(u4.text).not.toContain("Here’s what two students");
    const a2 = renderEmail("rec_a2", ctxFor("John", "recovery_a"), footer);
    expect(a2.text).not.toContain("Evelyn");
    expect(a2.text).toContain("write to us at help@example.com and we’ll help you.");
    const b1 = renderEmail("rec_b1", ctxFor("John", "recovery_b"), footer);
    expect(b1.text).toContain("2. Try a different card.\n");
    expect(b1.text).toContain("If it still doesn’t work, reply to this email. We’ll help you finish.");
    const f3b = renderEmail("rec_f3", ctxFor("John", "recovery_b"), footer);
    expect(f3b.text).toContain("If your card gave you trouble before");

    const on = parseSettings({
      supportEmail: "help@example.com",
      supportWhatsappUrl: "https://wa.me/1",
      recA2TestimonialAuthorized: true,
      upsell4Testimonial1Name: "Ana",
      upsell4Testimonial1Authorized: true,
      upsell4Testimonial2Name: "Bob",
      upsell4Testimonial2Authorized: true,
      recB1OtherPaymentEnabled: true,
      upsell6CreditEnabled: true,
      upsell6CreditInstructions: "reply to this email.",
    });
    const c2 = (t: "upsell" | "recovery_a" | "recovery_b") => buildContext(on, { firstName: "John", timezone: null }, { type: t, recoveryUrl: null }, new Date()).ctx;
    expect(renderEmail("upsell_4", c2("upsell"), footer).text).toContain("— Bob");
    expect(renderEmail("rec_a2", c2("recovery_a"), footer).text).toContain("— Evelyn");
    expect(renderEmail("rec_b1", c2("recovery_b"), footer).text).toContain("Try a different card. Or another payment method.");
    expect(renderEmail("rec_b1", c2("recovery_b"), footer).html).toContain('href="https://wa.me/1"');
    expect(renderEmail("upsell_6", c2("upsell"), footer).text).toContain("Here’s how to use it: reply to this email.");
  });

  it("textos batem com o anexo (amostras)", () => {
    const src = readFileSync("docs/fontes/Upsells (quem comprou).md", "utf8");
    const u3 = renderEmail("upsell_3", ctxFor("John"), footer).text;
    for (const line of ["The quieter it gets outside, the louder it gets inside.", "Am I loving with my child? Not enough."]) {
      expect(src).toContain(line);
      expect(u3).toContain(line);
    }
  });
});

describe("descadastro e webhook do Resend", () => {
  it("token assinado", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(t)).toBe(42);
    expect(verifyUnsubscribeToken(t.replace("42.", "43."))).toBeNull();
  });

  it("bounce permanente suprime; evento repetido não duplica; clique grava URL", async () => {
    const { db, close } = await createTestDb();
    await receiveAndProcess(db, { provider: "simulator", raw: simEvent({ type: "checkout_abandoned", at: T0 }) }, { now: T0 });
    await runDispatch(db, { now: new Date(T0.getTime() + 31 * 60_000), getSender: fakeSender().getSender });
    const [a1] = await emails(db);
    const tags = { scheduled_email_id: a1.id, template: "rec_a1" };
    await recordResendEvent(db, "msg_1", { type: "email.clicked", data: { email_id: "re_x", tags, click: { link: "https://go.centerpag.com/PPU38CQFMQH", timestamp: T0.toISOString() } } });
    const dup = await recordResendEvent(db, "msg_1", { type: "email.clicked", data: { email_id: "re_x", tags } });
    expect(dup.status).toBe("duplicate");
    await recordResendEvent(db, "msg_2", { type: "email.bounced", data: { email_id: "re_x", tags, bounce: { type: "Permanent", subType: "General", message: "x" } } });
    const ev = await db.select().from(emailEvents);
    expect(ev.map((e) => e.type).sort()).toEqual(["bounced", "clicked"]);
    expect(ev.find((e) => e.type === "clicked")?.url).toContain("PPU38CQFMQH");
    const [c] = await db.select().from(customers);
    expect(c.suppressed).toBe(true);
    expect(c.suppressedReason).toBe("bounce permanente");
    expect((await emails(db)).filter((e) => e.status === "scheduled")).toHaveLength(0);
    await close();
  });
});

describe("links no domínio próprio", () => {
  it("com APP_BASE_URL próprio, os botões passam por /r/<chave>; com vercel.app, ficam diretos", async () => {
    const s = parseSettings({ supportEmail: "help@example.com" });
    const mk = () => buildContext(s, { firstName: "John", timezone: null }, { type: "upsell", recoveryUrl: null }, new Date()).ctx;
    const footer = { unsubscribeUrl: "https://x/u/1", postalAddress: "x" };
    process.env.APP_BASE_URL = "https://emailmarketingbeto.vercel.app";
    expect(renderEmail("upsell_1", mk(), footer).html).toContain('href="https://go.centerpag.com/PPU38CQFMSE"');
    process.env.APP_BASE_URL = "https://funil.theabundancesequence.com";
    const r = renderEmail("upsell_1", mk(), footer);
    expect(r.html).toContain('href="https://funil.theabundancesequence.com/r/nathan67"');
    expect(r.html).not.toContain("go.centerpag.com");
    delete process.env.APP_BASE_URL;
  });

  it("a rota /r redireciona para o checkout certo", async () => {
    const { GET } = await import("@/app/r/[key]/route");
    const res = await GET(new Request("https://x/r/knots19"), { params: Promise.resolve({ key: "knots19" }) } as never);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://go.centerpag.com/PPU38CQFMS2");
    const bad = await GET(new Request("https://x/r/nada"), { params: Promise.resolve({ key: "nada" }) } as never);
    expect(bad.status).toBe(404);
  });
});
