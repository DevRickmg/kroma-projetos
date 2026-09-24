"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Crosshair, Users, Send, MessagesSquare, Smartphone, Settings, LogOut, Menu, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "./logo";
import { cn } from "./ui";

export const APP_VERSION = "1.0.0";

const NAV = [
  { href: "/buscar", label: "Buscar Leads", icon: Crosshair },
  { href: "/leads", label: "Leads", icon: Users, key: "leads" },
  { href: "/campanhas", label: "Campanhas", icon: Send },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare, key: "unread" },
  { href: "/whatsapp", label: "WhatsApp", icon: Smartphone, key: "paused" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function Sidebar({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ leads: number; unread: number; paused: number }>({ leads: 0, unread: 0, paused: 0 });

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    const load = async () => {
      const [leads, unread, paused] = await Promise.all([
        sb.from("leads").select("id", { count: "exact", head: true }).eq("archived", false),
        sb.from("leads").select("id", { count: "exact", head: true }).gt("unread_count", 0),
        sb.from("whatsapp_numbers").select("id", { count: "exact", head: true }).eq("paused", true),
      ]);
      if (alive) setCounts({ leads: leads.count ?? 0, unread: unread.count ?? 0, paused: paused.count ?? 0 });
    };
    load();
    const ch = sb.channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_numbers" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
  }, [path]);

  useEffect(() => setOpen(false), [path]);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = path === item.href || path.startsWith(item.href + "/");
        const Icon = item.icon;
        const key = "key" in item ? item.key : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active ? "bg-cyan/[0.08] text-strong" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon className={cn("size-4", active ? "text-cyan" : "text-faint group-hover:text-muted")} />
            <span className="flex-1">{item.label}</span>
            {key === "leads" && counts.leads > 0 && (
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-ink">{counts.leads.toLocaleString("pt-BR")}</span>
            )}
            {key === "unread" && counts.unread > 0 && (
              <span className="rounded-md bg-cyan/15 px-1.5 py-0.5 text-[11px] font-semibold text-cyan">{counts.unread}</span>
            )}
            {key === "paused" && counts.paused > 0 && (
              <span title="Número pausado" className="size-2 rounded-full bg-violet pulse-dot" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* celular */}
      <div className="sticky top-0 z-[800] flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(!open)} className="text-ink" aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-[61px] z-[800] border-b border-line bg-bg p-3 lg:hidden">
          {nav}
          <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-hover">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      )}

      {/* desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-[#0b0d10] lg:flex">
        <div className="border-b border-line px-5 py-6"><Logo /></div>
        <div className="flex-1 p-3">{nav}</div>
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] text-muted" title={email}>{email}</div>
              <div className="text-[10px] text-faint">v{APP_VERSION}</div>
            </div>
            <button onClick={logout} title="Sair" className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
