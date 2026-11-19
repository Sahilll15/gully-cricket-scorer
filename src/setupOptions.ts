import * as E from "./engine/engine";
import type { Match, Player, Rules, Surface, Team } from "./engine/types";
import { applyPreset, type PresetId } from "./presets";

/** How people play: two teams (limited overs or Test), batting pairs, everyone for themselves, or French cricket. */
export type Mode = "teams" | "pairs" | "solo" | "french";

export const DEFAULT_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

export const modeOf = (r: Rules): Mode =>
  r.format === "pairs" ? "pairs" : r.format === "solo" ? "solo" : r.format === "french" ? "french" : "teams";

/** Every control the rules editor has. */
export type Opt =
  | "overs" | "ballsPerOver" | "inningsBalls" | "matchOvers" | "pairOvers" | "turn" | "lives"
  | "mustRun" | "noRunning" | "lastManRunsTwo" | "onlyBoundaries" | "walls" | "sixOut"
  | "wicketPenalty" | "dotBallsOut" | "dotOut" | "missesOut" | "noLbw" | "oneTipCatch" | "protected"
  | "extras" | "freeHit" | "lastManStands" | "common" | "retireAt" | "maxOversPerBowler"
  | "goldenBall" | "powerBall" | "jokerOver" | "rotateUmpire";

// t limited overs, x Test, p pairs, s solo, f French cricket.
const WHERE: Record<Opt, string> = {
  overs: "tp", ballsPerOver: "txps", inningsBalls: "t", matchOvers: "x", pairOvers: "p", turn: "s", lives: "sf",
  mustRun: "txps", noRunning: "txps", lastManRunsTwo: "tx", onlyBoundaries: "tps", walls: "txps", sixOut: "txps",
  wicketPenalty: "tp", dotBallsOut: "tps", dotOut: "tps", missesOut: "tps", noLbw: "txps", oneTipCatch: "txpsf", protected: "tp",
  extras: "txpsf", freeHit: "txps", lastManStands: "tx", common: "txp", retireAt: "tx", maxOversPerBowler: "tp",
  goldenBall: "tp", powerBall: "tps", jokerOver: "tp", rotateUmpire: "txp",
};

const letter = (mode: Mode, test: boolean) => (mode === "teams" ? (test ? "x" : "t") : mode[0]);

/** Whether an option means anything in this format. */
export const shows = (opt: Opt, mode: Mode, test: boolean) => WHERE[opt].includes(letter(mode, test));

const KEYS: Partial<Record<Opt, (keyof Rules)[]>> = {
  ballsPerOver: ["ballsPerOver"], inningsBalls: ["inningsBalls"], matchOvers: ["matchOvers"], pairOvers: ["pairOvers"],
  turn: ["ballsPerTurn", "rounds"], lives: ["lives"], mustRun: ["mustRun", "tipAndRun"], noRunning: ["noRunning"],
  lastManRunsTwo: ["lastManRunsTwo"], onlyBoundaries: ["onlyBoundaries"], walls: ["walls", "wall"], sixOut: ["sixOut"],
  wicketPenalty: ["wicketPenalty"], dotBallsOut: ["dotBallsOut"], dotOut: ["dotOut"], missesOut: ["missesOut"], noLbw: ["noLbw"],
  oneTipCatch: ["oneTipCatch"], protected: ["protectedPlayers"], freeHit: ["freeHit"], lastManStands: ["lastManStands"],
  common: ["commonCantBowl"], retireAt: ["retireAt"], maxOversPerBowler: ["maxOversPerBowler"], goldenBall: ["goldenBall"],
  powerBall: ["powerBall"], jokerOver: ["jokerOver"], rotateUmpire: ["rotateUmpire"],
};

/** The rules a match starts with: options that don't apply to the format are reset, and the format is set. */
export function forMatch(r: Rules, mode: Mode, test: boolean): Rules {
  const out = { ...r } as Record<string, unknown>, base = DEFAULT_RULES as unknown as Record<string, unknown>;
  for (const opt of Object.keys(KEYS) as Opt[]) {
    if (shows(opt, mode, test)) continue;
    for (const k of KEYS[opt]!) { if (k in base) out[k] = base[k]; else delete out[k]; }
  }
  const rules = out as unknown as Rules;
  if (mode === "teams") { if (test) rules.format = "test"; else delete rules.format; }
  else rules.format = mode;
  return rules;
}

