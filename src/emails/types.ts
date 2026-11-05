import type { TemplateKey } from "@/lib/engine/types";

/**
 * Texto inline aceita **negrito** e [rótulo](url). Todo o resto é escapado.
 */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "button"; text: string; href: string };

export type EmailContent = { subject: string; preview: string; blocks: Block[] };

export type EmailContext = {
  firstName: string | null;
  flowType: "upsell" | "recovery_a" | "recovery_b";
  /** "Friday, Nov 20 at 10:00 AM EST" (envio + 48 h, no fuso do cliente) */
  deadline: string;
  /** Sigla do fuso do cliente, ex.: "EST" (upsell_5) */
  zoneAbbr: string;
  /** Link do checkout de $47 (recuperação da plataforma, se veio no webhook) */
  mainCheckoutUrl: string;
  /** Se preenchido, os botões de checkout passam por <linkBase>/r/<chave> (domínio próprio). */
  linkBase?: string | null;
  supportEmail: string;
  supportWhatsappUrl: string;
  opts: {
    upsell1ScarcityEnabled: boolean;
    upsell1ScarcityText: string;
    upsell4Testimonial1Name: string;
    upsell4Testimonial1Authorized: boolean;
    upsell4Testimonial2Name: string;
    upsell4Testimonial2Authorized: boolean;
    recA2TestimonialName: string;
    recA2TestimonialAuthorized: boolean;
    upsell6CreditEnabled: boolean;
    upsell6CreditInstructions: string;
    recB1OtherPaymentEnabled: boolean;
    recB1OtherPaymentText: string;
  };
};

export type Template = (ctx: EmailContext) => EmailContent;
export type TemplateMap = Record<TemplateKey, Template>;
