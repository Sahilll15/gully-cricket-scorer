import { useEffect, type ReactNode } from "react";
import type { Ball } from "./engine/types";
import { ballLabel } from "./engine/engine";
import { useStore, type Screen } from "./store";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Header({ title, back, right, children }: { title: string; back?: () => void; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="header-glow rounded-b-[32px] border-b border-line px-4 pt-[max(14px,env(safe-area-inset-top))] pb-5">
      <div className="flex items-center gap-3 h-12">
        {back ? (
          <button onClick={back} aria-label="Back" className="press grid place-items-center w-11 h-11 rounded-2xl bg-key text-fg text-xl font-bold">←</button>
        ) : <span className="w-11" />}
        <h1 className="flex-1 text-center text-lg font-bold text-fg">{title}</h1>
        <div className="min-w-11 flex justify-end">{right}</div>
      </div>
      {children}
    </header>
  );
}

export const LivePill = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-[11px] font-bold text-out">
    <i className="live-dot w-2 h-2 rounded-full bg-out" /> LIVE
  </span>
);

export function Badge({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="grid place-items-center rounded-full font-extrabold shrink-0 ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.36, background: "#1c1c24", color: "#ff8a3d" }}>{initials}</span>
  );
}

export function BallChip({ b, onClick, size = 36 }: { b: Ball; onClick?: () => void; size?: number }) {
  const tone = b.wicket ? "bg-out text-white" : b.extra === "wd" || b.extra === "nb" ? "bg-panel border-2 border-sun text-fg"
    : b.extra ? "bg-sun-soft text-fg" : b.runs === 6 ? "bg-six text-ink" : b.runs === 4 ? "bg-four text-ink" : "bg-raised text-fg ring-1 ring-white/15";
  return (
    <button onClick={onClick} disabled={!onClick}
      className={cx("press rounded-full px-2 font-bold grid place-items-center shrink-0 disabled:cursor-default", tone)}
      style={{ minWidth: size, height: size, fontSize: size * 0.36 }}>{ballLabel(b)}</button>
  );
}

export function Sheet({ title, onClose, children, footer }: { title: string; onClose?: () => void; children: ReactNode; footer?: ReactNode }) {
  // Without this the page behind scrolls and jumps while you drag inside the sheet.
  useEffect(() => { const b = document.body.style; const prev = b.overflow; b.overflow = "hidden"; return () => { b.overflow = prev; }; }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="sheet-in w-full max-w-[480px] max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line bg-panel px-5 pt-3 safe-bottom">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">{title}</h2>
          {onClose && <button onClick={onClose} className="press w-10 h-10 rounded-full bg-panel text-mute font-bold" aria-label="Close">✕</button>}
        </div>
        {children}
        {footer && <div className="sticky -bottom-4 -mx-5 mt-5 border-t border-line bg-panel px-5 pb-4 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Pill({ active, children, onClick, disabled }: { active?: boolean; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx("press min-h-12 rounded-full border-2 px-4 font-semibold text-[15px] disabled:opacity-35",
        active ? "border-sun bg-sun text-ink" : "border-sun/70 bg-panel text-fg")}>{children}</button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-line bg-panel p-4", className)}>{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled, tone = "sun" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "sun" | "navy" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx("press w-full min-h-14 rounded-2xl text-[17px] font-bold disabled:opacity-40",
        tone === "sun" ? "bg-sun text-ink shadow-[0_8px_20px_-10px_rgba(255,138,61,.9)]" : "bg-raised text-white")}>{children}</button>
  );
}

export function Stepper({ value, set, min = 1, max = 50 }: { value: number; set: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-key p-1.5">
      <button className="press w-12 h-12 rounded-xl bg-panel text-2xl font-bold text-fg" onClick={() => set(Math.max(min, value - 1))}>−</button>
      <span className="text-2xl font-extrabold text-fg tabular-nums">{value}</span>
      <button className="press w-12 h-12 rounded-xl bg-panel text-2xl font-bold text-fg" onClick={() => set(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button onClick={() => set(!on)} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="flex-1">
        <span className="block font-semibold text-fg">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
      <span className={cx("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-sun" : "bg-line")}>
        <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-panel shadow transition-all", on ? "left-7" : "left-1")} />
      </span>
    </button>
  );
}

const NAV: { s: Screen; label: string; icon: string }[] = [
  { s: "home", label: "Home", icon: "⌂" },
  { s: "cups", label: "Cups", icon: "🏆" },
  { s: "teams", label: "Teams", icon: "👥" },
  { s: "stats", label: "Stats", icon: "★" },
  { s: "history", label: "History", icon: "☰" },
];

export function BottomNav() {
  const { screen, go } = useStore();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 px-4 safe-bottom pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-around rounded-full border border-line bg-panel px-2 py-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,.35)]">
        {NAV.map(({ s, label, icon }) => (
          <button key={s} onClick={() => go(s)}
            className={cx("press flex min-h-12 flex-1 flex-col items-center justify-center rounded-full text-[11px] font-semibold",
              screen === s ? "bg-sun text-ink" : "text-teal")}>
            <span className="text-base leading-none">{icon}</span>{label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Segmented<T extends string | number>({ items, value, set }: { items: { v: T; label: ReactNode }[]; value: T; set: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-panel p-1 shadow-[0_6px_24px_-14px_rgba(0,0,0,.35)]">
      {items.map((it) => (
        <button key={String(it.v)} onClick={() => set(it.v)}
          className={cx("press min-h-11 flex-1 rounded-full px-3 text-sm font-semibold",
            value === it.v ? "bg-sun text-ink" : "text-mute")}>{it.label}</button>
      ))}
    </div>
  );
}

/** In-app yes/no. The browser's confirm() is silently blocked in Instagram's and other in-app browsers. */
export function ConfirmSheet({ title, body, yes, danger, onYes, onClose }: {
  title: string; body?: ReactNode; yes: string; danger?: boolean; onYes: () => void; onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {body && <p className="text-[15px] text-fg/85">{body}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={onClose} className="press min-h-14 rounded-2xl border-2 border-line font-semibold text-fg">Cancel</button>
        <button onClick={() => { onYes(); onClose(); }}
          className={cx("press min-h-14 rounded-2xl font-bold", danger ? "bg-out text-white" : "bg-sun text-ink")}>{yes}</button>
      </div>
    </Sheet>
  );
}
