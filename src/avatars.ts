/** Name-seeded jersey avatars on a 64x64 grid: the back of a shirt for players, the front for teams. */

export interface Kit { base: string; trim: string; ink: string }
export interface PlayerJersey { kit: Kit; initials: string; number: number }
export interface TeamJersey { kit: Kit; code: string }

interface Paint { fill?: string; stroke?: string; sw?: number; o?: number }
/** `clip` shapes are clipped to the shirt body; every shape is clipped to the round tile. */
export type Shape = Paint & { clip?: boolean } & (
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "path"; d: string }
  | { t: "text"; x: number; y: number; text: string; size: number; spacing?: number }
);
export interface JerseyArt { body: string; shapes: Shape[] }

/** Strong shirt colours that hold up on the dark UI, each with a trim and a lettering colour. */
export const KITS: readonly Kit[] = [
  { base: "#2456d6", trim: "#ffd34d", ink: "#ffffff" },
  { base: "#ff8a3d", trim: "#16161d", ink: "#16161d" },
  { base: "#c8102e", trim: "#f6f1e7", ink: "#ffffff" },
  { base: "#12a150", trim: "#fff1b8", ink: "#ffffff" },
  { base: "#7b3fe4", trim: "#ffc53d", ink: "#ffffff" },
  { base: "#ffcf33", trim: "#1e3a8a", ink: "#1e3a8a" },
  { base: "#0fb5ae", trim: "#0b2230", ink: "#0b2230" },
  { base: "#3aa8f0", trim: "#0c2a4a", ink: "#0c2a4a" },
  { base: "#ff6fb5", trim: "#3a0d24", ink: "#3a0d24" },
  { base: "#9be33b", trim: "#14361a", ink: "#14361a" },
  { base: "#ece8df", trim: "#d7263d", ink: "#1e2a44" },
];

/** FNV-1a over the trimmed, lower-cased name, so "Ravi " and "ravi" match. */
export function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Salted, mixed hash so each trait spreads independently of the others. */
function trait(name: string, salt: string): number {
  let h = nameHash(`${name.trim().toLowerCase()}#${salt}`);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const words = (name: string) => name.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** First and last initial, so "Ravi" is "R" and "Ravi Kumar Shah" is "RS". */
export function initials(name: string): string {
  const w = words(name);
  if (!w.length) return "?";
  const first = [...w[0]][0], last = w.length > 1 ? [...w[w.length - 1]][0] : "";
  return (first + last).toUpperCase();
}

/** 2 to 3 letter team code: first letters of each word, keeping short tags like "XI" or "4" whole. */
export function teamCode(name: string): string {
  const w = words(name);
  if (!w.length) return "?";
  if (w.length === 1) return [...w[0]].slice(0, 3).join("").toUpperCase();
  const isTag = (s: string) => /^\p{N}+$/u.test(s) || (s.length <= 3 && s.length > 1 && s === s.toUpperCase());
  return [...w.map((s) => (isTag(s) ? s : [...s][0])).join("")].slice(0, 3).join("").toUpperCase();
}

export function playerJersey(name: string): PlayerJersey {
  return { kit: KITS[trait(name, "squad") % KITS.length], initials: initials(name), number: (trait(name, "no") % 99) + 1 };
}

export function teamJersey(name: string): TeamJersey {
  return { kit: KITS[trait(name, "jersey") % KITS.length], code: teamCode(name) };
}

/** Darkens (k < 0) or lightens (k > 0) a #rrggbb colour. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16), to = k < 0 ? 0 : 255, a = Math.abs(k);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Below this rendered size the squad number is dropped and the lettering grows. */
export const SMALL_AVATAR = 40;

const path = (d: string, p: Paint & { clip?: boolean } = {}): Shape => ({ t: "path", d, ...p });

// Shirt and sleeves run off the tile edge; the round clip trims them.
const SHIRT = "M24 13C27 15 37 15 40 13L51 17L61 29L54 36L49 32V70H15V32L10 36L3 29L13 17Z";
const BODY = "M15 24H49V70H15Z";
const CUFF_L = "M3 29L10 36L12.2 33.3L5.2 26.3Z";
const CUFF_R = "M61 29L54 36L51.8 33.3L58.8 26.3Z";
const SEAMS = "M15 32V24M49 32V24";

function tile(kit: Kit, small: boolean): Shape[] {
  const out: Shape[] = [
    { t: "circle", cx: 32, cy: 32, r: 32, fill: shade(kit.base, -0.66) },
    path(SHIRT, { fill: kit.base }),
    path("M15 32V70H21V32Z", { fill: shade(kit.base, -0.12), clip: true }),
    path("M43 32V70H49V32Z", { fill: shade(kit.base, -0.12), clip: true }),
    path(CUFF_L, { fill: kit.trim }), path(CUFF_R, { fill: kit.trim }),
  ];
  if (!small) out.push(path(SEAMS, { stroke: shade(kit.base, -0.22), sw: 0.8 }));
  return out;
}

export function playerArt(j: PlayerJersey, small = false): JerseyArt {
  const { kit } = j, shapes = tile(kit, small);
  shapes.push(path("M24 13C27 15 37 15 40 13L40.6 16.2C37 18.4 27 18.4 23.4 16.2Z", { fill: kit.trim }));
  const two = j.initials.length > 1;
  if (small) {
    shapes.push({ t: "text", x: 32, y: 50, text: j.initials, size: two ? 25 : 29, fill: kit.ink, spacing: two ? -0.5 : 0 });
  } else {
    shapes.push({ t: "text", x: 32, y: 42, text: j.initials, size: two ? 19 : 21, fill: kit.ink, spacing: two ? -0.4 : 0 });
    shapes.push({ t: "text", x: 32, y: 55.5, text: String(j.number), size: 10, fill: kit.ink, o: 0.82 });
  }
  return { body: BODY, shapes };
}

export function teamArt(j: TeamJersey, small = false): JerseyArt {
  const { kit } = j, shapes = tile(kit, small), three = j.code.length > 2;
  shapes.push(path("M15 64L49 47V56L15 73Z", { fill: kit.trim, clip: true }));
  const v = small ? 20 : 24;
  shapes.push(path(`M24 13L32 ${v}L40 13L41.4 15.6L32 ${v + 4}L22.6 15.6Z`, { fill: kit.trim }));
  const size = small ? (three ? 19 : 23) : three ? 14 : 17;
  shapes.push({ t: "text", x: 32, y: small ? 49 : 44, text: j.code, size, fill: kit.ink, spacing: three ? -0.6 : -0.3 });
  return { body: BODY, shapes };
}
