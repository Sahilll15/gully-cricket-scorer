import * as E from "./engine/engine";
import type { Ball, BallInput, Match, Player, Rules, Surface, WicketKind } from "./engine/types";

// Platform-free helpers for the live scoring screen, shared by the web app and the native app.

export const SURFACES: Surface[] = ["side", "back", "roof", "fullBack"];
export const SURFACE_NAME: Record<Surface, string> = { side: "Side", back: "Back", roof: "Roof", fullBack: "Full back" };
/** Surfaces this match gives a value to, so they get a key while scoring. */
export const wallKeys = (r: Rules): Surface[] => SURFACES.filter((s) => r.walls?.[s] !== undefined);

export const BLOCK_TEXT: Record<E.BowlBlock, string> = {
  left: "Went home", batting: "Batting", common: "Common player, can't bowl", "just bowled": "Bowled the last over", cap: "No overs left",
};

/** "12.3/20", "75/100 balls", or just "12.3" with no limit. */
export function oversLine(m: Match, idx: number, st: E.State): string {
  const inn = m.innings[idx], o = E.oversText(st.legal, st.bpo);
  if (st.maxBalls === null || E.isSolo(m)) return o;
  return inn.balls ? `${st.legal}/${inn.balls} balls` : `${o}/${inn.overs}`;
}

/** Golden ball, power ball and Joker over that fall on the next ball. */
export function nextBallBadges(m: Match, st: E.State): string[] {
  const r = m.rules, over = Math.floor(st.legal / st.bpo) + 1, ball = (st.legal % st.bpo) + 1, out: string[] = [];
  if (r.goldenBall && r.goldenBall.over === over && r.goldenBall.ball === ball) out.push("Golden ball");
  if (r.powerBall === ball) out.push("Power ball");
  if (r.jokerOver === over) out.push("Joker over");
  return out;
}

/** Batters at the crease whose first dismissal this innings costs runs instead. */
export function protectedNote(m: Match, st: E.State): string | null {
  const ids = [st.striker, st.nonStriker].filter((id): id is string => !!id && !!m.rules.protectedPlayers?.includes(id) && !st.bat.get(id)?.saved);
  if (!ids.length) return null;
  const pen = E.wicketPenaltyOf(m.rules) || 5;
  return `Protected: ${ids.map((id) => E.playerName(m, id)).join(" and ")}. First time out costs ${pen} run${pen === 1 ? "" : "s"} instead.`;
}

/** Runs the next dismissal of `outId` will take off: golden ball, the protected cost or the wicket penalty. */
export function wicketCost(m: Match, st: E.State, outId: string | null): number {
  const golden = nextBallBadges(m, st).includes("Golden ball") ? 6 : 0, pen = E.wicketPenaltyOf(m.rules);
  const saving = !!outId && !!m.rules.protectedPlayers?.includes(outId) && !st.bat.get(outId)?.saved;
  return golden + (saving ? pen || 5 : pen);
}

const lastBall = (m: Match, idx: number): Ball | null => {
  const evs = m.innings[idx]?.events ?? [], e = evs[evs.length - 1];
  return e?.t === "ball" ? e : null;
};

/** The ball just added was a wicket (forced or given), whether or not a protected player stayed in. */
export function ballWasOut(before: Match, after: Match): boolean {
  const i = before.innings.length - 1;
  return i >= 0 && (after.innings[i]?.events.length ?? 0) > before.innings[i].events.length && !!lastBall(after, i)?.wicket;
}

/** Pairs: the pair in now, what it has made, and balls before the next pair comes in. */
export function pairNow(m: Match, idx: number) {
  if (!E.isPairs(m) || !m.innings[idx]) return null;
  const st = E.replay(m, idx), per = E.pairOversOf(m.rules) * st.bpo, blk = st.blocks[Math.floor(st.legal / per)];
  const left = Math.min(per - (st.legal % per), st.maxBalls === null ? Infinity : Math.max(0, st.maxBalls - st.legal));
  return { runs: blk?.runs ?? 0, outs: blk?.outs ?? 0, ballsLeft: left, standings: E.pairStandings(m, idx) };
}

