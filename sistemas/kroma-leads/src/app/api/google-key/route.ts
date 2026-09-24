import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { deleteCredential, setCredential } from "@/lib/credentials";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { key } = await readJson<{ key?: string }>(req);
  const clean = (key ?? "").trim();
  if (clean.length < 20 || /\s/.test(clean)) throw new ApiError(400, "Essa chave não parece uma API Key do Google. Copie de novo, sem espaços.");
  await setCredential(user.id, "google_places", clean);
  return ok({ last4: clean.slice(-4) });
});

export const DELETE = handler(async () => {
  const user = await requireUser();
  await deleteCredential(user.id, "google_places");
  return ok();
});
