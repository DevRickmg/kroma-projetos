import "server-only";
/**
 * Google Places API (New) — Text Search. Chamado só pelo servidor.
 * POST https://places.googleapis.com/v1/places:searchText
 * Headers: X-Goog-Api-Key, X-Goog-FieldMask (só os campos necessários).
 * Até 20 por página, até 60 por busca (3 páginas via nextPageToken).
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.types",
  "places.location",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
}

export interface Rect {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
}

export class GoogleError extends Error {
  constructor(message: string, public code: "not_enabled" | "invalid_key" | "billing" | "restricted" | "quota" | "other") {
    super(message);
  }
}

function translate(status: number, body: { error?: { message?: string; status?: string; details?: { reason?: string }[] } }): GoogleError {
  const msg = body.error?.message ?? "";
  const reasons = (body.error?.details ?? []).map((d) => d.reason ?? "").join(" ");
  const all = `${msg} ${reasons} ${body.error?.status ?? ""}`;
  if (/SERVICE_DISABLED|has not been used|is disabled|not been enabled|ACCESS_NOT_CONFIGURED/i.test(all)) {
    return new GoogleError("A Places API (New) não está ativada nesse projeto do Google Cloud. Ative a \"Places API (New)\" (não a antiga) e espere 1–2 minutos.", "not_enabled");
  }
  if (/API_KEY_INVALID|API key not valid|API_KEY_EXPIRED/i.test(all)) {
    return new GoogleError("Chave inválida. Confira se copiou a API Key inteira, sem espaços.", "invalid_key");
  }
  if (/BILLING|billing/i.test(all)) {
    return new GoogleError("O faturamento não está ativo nesse projeto do Google Cloud. A cota gratuita só funciona com uma conta de faturamento vinculada.", "billing");
  }
  if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|are blocked|referer|referrer/i.test(all)) {
    return new GoogleError("A chave tem restrição que bloqueia essa API. Em Credenciais → sua chave → Restrições de API, deixe \"Não restringir chave\" ou inclua \"Places API (New)\". Em restrição de aplicativo, use \"Nenhuma\" (o pedido sai do servidor).", "restricted");
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(all)) {
    return new GoogleError("Cota do Google esgotada (limite diário/mensal configurado no Google Cloud). A busca parou pra não gerar cobrança.", "quota");
  }
  return new GoogleError(`Erro do Google (${status}): ${msg || "sem detalhes"}`, "other");
}

export async function textSearch(opts: {
  apiKey: string;
  query: string;
  rect?: Rect;
  circle?: { lat: number; lng: number; radius: number };
  pageToken?: string;
  pageSize?: number;
}): Promise<{ places: Place[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery: opts.query,
    languageCode: "pt-BR",
    regionCode: "BR",
    pageSize: opts.pageSize ?? 20,
  };
  if (opts.pageToken) body.pageToken = opts.pageToken;
  if (opts.rect) body.locationRestriction = { rectangle: opts.rect };
  else if (opts.circle) {
    body.locationBias = {
      circle: { center: { latitude: opts.circle.lat, longitude: opts.circle.lng }, radius: Math.min(50000, opts.circle.radius) },
    };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": opts.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new GoogleError("Não consegui falar com o Google agora. Tente de novo em instantes.", "other");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw translate(res.status, json);
  return { places: json.places ?? [], nextPageToken: json.nextPageToken };
}

// ------------------------------------------------------------------
// Geometria: círculo → retângulo e grade de sub-regiões
// ------------------------------------------------------------------
const EARTH = 6371000;

export function circleToRect(lat: number, lng: number, radiusM: number): Rect {
  const dLat = (radiusM / EARTH) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return {
    low: { latitude: lat - dLat, longitude: lng - dLng },
    high: { latitude: lat + dLat, longitude: lng + dLng },
  };
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.sqrt(h));
}

/** Divide o retângulo do círculo em g×g células, do centro pra fora, pulando as que ficam fora do círculo */
export function gridCells(lat: number, lng: number, radiusM: number, g: number): Rect[] {
  const r = circleToRect(lat, lng, radiusM);
  const stepLat = (r.high.latitude - r.low.latitude) / g;
  const stepLng = (r.high.longitude - r.low.longitude) / g;
  const cells: { rect: Rect; d: number }[] = [];
  for (let i = 0; i < g; i++) {
    for (let j = 0; j < g; j++) {
      const low = { latitude: r.low.latitude + i * stepLat, longitude: r.low.longitude + j * stepLng };
      const high = { latitude: low.latitude + stepLat, longitude: low.longitude + stepLng };
      const cLat = (low.latitude + high.latitude) / 2;
      const cLng = (low.longitude + high.longitude) / 2;
      const d = distanceM(lat, lng, cLat, cLng);
      const halfDiag = distanceM(low.latitude, low.longitude, high.latitude, high.longitude) / 2;
      if (d - halfDiag <= radiusM) cells.push({ rect: { low, high }, d });
    }
  }
  return cells.sort((a, b) => a.d - b.d).map((c) => c.rect);
}

export function placeCityState(p: Place): { city: string | null; state: string | null } {
  const comps = p.addressComponents ?? [];
  const find = (t: string) => comps.find((c) => c.types.includes(t));
  const city = find("administrative_area_level_2")?.longText ?? find("locality")?.longText ?? null;
  const state = find("administrative_area_level_1")?.shortText ?? null;
  return { city, state };
}
