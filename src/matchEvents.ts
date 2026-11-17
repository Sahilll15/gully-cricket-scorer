import * as E from "./engine/engine";
import type { Ev, Match, Rules } from "./engine/types";
import { EV, type EventName, type EventParams } from "./events";
import { PRESETS } from "./presets";
import { presetMatches, type Mode } from "./setupOptions";

export type Tracked = [EventName, EventParams];

export const flag = (on: unknown) => (on ? 1 : 0);
const slug = (s: string) => s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_");
const formatOf = (r: Rules) => r.format ?? "limited";
const modeOf = (r: Rules) => (r.format === "solo" || r.format === "french" || r.format === "pairs" ? r.format : "team");
const playerCount = (m: Match) => new Set(m.teams.flatMap((t) => t.players.map((p) => p.id))).size;

/** The preset the setup rules still match exactly, or "custom". */
export const presetIdOf = (r: Rules, mode: Mode, test: boolean): string => PRESETS.find((p) => presetMatches(p.id, r, mode, test))?.id ?? "custom";

export function matchStartParams(m: Match, preset: string, quick = false): EventParams {
  const r = m.rules, overs = r.format === "test" || r.format === "solo" || r.format === "french" ? 0 : r.overs;
  return {
    format: formatOf(r), preset, overs, balls_per_over: E.ballsPerOver(r), players: playerCount(m), mode: modeOf(r),
    quick: flag(quick), chase: flag(m.innings[0]?.given),
  };
}

function resultType(m: Match): string {
  const r = E.result(m);
  if (!r) return "none";
  return r.stopped ? "stopped" : r.draw ? "draw" : r.tie ? "tie" : "win";
}

function eventOf(ev: Ev): Tracked | null {
  if (ev.t === "ball") return ev.wicket ? [EV.wicket, { kind: slug(ev.wicket.kind) }] : null;
  if (ev.t === "swap") return [EV.swap_strike, {}];
  if (ev.t === "retire") return [EV.retire, { hurt: flag(ev.hurt) }];
  if (ev.t === "lost") return [EV.ball_lost, {}];
  if (ev.t === "penalty") return [EV.penalty, { runs: ev.runs }];
  return [EV.rule_change, { rules: Object.keys(ev.to).join(",").slice(0, 100) }];
}

/** Runs and wickets of the over the last ball finished, or null when it didn't finish one. */
function overDone(before: Match, after: Match, idx: number): EventParams | null {
  const a = E.replay(before, idx), b = E.replay(after, idx);
  if (b.legal <= a.legal || b.legal % b.bpo !== 0) return null;
  const first = b.feed.find((f) => f.over === b.legal / b.bpo - 1)?.evIdx ?? 0, inn = after.innings[idx];
  const start = E.replay({ ...after, innings: [...after.innings.slice(0, idx), { ...inn, events: inn.events.slice(0, first) }] }, idx);
  return { runs: b.runs - start.runs, wickets: b.wickets - start.wickets };
}

/** Analytics events implied by a local change to a stored match: new balls, innings and match ends, and so on. */
export function matchEvents(before: Match, after: Match): Tracked[] {
  const out: Tracked[] = [], n = after.innings.length, idx = n - 1, same = n === before.innings.length && idx >= 0;
  let rulesEv = false;
  if (same) {
    const was = before.innings[idx].events.length, now = after.innings[idx].events;
    for (let i = was; i < now.length; i++) {
      const e = eventOf(now[i]);
      if (e) out.push(e);
      if (now[i].t === "rules") rulesEv = true;
    }
    if (now.length > was && now.slice(was).some((e) => e.t === "ball")) {
      const over = overDone(before, after, idx);
      if (over) out.push([EV.over_end, over]);
    }
    if (after.innings[idx].declared && !before.innings[idx].declared) out.push([EV.declare, {}]);
  }
  if ((after.changes?.length ?? 0) > (before.changes?.length ?? 0)) out.push([EV.edit_ball, {}]);
  if ((after.left?.length ?? 0) > (before.left?.length ?? 0)) out.push([EV.player_left, {}]);
  if (playerCount(after) > playerCount(before)) out.push([EV.player_added, {}]);
  if (!rulesEv && after.rules.overs !== before.rules.overs) out.push([EV.change_overs, { overs: after.rules.overs }]);
  if (n > before.innings.length && after.innings[idx].superOver && !before.innings.some((i) => i.superOver)) out.push([EV.super_over_start, {}]);
  if (after.stopped && !before.stopped) out.push([EV.stop_match, { kind: E.isFrench(after) ? "end" : "draw" }]);
  if (after.stoppedLead && !before.stoppedLead) out.push([EV.stop_match, { kind: "leader" }]);
  if (same && before.status === "live" && (after.status === "break" || after.status === "done"))
    out.push([EV.innings_end, { innings: n, super_over: flag(after.innings[idx].superOver), format: formatOf(after.rules) }]);
  if (before.status !== "done" && after.status === "done") {
    const balls = after.innings.reduce((s, _, i) => s + E.replay(after, i).legal, 0);
    out.push([EV.match_end, { format: formatOf(after.rules), result: resultType(after), balls }]);
  }
  return out;
}
