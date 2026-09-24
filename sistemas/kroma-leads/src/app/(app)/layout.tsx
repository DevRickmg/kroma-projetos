import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { syncAppConfig } from "@/lib/settings";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  // primeiro acesso: cria configurações e segmentos padrão
  await sb.rpc("ensure_user_setup");
  // registra a URL do app pro pg_cron (sem precisar editar SQL)
  try {
    await syncAppConfig((await headers()).get("host"));
  } catch (e) {
    console.error("syncAppConfig", e);
  }
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar email={data.user.email ?? ""} />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}
