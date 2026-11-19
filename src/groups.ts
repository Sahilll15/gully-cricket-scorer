import { uid } from "./engine/engine";
import type { Player } from "./engine/types";

/** A named squad of players ("Sunday boys") that can fill a team in one tap and be shared. */
export interface PlayerGroup { id: string; name: string; players: Player[] }

/** What a share code carries: just a name and player names, never ids or match data. */
export interface GroupInvite { name: string; names: string[] }

export const MAX_GROUP_PLAYERS = 40;
const PREFIX = "GSG1.";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const low = (s: string) => s.trim().toLowerCase();

/** Trimmed, de-duplicated (ignoring case), capped names. Auto names like "Player 3" are dropped. */
export function cleanNames(names: string[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().replace(/\s+/g, " ").slice(0, 20);
    if (!n || /^player \d+$/i.test(n) || seen.has(low(n))) continue;
    seen.add(low(n));
    out.push(n);
  }
  return out.slice(0, MAX_GROUP_PLAYERS);
}

export const newGroup = (name: string, names: string[] = []): PlayerGroup => ({
  id: uid(), name: name.trim().slice(0, 24), players: cleanNames(names).map((n) => ({ id: uid(), name: n })),
});

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function fromUtf8(b: number[]): string {
  let s = "";
  for (let i = 0; i < b.length;) {
    const x = b[i++];
    if (x < 0x80) s += String.fromCodePoint(x);
    else if (x < 0xe0) s += String.fromCodePoint(((x & 31) << 6) | (b[i++] & 63));
    else if (x < 0xf0) s += String.fromCodePoint(((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else s += String.fromCodePoint(((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
  }
  return s;
}

// Pure-JS base64url so the same code runs on the web and in Hermes without btoa.
function toB64(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += B64[n & 63];
  }
  return s;
}

function fromB64(s: string): number[] | null {
  const v = [...s].map((c) => B64.indexOf(c));
  if (v.some((x) => x < 0) || v.length % 4 === 1) return null;
  const out: number[] = [];
  for (let i = 0; i < v.length; i += 4) {
    const n = (v[i] << 18) | ((v[i + 1] ?? 0) << 12) | ((v[i + 2] ?? 0) << 6) | (v[i + 3] ?? 0);
    out.push((n >> 16) & 255);
    if (i + 2 < v.length) out.push((n >> 8) & 255);
    if (i + 3 < v.length) out.push(n & 255);
  }
  return out;
}

/** A self-contained code, so sharing needs no account or server. Anyone with it can import the group. */
export function encodeGroup(g: Pick<PlayerGroup, "name" | "players">): string {
  const body = JSON.stringify([g.name.trim(), ...cleanNames(g.players.map((p) => p.name))]);
  return PREFIX + toB64(utf8(body));
}

/** Accepts a bare code, a share link, or a whole pasted message containing either. Null if there is no valid group in it. */
export function decodeGroup(text: string): GroupInvite | null {
  const m = /GSG1\.([A-Za-z0-9_-]+)/.exec(text);
  if (!m) return null;
  const bytes = fromB64(m[1]);
  if (!bytes) return null;
  try {
    const arr: unknown = JSON.parse(fromUtf8(bytes));
    if (!Array.isArray(arr) || arr.length < 2 || arr.some((x) => typeof x !== "string")) return null;
    const [name, ...rest] = arr as string[];
    const names = cleanNames(rest);
    return name.trim() && names.length ? { name: name.trim().slice(0, 24), names } : null;
  } catch { return null; }
}

export const groupLink = (g: Pick<PlayerGroup, "name" | "players">, base: string) => `${base}?group=${encodeGroup(g)}`;

/** The message sent over WhatsApp: a friendly line, the link, and the bare code for people on the app. */
export const groupShareText = (g: PlayerGroup, base: string) =>
  `Join my Gully Scorer group "${g.name}" (${g.players.length} players).\nOpen: ${groupLink(g, base)}\nOr paste this code in Teams > Player groups > Import:\n${encodeGroup(g)}`;

/** Adds an invite as a new group. A group with the same name gains the missing players instead of being duplicated. */
export function importInvite(groups: PlayerGroup[], inv: GroupInvite): { groups: PlayerGroup[]; group: PlayerGroup; added: number } {
  const have = groups.find((g) => low(g.name) === low(inv.name));
  if (!have) {
    const group = newGroup(inv.name, inv.names);
    return { groups: [...groups, group], group, added: group.players.length };
  }
  const fresh = inv.names.filter((n) => !have.players.some((p) => low(p.name) === low(n)));
  const group = { ...have, players: [...have.players, ...fresh.map((name) => ({ id: uid(), name }))].slice(0, MAX_GROUP_PLAYERS) };
  return { groups: groups.map((g) => (g.id === have.id ? group : g)), group, added: group.players.length - have.players.length };
}

export const putIn = (groups: PlayerGroup[], g: PlayerGroup) => (groups.some((x) => x.id === g.id) ? groups.map((x) => (x.id === g.id ? g : x)) : [...groups, g]);

/** Players to add to a team: the chosen names that the team doesn't already have, as fresh players. */
export function playersFrom(group: PlayerGroup, have: Player[], only?: string[]): Player[] {
  const want = only ? new Set(only.map(low)) : null;
  return group.players.filter((p) => (!want || want.has(low(p.name))) && !have.some((q) => low(q.name) === low(p.name))).map((p) => ({ id: uid(), name: p.name }));
}

/** Backups from two devices: the same group (by id) keeps every player either side has. */
export function mergeGroups(local: PlayerGroup[], cloud: PlayerGroup[]): PlayerGroup[] {
  const out = new Map(local.map((g) => [g.id, g]));
  for (const c of cloud) {
    const x = out.get(c.id);
    out.set(c.id, x ? { ...x, players: [...x.players, ...c.players.filter((p) => !x.players.some((q) => low(q.name) === low(p.name)))] } : c);
  }
  return [...out.values()];
}
