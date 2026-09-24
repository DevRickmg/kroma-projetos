import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completeFinishedCampaigns, refreshStaleNumbers, sendDue } from "@/lib/sender/engine";
import { processJob } from "@/lib/google/search-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamado pelo pg_cron do Supabase a cada minuto (ver supabase/setup.sql).
 * 1) envia as mensagens que venceram  2) fecha campanhas terminadas
 * 3) atualiza status de números parados  4) continua buscas do Google
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const report: Record<string, unknown> = {};
  try {
    report.sent = await sendDue(30_000);
  } catch (e) {
    report.sendError = (e as Error).message;
  }
  try {
    await completeFinishedCampaigns();
    await refreshStaleNumbers();
  } catch (e) {
    report.maintenanceError = (e as Error).message;
  }
  const left = 50_000 - (Date.now() - started);
  if (left > 10_000) {
    const now = new Date().toISOString();
    const { data: jobs } = await supabaseAdmin().from("search_jobs").select("id")
      .in("status", ["queued", "running"]).or(`locked_until.is.null,locked_until.lt.${now}`)
      .order("created_at").limit(1);
    if (jobs?.length) {
      try {
        report.search = await processJob(jobs[0].id, left - 8_000);
      } catch (e) {
        report.searchError = (e as Error).message;
      }
    }
  }
  return NextResponse.json({ ok: true, ms: Date.now() - started, ...report });
}
