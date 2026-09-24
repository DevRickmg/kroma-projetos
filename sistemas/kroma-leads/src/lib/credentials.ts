import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";

export type CredentialKind = "google_places" | "uazapi_token" | "ai";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function getCredential(userId: string, kind: CredentialKind, refId?: string | null) {
  let q = supabaseAdmin().from("api_credentials").select("secret,last4").eq("user_id", userId).eq("kind", kind);
  q = refId ? q.eq("ref_id", refId) : q.is("ref_id", null);
  const { data } = await q.maybeSingle();
  return data as { secret: string; last4: string } | null;
}

export async function setCredential(
  userId: string, kind: CredentialKind, secret: string, refId: string | null = null, lookup = false,
) {
  const admin = supabaseAdmin();
  const row = {
    user_id: userId, kind, ref_id: refId, secret,
    last4: secret.slice(-4), lookup_hash: lookup ? sha256(secret) : null, updated_at: new Date().toISOString(),
  };
  let del = admin.from("api_credentials").delete().eq("user_id", userId).eq("kind", kind);
  del = refId ? del.eq("ref_id", refId) : del.is("ref_id", null);
  await del;
  const { error } = await admin.from("api_credentials").insert(row);
  if (error) throw new Error("Não foi possível salvar a credencial: " + error.message);
}

export async function deleteCredential(userId: string, kind: CredentialKind, refId?: string | null) {
  let del = supabaseAdmin().from("api_credentials").delete().eq("user_id", userId).eq("kind", kind);
  del = refId ? del.eq("ref_id", refId) : del.is("ref_id", null);
  await del;
}

/** Acha o número (e o dono) pelo token da instância que a Uazapi manda no webhook */
export async function findNumberByToken(token: string) {
  const { data } = await supabaseAdmin()
    .from("api_credentials")
    .select("user_id,ref_id")
    .eq("kind", "uazapi_token")
    .eq("lookup_hash", sha256(token))
    .maybeSingle();
  return data as { user_id: string; ref_id: string } | null;
}
