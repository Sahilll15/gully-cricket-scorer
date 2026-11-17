import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import type { BallInput, Match, Rules, Team } from "./engine/types";
import { manhattan, partnerships, runRates, worm } from "./charts";
import { matchAwards, mvp } from "./mvp";
import { poster } from "./poster";
import { scoresheetHtml } from "./scoresheet";
import { summaryText } from "./share";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null, ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const cur = (m: Match) => m.innings.length - 1;
function bowl(m: Match, b: BallInput): Match {
  if (E.needsBowler(m, cur(m))) m = E.setBowler(m, E.bowlerOptions(m).find((o) => !o.blocked)!.id);
  return E.addBall(m, b);
}
const play = (m: Match, balls: number[]) => balls.map((runs) => ({ runs })).reduce(bowl, m);
function setup(o: Partial<Rules>, n = 4): Match {
  const m = E.newMatch([team("A", n), team("B", n)], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return E.startInnings(m, "A1", "A2", "B1");
}
/** Everything a scorecard, chart or poster reads, so a new format can't break them quietly. */
function readsCleanly(m: Match) {
  for (const l of worm(m)) expect(l.points[l.points.length - 1].y).toBe(E.replay(m, l.idx).runs);
  m.innings.forEach((_, i) => {
    expect(manhattan(m, i).reduce((n, b) => n + b.runs, 0)).toBe(E.replay(m, i).runs - E.replay({ ...m, innings: [...m.innings.slice(0, i), { ...m.innings[i], events: [] }] }, i).runs);
    partnerships(m, i);
  });
  runRates(m); mvp(m); matchAwards(m); poster(m);
  expect(scoresheetHtml(m)).toContain("<section>");
  expect(summaryText(m)).toContain("Scored with");
}

describe("charts, MVP, posters and sharing across formats", () => {
  it("handle 8-ball overs", () => {
    const m = play(setup({ ballsPerOver: 8 }), [1, 2, 4, 0, 0, 6, 1, 1, 2]);
    expect(worm(m)[0].points.map((p) => p.x)).toEqual([0, 1, 1 + 1 / 8]);
    expect(manhattan(m, 0).map((b) => b.runs)).toEqual([15, 2]);
    readsCleanly(m);
  });

  it("count penalty runs in the worm and the scoresheet", () => {
    const m = E.addPenalty(play(setup({}), [1, 1]), 0, 5, "Ball in the neighbour's yard");
    expect(worm(m)[0].points.slice(-1)[0].y).toBe(7);
    expect(scoresheetHtml(m)).toContain("penalty runs 5");
    readsCleanly(m);
  });

  it("handle pairs, where a dismissal costs runs", () => {
    let m = setup({ format: "pairs", overs: 2, pairOvers: 1 }, 4);
    m = play(m, [4, 1]);
    m = bowl(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    m = play(m, [2, 0, 0, 6]);
    expect(E.replay(m, 0).deducted).toBeGreaterThan(0);
    readsCleanly(m);
  });

  it("handle French cricket, labelled by the batter", () => {
    const people = ["Asha", "Bunty", "Chiku"].map((n) => ({ id: n, name: n }));
    let m = [1, 2, 1].reduce((x, runs) => E.addBall(x, { runs }), E.startFrench(people));
    m = E.addBall(m, { runs: 0, wicket: { kind: "caught", out: "s", newId: null, fielderId: "Chiku" } });
    expect(worm(m)[0].label).toBe("Asha");
    expect(summaryText(m)).toContain("*Asha 4/1");
    expect(poster(m).solo).toBe(true);
    expect(mvp(m).find((r) => r.id === "Chiku")?.catches).toBe(1);
    readsCleanly(m);
  });
});
