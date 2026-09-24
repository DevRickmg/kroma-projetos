"use client";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X, HelpCircle } from "lucide-react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "cta" | "primary" | "secondary" | "ghost" | "danger" | "light";
const BTN: Record<BtnVariant, string> = {
  // magenta: só conversão/ação principal da tela
  cta: "bg-magenta text-white hover:brightness-110 shadow-[0_0_24px_-8px_#ff007f]",
  primary: "border border-cyan/40 text-strong hover:bg-cyan/10",
  secondary: "border border-line2 bg-card2 text-ink hover:bg-hover",
  ghost: "text-muted hover:text-ink hover:bg-hover",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  light: "bg-[#e9ecf1] text-[#0d0f12] hover:bg-white",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode;
}>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  const sz = size === "sm" ? "h-8 px-3 text-xs gap-1.5" : size === "lg" ? "h-12 px-6 text-sm gap-2" : "h-9 px-3.5 text-sm gap-2";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition whitespace-nowrap",
        "disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none",
        BTN[variant], sz, className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, children, title, icon, actions, id }: {
  className?: string; children: ReactNode; title?: ReactNode; icon?: ReactNode; actions?: ReactNode; id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-line bg-card p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-strong">
            {icon && <span className="text-cyan">{icon}</span>}
            {title}
          </h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted", className)}>{children}</div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 rounded-lg border border-line bg-card2 px-3 text-sm text-ink placeholder:text-faint",
        "focus:border-cyan/50 focus:outline-none", /(^|\s)w-/.test(className ?? "") ? "" : "w-full", className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-sm text-ink placeholder:text-faint",
        "focus:border-cyan/50 focus:outline-none", className,
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("h-10 rounded-lg border border-line bg-card2 px-3 text-sm text-ink focus:border-cyan/50 focus:outline-none", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

type Tone = "neutral" | "cyan" | "violet" | "danger" | "strong" | "magenta";
const TONE: Record<Tone, string> = {
  neutral: "bg-white/5 text-muted border-line",
  cyan: "bg-cyan/10 text-cyan border-cyan/25",
  violet: "bg-violet/15 text-[#a996ff] border-violet/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  strong: "bg-white/10 text-strong border-line2",
  magenta: "bg-magenta/10 text-magenta border-magenta/30",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Chip({ active, onClick, children, className, title }: {
  active?: boolean; onClick?: () => void; children: ReactNode; className?: string; title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
        active ? "border-cyan/60 bg-cyan/10 text-strong" : "border-line2 text-ink hover:border-faint hover:bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tip({ children, content, side = "bottom", width = "w-72" }: {
  children?: ReactNode; content: ReactNode; side?: "bottom" | "top"; width?: string;
}) {
  return (
    <span className="tip inline-flex" tabIndex={0}>
      {children ?? <HelpCircle className="size-3.5 text-faint hover:text-muted" />}
      <span
        className={cn(
          "tip-body absolute left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line2 bg-[#12151a] p-3 text-left text-xs font-normal normal-case tracking-normal text-ink shadow-xl",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2", width,
        )}
      >
        {content}
      </span>
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-cyan", className)} />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <div className="text-sm text-ink">{title}</div>
      {children && <div className="max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={cn("max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-line bg-card sm:rounded-2xl flex flex-col", wide ? "sm:max-w-4xl" : "sm:max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-sm font-semibold text-strong">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Fechar"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={cn("fixed inset-0 z-[900] transition", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-black/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-line bg-card shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="min-w-0 text-sm font-semibold text-strong">{title}</div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Fechar"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{open && children}</div>
      </aside>
    </div>
  );
}

export function PageHeader({ title, children, subtitle }: { title: string; children?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-strong sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Progress({ value, max, className, tone = "cyan" }: { value: number; max: number; className?: string; tone?: "cyan" | "violet" | "danger" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar = tone === "danger" ? "bg-danger" : tone === "violet" ? "bg-violet" : "bg-cyan";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-cyan/80" : "bg-line2")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

export function Callout({ tone = "neutral", icon, title, children, className }: {
  tone?: "neutral" | "cyan" | "violet" | "danger"; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string;
}) {
  const t = {
    neutral: "border-line bg-card2/60",
    cyan: "border-cyan/25 bg-cyan/[0.04]",
    violet: "border-violet/30 bg-violet/[0.06]",
    danger: "border-danger/30 bg-danger/[0.06]",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-4 text-sm", t, className)}>
      {title && <div className="mb-1.5 flex items-center gap-2 font-semibold text-strong">{icon}{title}</div>}
      <div className="text-muted [&_b]:text-ink [&_strong]:text-ink">{children}</div>
    </div>
  );
}
