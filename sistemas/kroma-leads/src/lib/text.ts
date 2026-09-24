/** minúsculo, sem acento, espaços colapsados */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const DEFAULT_OPTOUT_KEYWORDS = [
  "sair", "parar", "pare", "para de", "remover", "remova", "me remove", "me tira",
  "nao quero", "nao tenho interesse", "sem interesse", "nao me chame",
  "nao me mande", "nao mande mais", "nao chame mais", "cancelar", "descadastrar",
  "stop", "bloquear", "spam",
];

/**
 * Detecta pedido de saída. Cada palavra-chave precisa aparecer como palavra
 * inteira (sem diferenciar acento/maiúscula). "pare" casa com "pare de me
 * mandar", mas não com "parece".
 */
export function isOptOut(message: string, keywords: string[] = DEFAULT_OPTOUT_KEYWORDS): boolean {
  const text = ` ${normalizeText(message)} `;
  if (!text.trim()) return false;
  return keywords.some((k) => {
    const kw = normalizeText(k);
    return kw.length > 0 && text.includes(` ${kw} `);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function instagramFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (!m) return null;
  const handle = m[1].replace(/\/$/, "");
  if (["p", "reel", "stories", "explore", "accounts"].includes(handle.toLowerCase())) return url;
  return `https://instagram.com/${handle}`;
}

export function isInstagramUrl(url: string | null | undefined): boolean {
  return !!url && /(^|\.)instagram\.com/i.test(url.replace(/^https?:\/\//, "").split("/")[0]);
}

/** aceita "@perfil", "perfil" ou URL e devolve a URL completa */
export function normalizeInstagram(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  if (/instagram\.com/i.test(t)) return instagramFromUrl(t.startsWith("http") ? t : `https://${t}`) ?? t;
  return `https://instagram.com/${t.replace(/^@/, "")}`;
}

export function normalizeWebsite(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
