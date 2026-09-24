import "server-only";
import { ApiError } from "../api";
import { getCredential } from "../credentials";
import { supabaseServer } from "../supabase/server";
import { createProvider } from "./uazapi";
import { appBaseUrl } from "../settings";

/** Carrega o número garantindo (via RLS) que é do usuário logado + o provedor com o token */
export async function ownedNumber(userId: string, id: string) {
  const sb = await supabaseServer();
  const { data: num } = await sb.from("whatsapp_numbers").select("*").eq("id", id).maybeSingle();
  if (!num) throw new ApiError(404, "Número não encontrado.");
  const token = await getCredential(userId, "uazapi_token", id);
  if (!token) throw new ApiError(400, "O token dessa instância sumiu. Remova e cadastre o número de novo.");
  return { num, provider: createProvider(num.server_url, token.secret) };
}

export function webhookUrl(host: string | null): string {
  const base = appBaseUrl(host);
  const secret = process.env.WEBHOOK_SECRET;
  if (!base || !secret) throw new ApiError(500, "WEBHOOK_SECRET não configurado na Vercel.");
  if (base.startsWith("http://localhost")) throw new ApiError(400, "O webhook precisa de uma URL pública (rode pela Vercel).");
  return `${base}/api/webhooks/whatsapp?secret=${encodeURIComponent(secret)}`;
}