/** What the rules did on the ball just added that the scorer should see: a forced out, a protected save, a cost, a new pair. */
export function ballNotice(before: Match, after: Match, input: BallInput): string | null {
  const i = before.innings.length - 1;
  if (i < 0 || !after.innings[i]) return null;
  const a = E.replay(before, i), b = E.replay(after, i), ev = lastBall(after, i), out: string[] = [];
  const name = (id: string | null | undefined) => E.playerName(after, id ?? null);
  if (ev?.wicket && !input.wicket) {
    const r = after.rules;
    out.push(ev.wicket.kind === "misses" ? `${name(a.striker)} is out: ${r.missesOut} miss${r.missesOut === 1 ? "" : "es"}`
      : r.dotOut ? `${name(a.striker)} is out: a dot ball is out` : `${name(a.striker)} is out: ${r.dotBallsOut} dot balls in a row`);
  }
  const cost = b.deducted - a.deducted;
  if (ev?.wicket && b.wickets === a.wickets) out.push(`${name(ev.wicket.outId ?? a.striker)} is protected and stays in, ${cost} run${cost === 1 ? "" : "s"} off`);
  else if (cost > 0) out.push(`That dismissal costs ${cost} run${cost === 1 ? "" : "s"}`);
  if (E.isPairs(after) && b.legal > a.legal) {
    const per = E.pairOversOf(after.rules) * b.bpo;
    if (b.legal % per === 0 && (b.maxBalls === null || b.legal < b.maxBalls) && b.striker)
      out.push(`New pair in: ${[b.striker, b.nonStriker].filter(Boolean).map((id) => name(id)).join(" and ")}`);
  }
  return out.length ? out.join(". ") : null;
}

function outLine(kind: WicketKind, who: string, bowler: string, by: string | null): string {
  if (kind === "bowled") return `Out! Bowled by ${bowler}`;
  if (kind === "caught" || kind === "one-tip catch") return by ? `Out! ${who} caught by ${by}` : `Out! ${who} is caught`;
  if (kind === "lbw") return `Out! ${who} lbw to ${bowler}`;
  if (kind === "stumped") return `Out! ${who} is stumped`;
  if (kind === "run out") return `Out! ${who} is run out`;
  if (kind === "misses") return `Out! ${who} missed one too many`;
  return `Out! ${who}, ${kind}`;
}

/** One short spoken line for the ball just added: "Four! Aarav moves to 23", "Out! Bowled by Rohan", "End of the over, 34 for 2". */
export function commentary(before: Match, after: Match, input: BallInput): string {
  const i = before.innings.length - 1;
  if (i < 0 || !after.innings[i]) return "";
  const a = E.replay(before, i), b = E.replay(after, i), ev = lastBall(after, i);
  if (!ev || (after.innings[i].events.length <= before.innings[i].events.length)) return "";
  const name = (id: string | null | undefined) => E.playerName(after, id ?? null), solo = E.isSolo(after);
  const sid = a.striker, me = sid ? b.bat.get(sid) : undefined, runs = b.runs - a.runs + (b.deducted - a.deducted);
  const lines: string[] = [];
  if (ev.wicket) {
    const w = ev.wicket, who = name(w.outId ?? (w.out === "s" ? a.striker : a.nonStriker));
    lines.push(b.wickets === a.wickets ? `Out, but ${who} is protected and stays in` : outLine(w.kind, who, name(ev.bowler), w.fielderId ? name(w.fielderId) : null));
  } else if (input.extra === "wd") lines.push(runs > 1 ? `Wide, ${runs} runs` : "Wide");
  else if (input.extra === "nb") lines.push(input.runs && me ? `No ball, ${name(sid)} moves to ${me.runs}` : "No ball");
  else if (input.extra === "b" || input.extra === "lb") lines.push(`${runs} ${input.extra === "b" ? "bye" : "leg bye"}${runs === 1 ? "" : "s"}`);
  else if (!input.wall && !input.overthrow && input.runs === 6) lines.push(`Six! ${name(sid)} moves to ${me?.runs ?? 0}`);
  else if (!input.wall && !input.overthrow && input.runs === 4) lines.push(`Four! ${name(sid)} moves to ${me?.runs ?? 0}`);
  else if (runs === 0) lines.push("Dot ball");
  else lines.push(`${runs === 1 ? "One run" : `${runs} runs`}, ${name(sid)} on ${me?.runs ?? 0}`);

  const score = solo ? `${b.runs}` : `${b.runs} for ${b.wickets}`;
  const res = after.status === "done" ? E.result(after) : null;
  if (res) lines.push(res.text);
  else if (b.ended && !a.ended) lines.push(solo ? `That's the turn, ${name(after.innings[i].striker)} finishes on ${b.runs}` : `That's the innings, ${score}`);
  else if (!E.isFrench(after) && b.legal > a.legal && b.legal % b.bpo === 0) lines.push(`End of the over, ${score}`);
  return lines.join(". ");
}

