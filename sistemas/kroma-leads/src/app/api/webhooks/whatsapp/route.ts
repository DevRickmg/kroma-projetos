import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/credentials";
import { parseWebhook } from "@/lib/whatsapp/uazapi";
import { handleWebhookEvent } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";

/**
 * Webhook público da Uazapi. Validado pelo segredo na URL (WEBHOOK_SECRET)
 * e pelo token da instância que vem no corpo (precisa ser de um número
 * cadastrado). Registrado automaticamente ao conectar o número.
 */
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  const given = new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, result: "corpo inválido" });
  }
  try {
    const result = await handleWebhookEvent(parseWebhook(body));
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("webhook", e);
    // 200 mesmo assim: a Uazapi não reenvia, e erro aqui não deve derrubar a instância
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}

export function GET() {
  return NextResponse.json({ ok: true, service: "kroma-leads webhook" });
}
