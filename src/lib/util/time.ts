import { DateTime, IANAZone } from "luxon";

export const FALLBACK_ZONE = "America/New_York";

export function isValidZone(zone: string | null | undefined): zone is string {
  return !!zone && IANAZone.isValidZone(zone);
}

export function resolveZone(zone: string | null | undefined, fallback = FALLBACK_ZONE): string {
  if (isValidZone(zone)) return zone;
  return isValidZone(fallback) ? fallback : FALLBACK_ZONE;
}

export function inZone(d: Date, zone: string): DateTime {
  return DateTime.fromJSDate(d, { zone });
}

/** Ex.: "Friday, Nov 20 at 10:00 AM EST" */
export function formatDeadline(d: Date, zone: string): string {
  const dt = inZone(d, zone).setLocale("en-US");
  return `${dt.toFormat("cccc, LLL d")} at ${dt.toFormat("h:mm a")} ${dt.toFormat("ZZZZ")}`;
}

/** Sigla do fuso, ex.: "EST", "PDT". */
export function zoneAbbreviation(d: Date, zone: string): string {
  return inZone(d, zone).setLocale("en-US").toFormat("ZZZZ");
}

/** Para o painel: "04/11/2026 15:30" no fuso indicado. */
export function formatBr(d: Date | null | undefined, zone = "America/Sao_Paulo"): string {
  if (!d) return "—";
  return inZone(d, zone).setLocale("pt-BR").toFormat("dd/MM/yyyy HH:mm");
}
