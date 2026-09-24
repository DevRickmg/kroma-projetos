import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";

export type PhoneType = "mobile" | "fixed" | "unknown";

export interface NormalizedPhone {
  e164: string; // +5511999998888
  digits: string; // 5511999998888 (formato usado pela Uazapi / wa.me)
  type: PhoneType;
  national: string; // (11) 99999-8888
}

const PREFERRED: Record<string, CountryCode> = { "1": "US", "7": "RU", "44": "GB", "55": "BR", "351": "PT" };

export function countryFromDdi(ddi: string): CountryCode | undefined {
  const clean = ddi.replace(/\D/g, "");
  if (PREFERRED[clean]) return PREFERRED[clean];
  return getCountries().find((c) => getCountryCallingCode(c) === clean);
}

export function countryNameFromDdi(ddi: string): string {
  const cc = countryFromDdi(ddi);
  if (!cc) return "Código desconhecido";
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function typeOf(t: string | undefined): PhoneType {
  if (t === "MOBILE") return "mobile";
  if (t === "FIXED_LINE") return "fixed";
  if (t === "FIXED_LINE_OR_MOBILE") return "mobile";
  return "unknown";
}

/**
 * Normaliza um telefone para E.164 usando o DDI das configurações.
 * Números que já chegam com código do país (+55…, 0055…, 55 + DDD + número)
 * são mantidos como estão.
 */
export function normalizePhone(raw: string | null | undefined, ddi = "55"): NormalizedPhone | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleanDdi = ddi.replace(/\D/g, "") || "55";
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const candidates: string[] = [];
  if (trimmed.startsWith("+")) candidates.push("+" + digits);
  else if (digits.startsWith("00")) candidates.push("+" + digits.slice(2));
  else {
    if (digits.startsWith(cleanDdi)) candidates.push("+" + digits);
    digits = digits.replace(/^0+/, ""); // tira o 0 de operadora/DDD (011…)
  }

  for (const c of candidates) {
    const p = parsePhoneNumberFromString(c);
    if (p && p.isValid()) return build(p);
  }

  const country = countryFromDdi(cleanDdi);
  const p = country
    ? parsePhoneNumberFromString(digits, country)
    : parsePhoneNumberFromString("+" + cleanDdi + digits);
  if (p && p.isValid()) return build(p);

  // Celular BR antigo sem o 9 (ex.: 11 8888-7777) → tenta com o 9
  if (cleanDdi === "55" && digits.length === 10 && /^[1-9]{2}[6-9]/.test(digits)) {
    const p9 = parsePhoneNumberFromString(digits.slice(0, 2) + "9" + digits.slice(2), "BR");
    if (p9 && p9.isValid()) return build(p9);
  }
  return null;
}

function build(p: NonNullable<ReturnType<typeof parsePhoneNumberFromString>>): NormalizedPhone {
  return {
    e164: p.number,
    digits: p.number.replace(/\D/g, ""),
    type: typeOf(p.getType()),
    national: p.formatNational(),
  };
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const p = parsePhoneNumberFromString(e164);
  return p ? p.formatNational() : e164;
}

/** JID/número vindo da Uazapi ("5511999998888@s.whatsapp.net") → E.164 */
export function jidToE164(jid: string | null | undefined): string | null {
  if (!jid) return null;
  if (jid.includes("@g.us") || jid.includes("@newsletter") || jid.includes("@lid")) return null;
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (digits.length < 8) return null;
  const p = parsePhoneNumberFromString("+" + digits);
  return p ? p.number : "+" + digits;
}

/**
 * Variantes do mesmo número para casar lead ↔ WhatsApp. No Brasil o JID do
 * WhatsApp às vezes vem sem o 9 do celular (contas antigas).
 */
export function phoneVariants(e164: string): string[] {
  const out = new Set([e164]);
  const m = e164.match(/^\+55(\d{2})(\d+)$/);
  if (m) {
    const [, ddd, rest] = m;
    if (rest.length === 9 && rest.startsWith("9")) out.add(`+55${ddd}${rest.slice(1)}`);
    if (rest.length === 8 && /^[6-9]/.test(rest)) out.add(`+55${ddd}9${rest}`);
  }
  return [...out];
}

export function waLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
