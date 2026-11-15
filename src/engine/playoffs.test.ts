import { describe, expect, it } from "vitest";
import { addBall, newMatch, startInnings } from "./engine";
import { advance, champion, fixtureCount, newTournament, stageLabel, withFinal, type Fixture, type Tournament } from "./tournament";
import type { BallInput, Match, Rules, Team } from "./types";

const rules: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string): Team => ({ name: p, players: [1, 2, 3].map((i) => ({ id: `${p}${i}`, name: `${p}${i}` })) });
const play = (m: Match, ...b: BallInput[]) => b.reduce(addBall, m);
const r = (runs: number): BallInput => ({ runs });

/** Side 0 is f.a and bats first. `winner` takes the match. */
function decide(f: Fixture, winner: string): Match {
  let m = newMatch([team(f.a), team(f.b)], rules);
  m = startInnings(m, `${f.a}1`, `${f.a}2`, `${f.b}1`);
  m = play(m, ...(winner === f.a ? Array(6).fill(r(2)) : Array(6).fill(r(1))));
  m = startInnings(m, `${f.b}1`, `${f.b}2`, `${f.a}1`);
  return play(m, ...(winner === f.a ? Array(6).fill(r(1)) : [r(4), r(4)]));
}
function tie(f: Fixture): Match {
  let m = newMatch([team(f.a), team(f.b)], rules);
  m = startInnings(m, `${f.a}1`, `${f.a}2`, `${f.b}1`);
  m = play(m, ...Array(6).fill(r(1)));
  m = startInnings(m, `${f.b}1`, `${f.b}2`, `${f.a}1`);
  return play(m, ...Array(6).fill(r(1)));
}

/** Plays every open fixture. `pick` names the winner; by default the earlier team in `rank` wins. */
function playOpen(t: Tournament, matches: Match[], rank: string[], pick?: (f: Fixture) => string | null) {
  for (const f of t.fixtures.filter((x) => !x.matchId)) {
    const w = pick ? pick(f) : rank.indexOf(f.a) < rank.indexOf(f.b) ? f.a : f.b;
    const m = w ? decide(f, w) : tie(f);
    f.matchId = m.id;
    matches.push(m);
  }
}
const pair = (f: Fixture | undefined) => f && [f.a, f.b];
const stage = (t: Tournament, s: Fixture["stage"]) => t.fixtures.filter((f) => f.stage === s);

describe("playoff formats", () => {
  const rank = ["A", "B", "C", "D", "E"];

  it("IPL style: Qualifier 1, Eliminator, Qualifier 2, Final", () => {
    let t = newTournament("Cup", rank, rules, "ipl");
    const matches: Match[] = [];
    playOpen(t, matches, rank);
    t = advance(t, matches);
    expect(pair(stage(t, "q1")[0])).toEqual(["A", "B"]);
    expect(pair(stage(t, "elim")[0])).toEqual(["C", "D"]);
    expect(stage(t, "q2")).toHaveLength(0);
    // B loses Q1, D beats C in the Eliminator, then D beats B in Q2.
    playOpen(t, matches, rank, (f) => (f.stage === "elim" ? "D" : f.a));
    t = advance(t, matches);
    expect(pair(stage(t, "q2")[0])).toEqual(["B", "D"]);
    expect(stage(t, "final")).toHaveLength(0);
    playOpen(t, matches, rank, () => "D");
    t = advance(t, matches);
    expect(pair(stage(t, "final")[0])).toEqual(["A", "D"]);
    expect(champion(t, matches)).toBe(null);
    playOpen(t, matches, rank, () => "D");
    expect(champion(advance(t, matches), matches)).toBe("D");
    expect(stageLabel(t, stage(t, "elim")[0])).toBe("Eliminator");
  });

  it("semi-finals: 1 v 4 and 2 v 3, then the final", () => {
    let t = newTournament("Cup", rank, rules, "semis");
    const matches: Match[] = [];
    playOpen(t, matches, rank);
    t = advance(t, matches);
    expect(stage(t, "semi").map(pair)).toEqual([["A", "D"], ["B", "C"]]);
    playOpen(t, matches, rank, (f) => f.b);
    t = advance(t, matches);
    expect(pair(stage(t, "final")[0])).toEqual(["D", "C"]);
    playOpen(t, matches, rank, () => "C");
    expect(champion(t, matches)).toBe("C");
  });

  it("top 2 straight to the final stays the old behaviour", () => {
    let t = newTournament("Cup", rank, rules, "league-final");
    const matches: Match[] = [];
    playOpen(t, matches, rank);
    t = advance(t, matches);
    expect(t.fixtures.filter((f) => f.stage !== "league").map(pair)).toEqual([["A", "B"]]);
    expect(withFinal).toBe(advance);
  });

  it("IPL and semis with only 3 teams fall back to a top-2 final", () => {
    for (const format of ["ipl", "semis"] as const) {
      let t = newTournament("Cup", ["A", "B", "C"], rules, format);
      const matches: Match[] = [];
      playOpen(t, matches, rank);
      t = advance(t, matches);
      expect(t.fixtures.filter((f) => f.stage !== "league").map((f) => [f.stage, f.a, f.b])).toEqual([["final", "A", "B"]]);
    }
  });

  it("a tied playoff sends the team higher in the table through", () => {
    let t = newTournament("Cup", rank, rules, "semis");
    const matches: Match[] = [];
    playOpen(t, matches, rank);
    t = advance(t, matches);
    playOpen(t, matches, rank, () => null);
    t = advance(t, matches);
    expect(pair(stage(t, "final")[0])).toEqual(["A", "B"]);
  });

  it("advance does nothing until the league is over, and is stable", () => {
    const t = newTournament("Cup", rank, rules, "ipl");
    expect(advance(t, [])).toBe(t);
    const matches: Match[] = [];
    playOpen(t, matches, rank);
    const t2 = advance(t, matches);
    expect(advance(t2, matches)).toBe(t2);
  });
});

