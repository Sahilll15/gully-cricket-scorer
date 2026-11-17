import { describe, expect, it } from "vitest";
import * as E from "./engine";
import type { Match } from "./types";
import { leaders, profile } from "../stats";
import { hallOfShame, milestones, overview, records } from "../records";
import raw from "./__fixtures__/old-matches.json?raw";

/** What a scorecard shows, read only from fields that existed before the gully formats. */
function summary(m: Match) {
  return {
    status: m.status,
    format: E.formatText(m),
    rules: E.rulesCard(m),
    result: E.result(m),
    awards: E.awards(m),
    innings: m.innings.map((_, i) => {
      const st = E.replay(m, i);
      return {
        label: E.inningsLabel(m, i), score: E.inningsScore(m, i), runs: st.runs, wickets: st.wickets, legal: st.legal,
        overs: E.oversText(st.legal), extras: st.extras, striker: st.striker, nonStriker: st.nonStriker, allOut: st.allOut,
        ended: st.ended, freeHit: st.freeHit, fow: st.fow, order: st.order, bowlOrder: st.bowlOrder, lastOverBowler: st.lastOverBowler,
        bat: st.order.map((id) => {
          const b = st.bat.get(id)!;
          return { id, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, out: b.out, how: E.howOut(m, b) };
        }),
        bowl: st.bowlOrder.map((id) => st.bowl.get(id)),
        feed: E.ballByBall(m, i).map((o) => o.map((f) => f.label)),
        target: E.target(m, i),
      };
    }),
  };
}

// The fixture was written by the engine before the gully formats existed: saved matches and what they showed.
const fixture = JSON.parse(raw) as { matches: Match[]; summaries: unknown[]; book: unknown };
const matches = fixture.matches;
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("matches saved before the gully formats", () => {
  it("replay exactly as they did", () => {
    matches.forEach((m, i) => expect(plain(summary(m))).toEqual(fixture.summaries[i]));
  });

  it("give the same stats and records", () => {
    expect(plain({
      leaders: leaders(matches, "limited"), testLeaders: leaders(matches, "test"), profile: profile(matches, "A1", "limited"),
      records: records(matches, "limited"), milestones: milestones(matches, "limited"), shame: hallOfShame(matches, "limited"),
      overview: overview(matches, "limited"),
    })).toEqual(fixture.book);
  });

  it("read tipAndRun as must run on touch", () => {
    const m = matches[0];
    expect(m.rules.tipAndRun).toBe(true);
    expect(E.mustRunMode(m.rules)).toBe("touch");
    expect(E.mustRunPrompt(m.rules, { runs: 0, touched: true })).toBe(true);
    expect(E.mustRunPrompt(m.rules, { runs: 0 })).toBe(false);
    expect(E.wicketKinds(m.rules, null, false)).toContain("didn't run");
  });

  it("undo and redo every event of an old match back to the same card", () => {
    const m = matches[0];
    let x = m;
    const popped = [];
    for (let k = 0; k < 4; k++) { const u = E.undo(x); x = u.match; if (u.popped) popped.unshift(u.popped); }
    for (const ev of popped) x = E.redo(x, ev);
    expect(plain(summary(x))).toEqual(plain(summary(m)));
  });
});