// Wagon wheel. Zones 1 to 8 go round a field clockwise from fine leg; 9 to 11 are the walls and nets of a box.

export const FIELD_ZONES = ["Fine leg", "Square leg", "Midwicket", "Long on", "Long off", "Cover", "Point", "Third man"];
export const BOX_ZONES = ["Front wall", "Off net", "Leg net"];
/** Box mode once the match gives the walls their own values. */
export const boxMode = (r: Rules) => wallKeys(r).length > 0;
export const zoneName = (z: number) => (z >= 9 ? BOX_ZONES[z - 9] : FIELD_ZONES[z - 1]) ?? "";
/** Degrees clockwise from straight up (the bowler's end) where a field zone's wedge starts. */
export const zoneFrom = (z: number) => (180 + (z - 1) * 45) % 360;

/** A shot worth asking where it went: runs off the bat, a wall or an overthrow, not a wide, bye or wicket. */
export const wantsZone = (input: BallInput) =>
  !input.wicket && input.extra !== "wd" && input.extra !== "b" && input.extra !== "lb" && (input.runs > 0 || !!input.wall || !!input.overthrow);

/** Sets where a ball went. Display only: nothing in the score changes. */
export function setZone(m: Match, idx: number, evIdx: number, zone: number): Match {
  const n: Match = JSON.parse(JSON.stringify(m)), ev = n.innings[idx]?.events[evIdx];
  if (!ev || ev.t !== "ball") return m;
  ev.zone = zone;
  return n;
}

const point = (cx: number, cy: number, r: number, deg: number) => {
  const t = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
};
/** SVG path of a pie wedge from `from` to `to` degrees, clockwise from up. */
export function wedgePath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = point(cx, cy, r, from), b = point(cx, cy, r, to);
  return `M${cx} ${cy} L${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)} Z`;
}
export const labelAt = (cx: number, cy: number, r: number, z: number) => point(cx, cy, r, zoneFrom(z) + 22.5);

// Rules that can change mid-match by agreement.

type NumKey = "overs" | "maxOversPerBowler" | "retireAt" | "dotBallsOut" | "missesOut" | "wicketPenalty" | "powerBall" | "jokerOver";
type ToggleKey = "extraRun" | "rebowl" | "freeHit" | "lastManStands" | "oneTipCatch" | "sixOut" | "noLbw" | "rotateUmpire" | "commonCantBowl"
  | "noRunning" | "onlyBoundaries" | "dotOut" | "lastManRunsTwo";
export type RuleField =
  | { kind: "toggle"; key: ToggleKey; label: string }
  | { kind: "number"; key: NumKey; label: string; min: number; max: number; step: number; off?: string }
  | { kind: "choice"; key: "wall" | "mustRun"; label: string; options: { v: string; label: string }[] };

/** The rules this match can change now, as plain settings. */
export function ruleFields(m: Match): RuleField[] {
  const solo = E.isSolo(m), test = E.isTest(m), r = m.rules, overs = r.overs || 20;
  if (E.isFrench(m)) return [{ kind: "toggle", key: "oneTipCatch", label: "One tip, one hand catch is out" }, { kind: "toggle", key: "rotateUmpire", label: "Fielders take turns to umpire" }];
  const out: RuleField[] = [];
  if (!solo && !test) out.push({ kind: "number", key: "overs", label: "Overs a side", min: Math.max(1, E.minOvers(m)), max: 50, step: 1 });
  if (!solo) out.push({ kind: "number", key: "maxOversPerBowler", label: "Most overs a bowler", min: 0, max: test ? 50 : overs, step: 1, off: "No limit" });
  out.push(
    { kind: "toggle", key: "extraRun", label: "Wides and no-balls give a run" },
    { kind: "toggle", key: "rebowl", label: "Wides and no-balls are bowled again" },
    { kind: "toggle", key: "freeHit", label: "Free hit after a no-ball" },
  );
  if (!solo) out.push({ kind: "toggle", key: "lastManStands", label: "Last man stands" });
  out.push(
    { kind: "toggle", key: "oneTipCatch", label: "One tip, one hand catch is out" },
    { kind: "choice", key: "wall", label: "The wall", options: [{ v: "none", label: "Nothing" }, { v: "four", label: "Four" }, { v: "six", label: "Six" }, { v: "out", label: "Out" }] },
    { kind: "choice", key: "mustRun", label: "Must run", options: [{ v: "off", label: "Off" }, { v: "touch", label: "Tip and run" }, { v: "every-hit", label: "Every ball" }] },
    { kind: "toggle", key: "sixOut", label: "Hit out of the ground is out" },
    { kind: "toggle", key: "noLbw", label: "No lbw" },
    { kind: "number", key: "retireAt", label: "Retire at", min: 0, max: 100, step: 5, off: "Never" },
    { kind: "toggle", key: "rotateUmpire", label: "Fielders take turns to umpire" },
  );
  if (!solo) out.push({ kind: "toggle", key: "commonCantBowl", label: "Common player can't bowl" });
  out.push(
    { kind: "toggle", key: "noRunning", label: "No running" },
    { kind: "toggle", key: "onlyBoundaries", label: "Only 4s, 6s and walls count" },
    { kind: "toggle", key: "dotOut", label: "A dot ball is out" },
    { kind: "number", key: "dotBallsOut", label: "Dot balls in a row is out", min: 0, max: 6, step: 1, off: "Off" },
    { kind: "number", key: "missesOut", label: "Misses and you're out", min: 0, max: 6, step: 1, off: "Off" },
    { kind: "number", key: "wicketPenalty", label: "Runs off for a dismissal", min: 0, max: 20, step: 1, off: "None" },
  );
  if (!solo) out.push({ kind: "toggle", key: "lastManRunsTwo", label: "Last batter alone runs two for one" });
  out.push({ kind: "number", key: "powerBall", label: "Power ball, every over", min: 0, max: E.ballsPerOver(r), step: 1, off: "Off" });
  if (!solo && !test) out.push({ kind: "number", key: "jokerOver", label: "Joker over", min: 0, max: overs, step: 1, off: "Off" });
  return out;
}

