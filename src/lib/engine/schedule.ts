import { DateTime } from "luxon";
import type { EngineConfig } from "./types";

type Quiet = Pick<EngineConfig, "quietStartHour" | "quietEndHour" | "quietResumeHour">;

export function isQuietHour(d: Date, zone: string, cfg: Quiet): boolean {
  const h = DateTime.fromJSDate(d, { zone }).hour;
  const { quietStartHour: s, quietEndHour: e } = cfg;
  return s > e ? h >= s || h < e : h >= s && h < e;
}

/** Se cair na janela de silêncio (22h–7h), adia para as 8h do fuso do cliente. */
export function adjustForQuiet(d: Date, zone: string, cfg: Quiet): Date {
  if (!isQuietHour(d, zone, cfg)) return d;
  let dt = DateTime.fromJSDate(d, { zone });
  if (dt.hour >= cfg.quietStartHour && cfg.quietStartHour > cfg.quietEndHour) dt = dt.plus({ days: 1 });
  return dt.set({ hour: cfg.quietResumeHour, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

export function localDay(d: Date, zone: string): string {
  return DateTime.fromJSDate(d, { zone }).toISODate()!;
}

/** Próximo dia, no horário de retomada (8h). */
export function nextDayResume(d: Date, zone: string, cfg: Quiet): Date {
  return DateTime.fromJSDate(d, { zone })
    .plus({ days: 1 })
    .set({ hour: cfg.quietResumeHour, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}

/**
 * Coloca um e-mail de recuperação no primeiro horário válido:
 * fora da janela de silêncio e num dia (do cliente) sem outro e-mail de recuperação.
 */
export function placeRecovery(target: Date, zone: string, cfg: Quiet, takenDays: Set<string>): Date {
  let t = adjustForQuiet(target, zone, cfg);
  for (let i = 0; i < 30 && takenDays.has(localDay(t, zone)); i++) {
    t = adjustForQuiet(nextDayResume(t, zone, cfg), zone, cfg);
  }
  return t;
}

/** D+n às {hour}h no fuso do cliente; D+0 é o dia da compra nesse fuso. */
export function upsellTime(anchor: Date, day: number, hour: number, zone: string): Date {
  return DateTime.fromJSDate(anchor, { zone })
    .startOf("day")
    .plus({ days: day })
    .set({ hour, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}
