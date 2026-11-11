import type { Match } from "./engine/types";
import type { SavedTeam, Tournament } from "./engine/tournament";

export interface Backup { v: 1; matches: Match[]; teams: SavedTeam[]; cups: Tournament[] }

/**
 * Login name for a mobile number. Indian numbers stay 10 digits, which existing accounts already use;
 * any other country becomes "+<code><number>". Null if it can't be a phone number.
 */
export function cleanPhone(raw: string, country = "91"): string | null {
  const typed = raw.trim(), d = typed.replace(/\D/g, ""), cc = country.replace(/\D/g, "") || "91";
  if (/^(\+|00)/.test(typed)) {
    const full = d.replace(/^00/, "");
    return full.startsWith("91") ? indian(full.slice(2)) : intl(full);
  }
  return cc === "91" ? indian(d) : intl(cc + d.replace(/^0+/, ""));
}
function indian(d: string) {
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
const intl = (d: string) => (/^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null);

export const validPasscode = (p: string) => /^\d{6}$/.test(p);

const progress = (m: Match) => m.innings.reduce((n, i) => n + i.events.length + (i.closed ? 1 : 0), m.innings.length);

const byId = <T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T) => {
  const out = new Map(a.map((x) => [x.id, x]));
  for (const y of b) { const x = out.get(y.id); out.set(y.id, x ? pick(x, y) : y); }
  return [...out.values()];
};

/** Joins this phone's data with the account's. Nothing is dropped; for the same match the further-scored copy wins. */
export function merge(local: Backup, cloud: Backup | null): Backup {
  if (!cloud) return local;
  const matches = byId(local.matches, cloud.matches ?? [], (x, y) => (progress(y) > progress(x) ? y : x)).sort((x, y) => y.createdAt - x.createdAt);
  const teams = byId(local.teams, cloud.teams ?? [], (x, y) => ({
    ...x, players: [...x.players, ...y.players.filter((p) => !x.players.some((q) => q.name.toLowerCase() === p.name.toLowerCase()))],
  }));
  const played = (c: Tournament) => c.fixtures.filter((f) => f.matchId).length;
  const cups = byId(local.cups, cloud.cups ?? [], (x, y) => (played(y) > played(x) ? y : x)).sort((x, y) => y.createdAt - x.createdAt);
  return { v: 1, matches, teams, cups };
}
