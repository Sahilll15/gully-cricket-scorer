import { describe, expect, it } from "vitest";
import { addBall, newMatch, startInnings } from "./engine";
import { champion, leagueDone, newTournament, roundRobin, standings, withFinal, type Tournament } from "./tournament";
import type { BallInput, Match, Rules, Team } from "./types";

const rules: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string): Team => ({ name: p, players: [1, 2, 3].map((i) => ({ id: `${p}${i}`, name: `${p}${i}` })) });
const play = (m: Match, ...b: BallInput[]) => b.reduce(addBall, m);
const r = (runs: number): BallInput => ({ runs });
const out: BallInput = { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } };

/** Side 0 bats first and makes `first`, side 1 replies with `second` (six legal balls each unless all out). */
function game(a: string, b: string, first: BallInput[], second: BallInput[]): Match {
  let m = newMatch([team(a), team(b)], rules);
  m = startInnings(m, `${a}1`, `${a}2`, `${b}1`);
  m = play(m, ...first);
  m = startInnings(m, `${b}1`, `${b}2`, `${a}1`);
  return play(m, ...second);
}

describe("fixtures", () => {
  it.each([2, 3, 4, 5, 6])("%i teams: every pair meets once", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const fx = roundRobin(ids);
    expect(fx.length).toBe((n * (n - 1)) / 2);
    const pairs = new Set(fx.map((f) => [f.a, f.b].sort().join("-")));
    expect(pairs.size).toBe(fx.length);
    for (const f of fx) expect(f.a).not.toBe(f.b);
  });

  it("no team plays twice in one round", () => {
    const fx = roundRobin(["a", "b", "c", "d", "e", "f"]);
    for (const round of new Set(fx.map((f) => f.round))) {
      const ids = fx.filter((f) => f.round === round).flatMap((f) => [f.a, f.b]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("points table", () => {
  function setup(): { t: Tournament; matches: Match[] } {
    const t = newTournament("Cup", ["A", "B", "C"], rules, "league-final");
    const matches: Match[] = [];
    for (const f of t.fixtures) {
      // A beats everyone, B beats C. Winner bats first and makes 12, loser makes 6.
      const order = ["A", "B", "C"];
      const aWins = order.indexOf(f.a) < order.indexOf(f.b);
      const m = aWins
        ? game(f.a, f.b, [r(2), r(2), r(2), r(2), r(2), r(2)], [r(1), r(1), r(1), r(1), r(1), r(1)])
        : game(f.a, f.b, [r(1), r(1), r(1), r(1), r(1), r(1)], [r(4), r(4)]);
      f.matchId = m.id;
      matches.push(m);
    }
    return { t, matches };
  }

  it("ranks by points and computes net run rate", () => {
    const { t, matches } = setup();
    const s = standings(t, matches);
    expect(s.map((x) => x.teamId)).toEqual(["A", "B", "C"]);
    expect(s[0]).toMatchObject({ p: 2, w: 2, l: 0, pts: 4 });
    expect(s[2]).toMatchObject({ p: 2, w: 0, l: 2, pts: 0 });
    for (const x of s) expect(x.ballsFaced).toBeGreaterThan(0);
    expect(s[0].nrr).toBeGreaterThan(0);
    expect(s[2].nrr).toBeLessThan(0);
    expect(s.reduce((sum, x) => sum + x.runsFor, 0)).toBe(s.reduce((sum, x) => sum + x.runsAgainst, 0));
  });

  it("all out counts the full quota of overs for NRR", () => {
    const t = newTournament("Cup", ["A", "B"], rules, "league");
    const m = game("A", "B", [r(6), out, out], [r(1), r(1), r(0), r(0), r(0), r(0)]);
    t.fixtures[0].a = "A"; t.fixtures[0].b = "B"; t.fixtures[0].matchId = m.id;
    const a = standings(t, [m]).find((x) => x.teamId === "A")!;
    expect(a.ballsFaced).toBe(6);
    expect(a.runsFor).toBe(6);
  });

  it("adds a final between the top two, then crowns the winner", () => {
    const { t, matches } = setup();
    expect(leagueDone(t, matches)).toBe(true);
    const t2 = withFinal(t, matches);
    const fin = t2.fixtures.find((f) => f.stage === "final")!;
    expect([fin.a, fin.b]).toEqual(["A", "B"]);
    expect(withFinal(t2, matches)).toBe(t2);
    expect(champion(t2, matches)).toBe(null);
    const m = game("A", "B", [r(1)].concat(Array(5).fill(r(0))), [r(4)]);
    fin.matchId = m.id;
    expect(champion(t2, [...matches, m])).toBe("B");
  });

  it("league format crowns the table topper", () => {
    const { t, matches } = setup();
    expect(champion({ ...t, format: "league" }, matches)).toBe("A");
  });
});
