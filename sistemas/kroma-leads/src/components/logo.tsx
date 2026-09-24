import { cn } from "./ui";

export function Logo({ size = "md", compact }: { size?: "md" | "lg"; compact?: boolean }) {
  const icon = size === "lg" ? "size-14" : "size-10";
  return (
    <div className={cn("flex items-center gap-3", size === "lg" && "flex-col gap-2")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icon.svg" alt="" className={icon} />
      {!compact && (
        <div className={cn("leading-none", size === "lg" && "text-center")}>
          <div className={cn("font-display font-bold tracking-[0.12em] text-strong", size === "lg" ? "text-xl" : "text-[15px]")}>KROMA</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.28em] text-muted">Leads</div>
        </div>
      )}
    </div>
  );
}