const NULL_WHEN_OFF: NumKey[] = ["maxOversPerBowler", "retireAt", "powerBall", "jokerOver"];

/** A field's value as the rules read now, with a draft change on top. Numbers that are off read 0. */
export function fieldValue(m: Match, f: RuleField, draft: Partial<Rules>): boolean | number | string {
  const r = { ...m.rules, ...draft };
  if (f.kind === "toggle") return !!r[f.key];
  if (f.kind === "choice") return f.key === "mustRun" ? (draft.mustRun ?? E.mustRunMode(m.rules)) : r.wall;
  if (f.key === "wicketPenalty") return draft.wicketPenalty ?? E.wicketPenaltyOf(m.rules);
  return (r[f.key] as number | null | undefined) ?? 0;
}

/** The draft with one field set, ready for changeRules. */
export function setField(draft: Partial<Rules>, f: RuleField, v: boolean | number | string): Partial<Rules> {
  if (f.kind === "number") return { ...draft, [f.key]: NULL_WHEN_OFF.includes(f.key) && !v ? null : v };
  return { ...draft, [f.key]: v };
}

/** Both sides have someone agreeing: a player from each team, or two players in a solo match. */
export function agreed(m: Match, ids: string[]): boolean {
  if (E.isSolo(m)) return new Set(ids).size >= 2;
  const has = (s: 0 | 1) => ids.some((id) => m.teams[s].players.some((p: Player) => p.id === id));
  return has(0) && has(1);
}

export const LOST_REASONS = ["Lost in the bushes", "Over the wall", "In the drain", "Neighbour kept it"];
export const TURF_PRESETS = [30, 45, 60, 90, 120];

/** "42:05" or "1:02:05". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
}

/** Turf alerts: 10 and 5 minutes before the end, then time up. Returns the one crossed since the last tick, if any. */
export function turfAlert(prevLeft: number, left: number): string | null {
  if (prevLeft > 0 && left <= 0) return "Time's up on the turf";
  for (const mins of [5, 10]) if (prevLeft > mins * 60000 && left <= mins * 60000) return `${mins} minutes left on the turf`;
  return null;
}

/** A player goes home. One at the crease retires, with the next batter in when there is one. */
export function leaveMatch(m: Match, id: string): Match {
  let n = E.markLeft(m, id);
  const idx = n.innings.length - 1;
  if (n.status !== "live" || idx < 0) return n;
  const st = E.replay(n, idx);
  if (id !== st.striker && id !== st.nonStriker) return n;
  const newId = E.isSolo(n) || E.isPairs(n) ? null : E.yetToBat(n, idx)[0]?.id ?? null;
  n = E.retire(n, id === st.striker ? "s" : "ns", newId);
  return n;
}

/** Rule names for the change log, from the settings list, falling back to the key. */
export function ruleLabel(m: Match, key: string): string {
  return ruleFields(m).find((f) => f.key === key)?.label ?? key;
}
