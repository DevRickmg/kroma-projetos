import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { DEFAULT_AUTOPAUSE, DEFAULT_SEND, DEFAULT_WARMUP, type Settings } from "./types";

export async function loadSettings(userId: string): Promise<Settings> {
  const { data } = await supabaseAdmin().from("settings").select("*").eq("user_id", userId).maybeSingle();
  const s = (data ?? {}) as Partial<Settings>;
  return {
    user_id: userId,
    ddi: s.ddi ?? "55",
    my_name: s.my_name ?? "",
    my_company: s.my_company ?? "Kroma Projetos",
    google_monthly_limit: s.google_monthly_limit ?? 1000,
    send_config: { ...DEFAULT_SEND, ...(s.send_config ?? {}) },
    warmup_config: { ...DEFAULT_WARMUP, ...(s.warmup_config ?? {}) },
    autopause_config: { ...DEFAULT_AUTOPAUSE, ...(s.autopause_config ?? {}) },
    optout_keywords: s.optout_keywords ?? [],
  };
}

export function appBaseUrl(fallbackHost?: string | null): string | null {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (fallbackHost) return `${fallbackHost.startsWith("localhost") ? "http" : "https"}://${fallbackHost}`;
  return null;
}

/** Grava URL do app + segredo do cron no banco pro pg_cron conseguir chamar a Vercel */
export async function syncAppConfig(host?: string | null) {
  const url = appBaseUrl(host);
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || url.startsWith("http://localhost")) return;
  const admin = supabaseAdmin();
  const { data } = await admin.from("app_config").select("app_url,cron_secret").eq("id", 1).maybeSingle();
  if (data?.app_url === url && data?.cron_secret === secret) return;
  await admin.from("app_config").upsert({ id: 1, app_url: url, cron_secret: secret, updated_at: new Date().toISOString() });
}