/** Switching format keeps every rule that still applies. Leaving solo or French puts the overs back to the default. */
export function withMode(r: Rules, mode: Mode, test = r.format === "test"): Rules {
  const next: Rules = { ...r, format: mode === "teams" ? (test ? "test" : undefined) : mode };
  const fromSolo = r.format === "solo" || r.format === "french";
  if ((mode === "teams" || mode === "pairs") && (fromSolo || !(next.overs >= 1))) next.overs = DEFAULT_RULES.overs;
  if (mode === "pairs" && r.format !== "pairs" && next.wicketPenalty === undefined) next.wicketPenalty = 5;
  return next;
}

/** Rules as the engine reads them, with every unset or switched-off option left out, so two can be compared. */
function canonical(r: Rules): string {
  const solo = r.format === "solo" || r.format === "french";
  const c: Record<string, unknown> = {
    ...r, tipAndRun: undefined, mustRun: E.mustRunMode(r), wicketPenalty: E.wicketPenaltyOf(r), ballsPerOver: E.ballsPerOver(r),
    pairOvers: r.format === "pairs" ? E.pairOversOf(r) : undefined, overs: solo ? undefined : r.overs,
    lives: solo ? r.lives ?? 1 : undefined, rounds: r.format === "solo" ? r.rounds ?? 1 : undefined,
    ballsPerTurn: r.format === "solo" ? (r.ballsPerTurn === undefined ? 12 : r.ballsPerTurn) : undefined,
  };
  const keep = (v: unknown) => !(v === undefined || v === null || v === false || v === 0 || v === "" || v === "off" || v === "none"
    || (Array.isArray(v) && !v.length) || (typeof v === "object" && v !== null && !Array.isArray(v) && !Object.keys(v).length));
  return JSON.stringify(Object.keys(c).sort().filter((k) => keep(c[k])).map((k) => [k, c[k]]));
}

/** True while the rules are still exactly what the preset gave, so its card stays lit. */
export function presetMatches(id: PresetId, r: Rules, mode: Mode, test: boolean): boolean {
  const p = applyPreset(id, r);
  return modeOf(p) === mode && (p.format === "test") === test && canonical(forMatch(p, mode, test)) === canonical(forMatch(r, mode, test));
}

export const SURFACES: { k: Surface; label: string }[] = [
  { k: "side", label: "Side wall" }, { k: "back", label: "Back wall" }, { k: "roof", label: "Roof" }, { k: "fullBack", label: "Back wall, full" },
];
export const BOX_WALLS: Partial<Record<Surface, number>> = { side: 1, back: 4, fullBack: 6 };
export const wallsOn = (r: Rules) => !!r.walls && Object.keys(r.walls).length > 0;

/** The one wall choice: plain, a fixed value or out for any wall, or box walls with a value for each surface. */
export type WallChoice = "none" | "four" | "six" | "out" | "box";
export const wallChoice = (r: Rules): WallChoice => (wallsOn(r) ? "box" : r.wall);
export const setWallChoice = (r: Rules, v: WallChoice): Rules =>
  v === "box" ? { ...r, wall: "none", walls: wallsOn(r) ? r.walls : { ...BOX_WALLS } } : { ...r, wall: v, walls: undefined };

