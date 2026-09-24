import { handler, ok, readJson, requireUser } from "@/lib/api";
import { eligibleLeads } from "@/lib/sender/engine";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { lead_ids } = await readJson<{ lead_ids?: string[] }>(req);
  const r = await eligibleLeads(user.id, (lead_ids ?? []).slice(0, 5000));
  return ok({ eligible: r.ok.length, total: r.total, reasons: r.reasons, sample: r.ok.slice(0, 5).map((l) => l.id) });
});