describe("knockout", () => {
  it("4 teams: two semis, then a final, no league", () => {
    let t = newTournament("KO", ["A", "B", "C", "D"], rules, "knockout");
    expect(t.fixtures.map((f) => [f.stage, f.a, f.b])).toEqual([["ko", "A", "D"], ["ko", "B", "C"]]);
    expect(stageLabel(t, t.fixtures[0])).toBe("Semi-final");
    const matches: Match[] = [];
    playOpen(t, matches, [], (f) => f.b);
    t = advance(t, matches);
    expect(pair(stage(t, "final")[0])).toEqual(["C", "D"]);
    playOpen(t, matches, [], (f) => f.a);
    expect(champion(t, matches)).toBe("C");
  });

  it("5 teams: top 3 seeds get a bye, 4 v 5 plays first", () => {
    let t = newTournament("KO", ["A", "B", "C", "D", "E"], rules, "knockout");
    expect(t.fixtures.map(pair)).toEqual([["D", "E"]]);
    const matches: Match[] = [];
    playOpen(t, matches, [], () => "E");
    t = advance(t, matches);
    expect(t.fixtures.filter((f) => f.round === 2).map(pair)).toEqual([["A", "E"], ["B", "C"]]);
    playOpen(t, matches, [], (f) => f.a);
    t = advance(t, matches);
    expect(pair(stage(t, "final")[0])).toEqual(["A", "B"]);
    playOpen(t, matches, [], (f) => f.b);
    expect(champion(t, matches)).toBe("B");
  });

  it("2 teams: the only match is the final", () => {
    const t = newTournament("KO", ["A", "B"], rules, "knockout");
    expect(t.fixtures.map((f) => [f.stage, f.a, f.b])).toEqual([["final", "A", "B"]]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("%i teams: n - 1 matches in all, one champion", (n) => {
    const ids = "ABCDEFGH".slice(0, n).split("");
    let t = newTournament("KO", ids, rules, "knockout");
    const matches: Match[] = [];
    for (let i = 0; i < 6 && !champion(t, matches); i++) { playOpen(t, matches, ids); t = advance(t, matches); }
    expect(t.fixtures).toHaveLength(n - 1);
    expect(fixtureCount("knockout", n)).toBe(n - 1);
    expect(champion(t, matches)).toBe("A");
  });
});

describe("fixture counts", () => {
  it("league plus each playoff format", () => {
    expect(fixtureCount("league", 4)).toBe(6);
    expect(fixtureCount("league-final", 4)).toBe(7);
    expect(fixtureCount("semis", 4)).toBe(9);
    expect(fixtureCount("ipl", 4)).toBe(10);
    expect(fixtureCount("ipl", 3)).toBe(4);
  });
});

describe("tournaments saved before playoffs", () => {
  it("an old league-final cup with its final already played loads the same", () => {
    // Saved by the old app: no playoff stages, final added by the old withFinal.
    const old: Tournament = JSON.parse(JSON.stringify(newTournament("Old", ["A", "B", "C"], rules, "league-final")));
    const matches: Match[] = [];
    playOpen(old, matches, ["A", "B", "C"]);
    old.fixtures.push({ id: "fin", a: "A", b: "B", round: 4, stage: "final", matchId: null });
    expect(advance(old, matches)).toBe(old);
    playOpen(old, matches, [], () => "B");
    expect(advance(old, matches)).toBe(old);
    expect(champion(old, matches)).toBe("B");
    expect(stageLabel(old, old.fixtures[3])).toBe("Final");
  });
});
