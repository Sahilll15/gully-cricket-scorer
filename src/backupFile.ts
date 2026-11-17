import { emptyKitty, mergeBackup, type KittyBackup } from "./kitty";

/** A backup saved as a file, so data survives a lost phone without an account. */
export interface BackupFile extends KittyBackup { app: "gully-scorer"; savedAt: number }

export function backupFileName(now = Date.now()): string {
  const d = new Date(now), p = (n: number) => String(n).padStart(2, "0");
  return `gully-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function toBackupFile(b: KittyBackup, now = Date.now()): string {
  const file: BackupFile = { app: "gully-scorer", savedAt: now, v: 1, matches: b.matches, teams: b.teams, cups: b.cups, series: b.series ?? [], infos: b.infos ?? {}, kitty: b.kitty ?? emptyKitty() };
  return JSON.stringify(file);
}

const list = (x: unknown) => (Array.isArray(x) ? x : []);

/** The data in a backup file, or null if it isn't one. Missing parts read as empty. */
export function readBackupFile(text: string): KittyBackup | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.matches) || !Array.isArray(o.teams)) return null;
  const k = (o.kitty ?? {}) as Record<string, unknown>;
  return {
    v: 1, matches: o.matches, teams: o.teams, cups: list(o.cups), series: list(o.series),
    infos: o.infos && typeof o.infos === "object" ? (o.infos as KittyBackup["infos"]) : {},
    kitty: { expenses: list(k.expenses), settlements: list(k.settlements), debts: list(k.debts), stakes: list(k.stakes) },
  };
}

/** Joins the file into what this phone has, never dropping either side, and says what came in. */
export function restoreFrom(local: KittyBackup, file: KittyBackup): { data: KittyBackup; added: string } {
  const data = mergeBackup(local, file);
  const n = (a: unknown[] | undefined, b: unknown[] | undefined) => (a?.length ?? 0) - (b?.length ?? 0);
  const k = (x: KittyBackup) => (x.kitty ? x.kitty.expenses.length + x.kitty.settlements.length + x.kitty.debts.length + x.kitty.stakes.length : 0);
  const parts = ([
    [n(data.matches, local.matches), "match", "matches"], [n(data.teams, local.teams), "team", "teams"],
    [n(data.cups, local.cups), "cup", "cups"], [n(data.series, local.series), "series", "series"], [k(data) - k(local), "kitty entry", "kitty entries"],
  ] as const).filter(([c]) => c > 0).map(([c, one, many]) => `${c} ${c === 1 ? one : many}`);
  return { data, added: parts.length ? `Added ${parts.join(", ")}.` : "Nothing new in that file. Everything was already here." };
}
