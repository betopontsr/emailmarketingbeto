/**
 * Fuso a partir do país/estado. EUA: fuso principal de cada estado.
 * Outros países: só os que têm um fuso único (ou claramente dominante).
 * Sem correspondência, devolve null e o app usa o fuso padrão (America/New_York).
 */
const US_STATE_ZONES: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver", PR: "America/Puerto_Rico",
};

const COUNTRY_ZONES: Record<string, string> = {
  GB: "Europe/London", UK: "Europe/London", IE: "Europe/Dublin", PT: "Europe/Lisbon", ES: "Europe/Madrid",
  FR: "Europe/Paris", DE: "Europe/Berlin", IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels",
  CH: "Europe/Zurich", AT: "Europe/Vienna", SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki", PL: "Europe/Warsaw", GR: "Europe/Athens", ZA: "Africa/Johannesburg", NZ: "Pacific/Auckland",
  PH: "Asia/Manila", SG: "Asia/Singapore", IN: "Asia/Kolkata", JP: "Asia/Tokyo", IL: "Asia/Jerusalem",
  AE: "Asia/Dubai", CO: "America/Bogota", PE: "America/Lima", AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago", PR: "America/Puerto_Rico", JM: "America/Jamaica", TT: "America/Port_of_Spain",
  BR: "America/Sao_Paulo", MX: "America/Mexico_City",
};

export function zoneFromLocation(country: string | null | undefined, region: string | null | undefined): string | null {
  const c = (country ?? "").toUpperCase();
  if (["US", "USA", "UNITED STATES"].includes(c)) return US_STATE_ZONES[(region ?? "").toUpperCase()] ?? null;
  return COUNTRY_ZONES[c] ?? null;
}