/** Short labels for the rules that are on, for the collapsed rules row. */
export function ruleSummary(r: Rules, mode: Mode, test: boolean, common: string): string {
  const has = (o: Opt) => shows(o, mode, test), mr = E.mustRunMode(r), pen = E.wicketPenaltyOf(r), wc = wallChoice(r);
  return [
    r.extraRun && "Wide +1", r.rebowl && "Re-bowl", has("freeHit") && r.freeHit && "Free hit",
    has("lastManStands") && r.lastManStands && "Last man stands", r.oneTipCatch && "One-tip catch",
    has("mustRun") && mr === "touch" && "Tip and run", has("mustRun") && mr === "every-hit" && "Compulsory run",
    has("noRunning") && r.noRunning && "No running", has("onlyBoundaries") && r.onlyBoundaries && "Only 4s and 6s",
    has("walls") && (wc === "box" ? "Box walls" : wc !== "none" && `Wall ${wc}`),
    has("sixOut") && r.sixOut && "Hit out is out", has("noLbw") && r.noLbw && "No LBW",
    has("wicketPenalty") && pen > 0 && `Wicket costs ${pen}`,
    has("dotOut") && r.dotOut && "Dot is out", has("dotBallsOut") && !r.dotOut && !!r.dotBallsOut && `${r.dotBallsOut} dots out`,
    has("missesOut") && !!r.missesOut && `${r.missesOut} misses out`, has("lastManRunsTwo") && r.lastManRunsTwo && "Last man runs two",
    has("retireAt") && r.retireAt && `Retire at ${r.retireAt}`,
    has("maxOversPerBowler") && r.maxOversPerBowler && `${r.maxOversPerBowler} overs a bowler`,
    has("goldenBall") && r.goldenBall && "Golden ball", has("powerBall") && r.powerBall && "Power ball", has("jokerOver") && r.jokerOver && "Joker over",
    has("rotateUmpire") && r.rotateUmpire && "Umpires rotate",
    has("common") && common.trim() && `${common.trim()} plays both sides${r.commonCantBowl ? ", can't bowl" : ""}`,
  ].filter(Boolean).join(" · ");
}

const low = (s: string) => s.trim().toLowerCase();

/** Named players first, then "Player n" up to the team size. */
export const roster = (named: string[], size: number): Player[] => {
  const list = named.map((name) => ({ id: E.uid(), name }));
  for (let i = list.length; i < size; i++) list.push({ id: E.uid(), name: `Player ${i + 1}` });
  return list;
};

/** Both sides with the common player at the end of each. Order is kept: in pairs it is the batting pairs. */
export function buildTeams(a: string, b: string, na: string[], nb: string[], sa: number, sb: number, common: string): { teams: [Team, Team]; common: Player | null } {
  const c = common.trim() ? { id: E.uid(), name: common.trim() } : null;
  const others = (names: string[]) => names.filter((n) => low(n) !== low(c?.name ?? "\u0000"));
  const side = (names: string[], size: number) => [...roster(others(names), Math.max(size, others(names).length)), ...(c ? [c] : [])];
  return { teams: [{ name: a.trim() || "Team A", players: side(na, sa) }, { name: b.trim() || "Team B", players: side(nb, sb) }], common: c };
}

/** Protected players are picked by name during setup; the match needs their ids. */
export function protectIds(teams: Team[], names: string[]): string[] {
  const want = new Set(names.map(low)), ids = new Set<string>();
  for (const t of teams) for (const p of t.players) if (want.has(low(p.name))) ids.add(p.id);
  return [...ids];
}

/** Batting pairs in order, two by two. An odd one out bats with the first opener, as the engine pairs them. */
export function pairsOf<T>(list: T[]): [T, T | null][] {
  const out: [T, T | null][] = [];
  for (let i = 0; i < list.length; i += 2) out.push([list[i], list[i + 1] ?? (i ? list[0] : null)]);
  return out;
}

export function shuffled<T>(list: T[]): T[] {
  const l = [...list];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

/** Settings a solo or French match takes from the editor; newSoloMatch fills in the rest. */
export const soloSettings = (r: Rules, mode: "solo" | "french"): Partial<Rules> => forMatch(r, mode, false);

/** A throwaway match built from the setup so the rules card can show names and the format. */
export function draftMatch(rules: Rules, mode: Mode, test: boolean, teams: [Team, Team], players: Player[]): Match {
  if (mode === "solo" || mode === "french") {
    const list = players.length >= 2 ? players : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];
    return E.newSoloMatch(list, soloSettings(rules, mode));
  }
  return E.newMatch(teams, forMatch(rules, mode, test));
}

/** Web icon per preset. The app uses line icons instead. */
export const PRESET_EMOJI: Record<PresetId, string> = {
  gully: "🏏", "tip-and-run": "🏃", "compulsory-run": "⏱", box: "📦", "box-pairs": "👥", "double-wicket": "✌️", "sixes-only": "💥",
  "tape-ball": "🎾", office: "🏢", hundred: "💯", french: "🦵", solo: "🙋", "solo-test": "⏳", test: "🏟",
};
