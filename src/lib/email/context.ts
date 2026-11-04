import type { Customer, Flow } from "@/lib/db/schema";
import { LINKS } from "@/emails/links";
import type { EmailContext } from "@/emails/types";
import type { Settings } from "@/lib/settings";
import { properCase } from "@/lib/util/names";
import { formatDeadline, resolveZone, zoneAbbreviation } from "@/lib/util/time";

export const DEADLINE_HOURS = 48;

export function optsFrom(s: Settings): EmailContext["opts"] {
  return {
    upsell1ScarcityEnabled: s.upsell1ScarcityEnabled,
    upsell1ScarcityText: s.upsell1ScarcityText,
    upsell4Testimonial1Name: s.upsell4Testimonial1Name,
    upsell4Testimonial1Authorized: s.upsell4Testimonial1Authorized,
    upsell4Testimonial2Name: s.upsell4Testimonial2Name,
    upsell4Testimonial2Authorized: s.upsell4Testimonial2Authorized,
    recA2TestimonialName: s.recA2TestimonialName,
    recA2TestimonialAuthorized: s.recA2TestimonialAuthorized,
    upsell6CreditEnabled: s.upsell6CreditEnabled,
    upsell6CreditInstructions: s.upsell6CreditInstructions,
    recB1OtherPaymentEnabled: s.recB1OtherPaymentEnabled,
    recB1OtherPaymentText: s.recB1OtherPaymentText,
  };
}

/** Contexto do e-mail no momento do envio: prazos = agora + 48 h, no fuso do cliente. */
export function buildContext(s: Settings, customer: Pick<Customer, "firstName" | "timezone">, flow: Pick<Flow, "type" | "recoveryUrl">, now: Date) {
  const zone = resolveZone(customer.timezone, s.defaultTimezone);
  const deadlineAt = new Date(now.getTime() + DEADLINE_HOURS * 3600_000);
  const ctx: EmailContext = {
    firstName: properCase(customer.firstName),
    flowType: flow.type as EmailContext["flowType"],
    deadline: formatDeadline(deadlineAt, zone),
    zoneAbbr: zoneAbbreviation(now, zone),
    mainCheckoutUrl: flow.recoveryUrl || LINKS.main47,
    supportEmail: s.supportEmail,
    supportWhatsappUrl: s.supportWhatsappUrl,
    opts: optsFrom(s),
  };
  return { ctx, deadlineAt, zone };
}
