import { handler, ok, requireUser } from "@/lib/api";
import { getCredential } from "@/lib/credentials";
import { aiEnabled } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const cred = await getCredential(user.id, "google_places");
  const period = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7) + "-01";
  const { data: usage } = await supabaseAdmin().from("google_usage").select("requests")
    .eq("user_id", user.id).eq("period", period).maybeSingle();
  return ok({
    googleConfigured: !!cred,
    googleLast4: cred?.last4 ?? null,
    googleUsage: usage?.requests ?? 0,
    aiEnabled: aiEnabled(),
    webhookConfigured: !!process.env.WEBHOOK_SECRET,
    cronConfigured: !!process.env.CRON_SECRET,
  });
});
