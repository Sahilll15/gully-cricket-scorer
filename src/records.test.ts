import { describe, expect, it } from "vitest";
import { addBall, afterWicket, closeInnings, newMatch, startInnings, startSolo, startTurn, swapStrike } from "./engine/engine";
import type { BallInput, Match, Rules, Team, WicketKind } from "./engine/types";
import {
  bestPlayer, fairTeams, margin, hallOfShame, headToHead, milestones, overview, rating, ranking, ratingsFor, records, rivalry,
  playerStreaks, teamStreaks,
} from "./records";
import { leaders } from "./stats";

const DAY = 86_400_000;
const base: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const r = (runs: number): BallInput => ({ runs });
const zeros = (n: number) => Array.from({ length: n }, () => r(0));
const play = (m: Match, ...b: BallInput[]) => b.reduce(addBall, m);
const out = (m: Match, kind: WicketKind = "bowled"): Match =>
  addBall(m, { runs: 0, wicket: { kind, out: "s", newId: afterWicket(m, m.innings.length - 1).fresh[0]?.id ?? null } });
const outs = (m: Match, n: number) => Array.from({ length: n }).reduce<Match>((x) => out(x), m);

type Step = (m: Match) => Match;
/** Side 0 bats first: its 1 and 2 open, the other side's 1 bowls, and the reverse for the chase. */
function game(first: Step, chase: Step, o: { a?: string; b?: string; day?: number; size?: number; rules?: Partial<Rules> } = {}): Match {
  const a = o.a ?? "A", b = o.b ?? "B";
  let m = newMatch([team(a, o.size), team(b, o.size)], { ...base, ...o.rules });
  m = first(startInnings(m, `${a}1`, `${a}2`, `${b}1`));
  m = chase(startInnings(m, `${b}1`, `${b}2`, `${a}1`));
  return { ...m, createdAt: (o.day ?? 1) * DAY };
}
const balls = (...b: BallInput[]): Step => (m) => play(m, ...b);

describe("overview", () => {
  it("counts played and completed, totals only from completed matches", () => {
    const done = game(balls(r(6), r(4), r(1), ...zeros(3)), (m) => play(out(m), ...zeros(5)));
    let live = newMatch([team("A"), team("B")], base);
    live = { ...play(startInnings(live, "A1", "A2", "B1"), r(4)), createdAt: 2 * DAY };
    const setup = { ...newMatch([team("A"), team("B")], base), createdAt: 9 * DAY };
    const o = overview([done, live, setup], "limited");
    expect(o).toEqual({ played: 2, completed: 1, runs: 11, wickets: 1, sixes: 1, fours: 1, ducks: 1, first: DAY, last: 2 * DAY });
  });

  it("is empty with no matches", () => {
    expect(overview([], "test")).toEqual({ played: 0, completed: 0, runs: 0, wickets: 0, sixes: 0, fours: 0, ducks: 0, first: null, last: null });
  });
});

describe("records", () => {
  // A1 24* (6); A1 takes 3/0 and B are all out for 0.
  const m1 = game(balls(r(6), r(6), r(4), r(0), r(2), r(6)), (m) => outs(m, 3), { day: 1 });
  // A1 takes a single, then A2 26* (5) with 4 sixes: 27 off B1's over.
  const m2 = game(balls(r(1), r(6), r(6), r(6), r(6), r(2)), (m) => play(m, r(4), ...zeros(5)), { day: 2 });

  it("highest score, best bowling and most sixes point at the match and player", () => {
    const rec = records([m1, m2], "limited");
    expect(rec.highestScore).toMatchObject({ name: "A2", value: 26, text: "26* (5)", matchId: m2.id, date: 2 * DAY });
    expect(rec.bestBowling).toMatchObject({ name: "A1", value: 3, text: "3/0", matchId: m1.id });
    expect(rec.mostSixesInnings).toMatchObject({ name: "A2", value: 4, matchId: m2.id });
  });

  it("highest total and lowest all-out total", () => {
    const rec = records([m1, m2], "limited");
    expect(rec.highestTotal).toMatchObject({ name: "A", value: 27, text: "27/0 (1.0 ov)", matchId: m2.id });
    expect(rec.lowestAllOut).toMatchObject({ name: "B", value: 0, text: "0 all out (0.3 ov)", matchId: m1.id });
  });

  it("most runs in an over names the bowler and lists the balls", () => {
    expect(records([m1, m2], "limited").mostRunsInOver).toMatchObject({ name: "B1", value: 27, text: "27 off over 1: 1 6 6 6 6 2", matchId: m2.id });
  });

  // A make 10, B make 5: A won by 5 runs.
  const byFive = game(balls(r(4), r(4), r(2), ...zeros(3)), balls(r(1), r(1), r(1), r(1), r(1), r(0)), { day: 3 });
  // A make 6, B get 7 off the last ball.
  const lastBall = game(balls(r(6), ...zeros(5)), balls(...zeros(4), r(1), r(6)), { day: 4 });
  // A make 4, B win off the first ball.
  const quick = game(balls(r(4), ...zeros(5)), balls(r(6)), { day: 5 });
  const tie = game(balls(r(6), ...zeros(5)), balls(...zeros(5), r(6)), { day: 6 });

  it("closest finish: a tie, then a chase off the last ball, then the smallest margin", () => {
    expect(records([byFive, lastBall], "limited").closestFinish).toMatchObject({ name: "B", text: "B won by 3 wickets, off the last ball", matchId: lastBall.id });
    expect(records([byFive], "limited").closestFinish).toMatchObject({ name: "A", value: 6, matchId: byFive.id });
    expect(records([byFive, lastBall, tie], "limited").closestFinish).toMatchObject({ name: "A and B", value: 0, text: "Match tied", matchId: tie.id });
  });

  it("biggest win by runs and by wickets, more balls left breaking a wicket tie", () => {
    const rec = records([m1, byFive, lastBall, quick, tie], "limited");
    expect(rec.biggestWinRuns).toMatchObject({ name: "A", value: 24, text: "A won by 24 runs", matchId: m1.id });
    expect(rec.biggestWinWickets).toMatchObject({ name: "B", value: 3, text: "B won by 3 wickets, 5 balls left", matchId: quick.id });
  });

  it("biggest collapse: most wickets for fewest runs in 3 overs", () => {
    const oneWicket = game(balls(r(4), ...zeros(5)), (x) => play(out(x), ...zeros(5)));
    let c = newMatch([team("A", 6), team("B", 6)], { ...base, overs: 4 });
    c = play(startInnings(c, "A1", "A2", "B1"), r(4), r(4), r(4), r(4), r(4), r(4));
    c = play(out(c), r(0)); c = play(out(c), r(0), r(0), r(0));           // over 2: 2 wickets, 0 runs
    c = play(out(c), r(2), ...zeros(4));                                    // over 3: 1 wicket, 2 runs
    c = play(c, ...zeros(6));                                               // over 4: maiden
    c = play(startInnings(c, "B1", "B2", "A1"), r(6), r(6), r(6), r(6), r(6));
    expect(records([oneWicket], "limited").biggestCollapse).toBe(null);   // needs 2 wickets
    expect(records([c], "limited").biggestCollapse).toMatchObject({ name: "A", value: 3, text: "3 wickets for 2 runs, overs 2 to 4", matchId: c.id });
  });

  it("keeps Test and limited overs apart", () => {
    let t = newMatch([team("A"), team("B")], { ...base, format: "test" });
    t = closeInnings(play(startInnings(t, "A1", "A2", "B1"), ...Array.from({ length: 10 }, () => r(6))));
    t = outs(startInnings(t, "B1", "B2", "A1"), 3);
    t = { ...outs(startInnings(t, "B1", "B2", "A1", { followOn: true }), 3), createdAt: 7 * DAY };
    expect(t.status).toBe("done");
    const all = [m1, t];
    expect(records(all, "test").highestScore).toMatchObject({ name: "A1", value: 36, matchId: t.id });   // A2 hit the last 4
    expect(records(all, "test").biggestWinRuns).toMatchObject({ value: 60, text: "A won by an innings and 60 runs" });
    expect(records(all, "limited").highestScore?.matchId).toBe(m1.id);
    expect(overview(all, "test").completed).toBe(1);
  });

  it("are all null with no completed matches", () => {
    expect(Object.values(records([], "limited")).every((x) => x === null)).toBe(true);
  });
});

describe("milestones", () => {
  // A1: 34 in over 1 (5 sixes), A2 blocks a maiden, A1 back to 52. A1 then takes 5 in 5 balls.
  const big = game(
    balls(r(6), r(6), r(6), r(6), r(6), r(4), ...zeros(6), r(6), r(6), r(6), ...zeros(3)),
    (m) => outs(m, 5), { size: 6, rules: { overs: 3 }, day: 1 });
  // A1 hits 17 sixes for 102, A2 bowls the chase out.
  let ton = newMatch([team("A", 6), team("B", 6)], { ...base, overs: 3 });
  ton = startInnings(ton, "A1", "A2", "B1");
  ton = swapStrike(play(ton, ...Array.from({ length: 6 }, () => r(6))));
  ton = swapStrike(play(ton, ...Array.from({ length: 6 }, () => r(6))));
  ton = play(ton, ...Array.from({ length: 5 }, () => r(6)), r(0));
  ton = { ...outs(startInnings(ton, "B1", "B2", "A2"), 5), createdAt: 2 * DAY };

  const find = (ms: ReturnType<typeof milestones>, name: string, kind: string) => ms.find((p) => p.name === name)?.items.find((i) => i.kind === kind);

  it("batting: first 25, 50 and 100 with the match they came in", () => {
    const ms = milestones([ton, big], "limited");
    expect(find(ms, "A1", "25")).toMatchObject({ matchId: big.id, date: DAY, count: 2, label: "First 25" });
    expect(find(ms, "A1", "50")).toMatchObject({ matchId: big.id, count: 2 });
    expect(find(ms, "A1", "100")).toMatchObject({ matchId: ton.id, date: 2 * DAY, count: 1 });
  });

  it("over feats: 5 sixes and 30 runs in an over", () => {
    const ms = milestones([big, ton], "limited");
    expect(find(ms, "A1", "fiveSixesOver")).toMatchObject({ matchId: big.id, count: 4 });   // 1 in big, all 3 overs of the ton
    expect(find(ms, "A1", "thirtyOver")).toMatchObject({ matchId: big.id, count: 4 });
  });

  it("bowling: three and five wickets, hat-tricks and maidens", () => {
    const ms = milestones([big], "limited");
    expect(find(ms, "A1", "3w")).toMatchObject({ matchId: big.id, count: 1 });
    expect(find(ms, "A1", "5w")).toMatchObject({ matchId: big.id, count: 1 });
    expect(find(ms, "A1", "hatTrick")).toMatchObject({ count: 3 });   // 5 in 5 balls
    expect(find(ms, "B1", "maiden")).toMatchObject({ matchId: big.id, count: 1 });
    expect(find(ms, "B1", "hatTrick")).toBeUndefined();
  });

  it("a wide between wickets does not break a hat-trick, a dot ball does", () => {
    const first = balls(r(4), ...zeros(5));
    const wide = game(first, (m) => play(out(addBall(out(out(m)), { runs: 0, extra: "wd" })), ...zeros(3)), { size: 6 });
    expect(find(milestones([wide], "limited"), "A1", "hatTrick")).toMatchObject({ count: 1 });
    const dot = game(first, (m) => play(out(play(out(out(m)), r(0))), ...zeros(2)), { size: 6 });
    expect(find(milestones([dot], "limited"), "A1", "hatTrick")).toBeUndefined();
  });

  it("golden duck: out first ball faced", () => {
    const ms = milestones([big], "limited");
    expect(find(ms, "B1", "goldenDuck")).toMatchObject({ matchId: big.id });
    expect(find(ms, "B2", "goldenDuck")).toBeUndefined();
  });
});

describe("hall of shame", () => {
  // A1 run out first ball with A2 at the other end, then B1 bowls a wide, a no-ball and 17 more.
  const m1 = game(
    balls({ runs: 0, wicket: { kind: "run out", out: "s", outId: "A1", newId: "A3" } }, { runs: 0, extra: "wd" }, { runs: 0, extra: "nb" }, r(4), r(4), r(4), r(4), r(1)),
    (m) => play(out(m), ...zeros(5)), { day: 1 });
  // A1 bowled for 0 off 2 balls.
  const m2 = game((m) => play(out(play(m, r(0))), ...zeros(4)), balls(r(6)), { day: 2 });
  const hs = hallOfShame([m1, m2], "limited");

  it("ducks and golden ducks", () => {
    expect(hs.ducks[0]).toEqual({ name: "A1", value: 2 });
    expect(hs.goldenDucks).toEqual([{ name: "A1", value: 1 }, { name: "B1", value: 1 }]);
  });

  it("run outs suffered and caused by the partner who stayed in", () => {
    expect(hs.runOutsSuffered).toEqual([{ name: "A1", value: 1 }]);
    expect(hs.runOutsCaused).toEqual([{ name: "A2", value: 1 }]);
  });

  it("wides and no-balls, and each bowler's most expensive over", () => {
    expect(hs.extrasBowled).toEqual([{ name: "B1", value: 2 }]);
    expect(hs.expensiveOvers[0]).toEqual({ name: "B1", value: 19, text: "W Wd Nb 4 4 4 4 1", matchId: m1.id, date: DAY });
  });

  it("respects the limit", () => {
    expect(hallOfShame([m1, m2], "limited", 1).goldenDucks).toHaveLength(1);
  });
});

/** A1 bats first and bowls the chase. B1 opens the chase. */
const pad = (...b: BallInput[]) => balls(...b, ...zeros(6 - b.length));
const series = [
  game(pad(r(6), r(6)), (m) => play(out(m), ...zeros(5)), { day: 1 }),                // A1 12, A1 wicket, A win
  game(pad(r(6), r(6), r(2), r(1)), (m) => play(out(m), ...zeros(5)), { day: 2 }),    // A1 15, A1 wicket, A win
  game(pad(r(2), r(1)), (m) => play(out(m), r(4)), { day: 3 }),                       // A1 3, A1 wicket, B win
  game(pad(r(6), r(4)), balls(r(6), r(6)), { day: 4 }),                               // A1 10, no wicket, B win
];

describe("streaks", () => {
  it("players: matches in a row with 10 or more and with a wicket", () => {
    const a1 = playerStreaks(series, "limited").find((p) => p.name === "A1")!;
    expect(a1.tens).toEqual({ current: 1, best: 2 });
    expect(a1.wickets).toEqual({ current: 0, best: 3 });
  });

  it("a match where the player did not bat is skipped, not a break", () => {
    const b3 = playerStreaks(series, "limited").find((p) => p.name === "B3")!;
    expect(b3.tens).toEqual({ current: 0, best: 0 });   // batted in matches 1 to 3, never 10
  });

  it("saved teams: winning runs, current and best", () => {
    expect(teamStreaks(series, [{ name: "A" }, { name: "b" }, { name: "Nobody" }], "limited")).toEqual([
      { name: "A", current: 0, best: 2 }, { name: "b", current: 2, best: 2 }, { name: "Nobody", current: 0, best: 0 },
    ]);
  });
});

describe("head to head", () => {
  it("runs, balls, dismissals and strike rate both ways", () => {
    const h = headToHead(series, "a1", "B1", "limited");
    expect(h.aBatting).toEqual({ batter: "a1", bowler: "B1", runs: 40, balls: 18, dismissals: 0, strikeRate: (40 * 100) / 18 });
    expect(h.bBatting).toMatchObject({ batter: "B1", bowler: "a1", runs: 12, balls: 5, dismissals: 3, strikeRate: 240 });
  });

  it("a run out is not the bowler's dismissal", () => {
    const m = game(balls({ runs: 0, wicket: { kind: "run out", out: "s", outId: "A1", newId: "A3" } }, ...zeros(5)), balls(r(6)));
    expect(headToHead([m], "A1", "B1", "limited").aBatting).toMatchObject({ balls: 1, dismissals: 0 });
  });
});

describe("rivalry", () => {
  const other = game(balls(r(6), ...zeros(5)), balls(...zeros(6)), { b: "C", day: 9 });

  it("played, won by each, last 5 and biggest win each way", () => {
    const rv = rivalry([...series, other], "A", "B", "limited");
    expect([rv.played, rv.wonA, rv.wonB, rv.tied, rv.drawn]).toEqual([4, 2, 2, 0, 0]);
    expect(rv.last5.map((x) => x.winner)).toEqual(["B", "B", "A", "A"]);
    expect(rv.last5[0]).toMatchObject({ matchId: series[3].id, text: "B won by 3 wickets" });
    expect(rv.biggestA.byRuns).toMatchObject({ value: 15, matchId: series[1].id });
    expect(rv.biggestA.byWickets).toBe(null);
    expect(rv.biggestB.byWickets).toMatchObject({ value: 3, matchId: series[3].id });
  });

  it("is empty for teams that never met", () => {
    expect(rivalry(series, "A", "C", "limited").played).toBe(0);
  });
});

describe("rating", () => {
  it("is points per match: runs, 20 a wicket, 2 a six, 10 a fielding dismissal", () => {
    const a1 = leaders(series, "limited").find((l) => l.name === "A1")!;
    expect(rating(a1)).toBe((40 + 3 * 20 + 5 * 2) / 4);
    expect(rating({ ...a1, matches: 2, runs: 0, wickets: 0, sixes: 0, catches: 1, runOuts: 1, stumpings: 1 })).toBe(15);
  });

  it("ranks only players with enough matches", () => {
    expect(bestPlayer(series, "limited")).toMatchObject({ name: "A1", rating: 27.5, matches: 4 });
    expect(ranking(series, "limited", 3).map((x) => x.name)).toContain("B3");
    expect(ranking(series, "limited", 4).map((x) => x.name)).not.toContain("B3");
    expect(bestPlayer(series, "limited", 5)).toBe(null);
  });

  it("gives a new name the average of the known ones", () => {
    expect(ratingsFor(series, ["A1", "Zed"], "limited")).toEqual({ a1: 27.5, zed: 27.5 });
  });
});

describe("fair teams", () => {
  it("splits into equal sides with the closest total", () => {
    const s = fairTeams(["p1", "p2", "p3", "p4"], { p1: 10, p2: 9, p3: 8, p4: 1 });
    expect(s).toEqual({ a: ["p1", "p4"], b: ["p2", "p3"], common: null, ratingA: 11, ratingB: 17, diff: 6 });
  });

  it("is the same for the same input in any order, and reshuffles to a different fair split", () => {
    const names = ["Ravi", "Amit", "Sonu", "Monu", "Kabir", "Dev"], even = Object.fromEntries(names.map((n) => [n.toLowerCase(), 5]));
    const one = fairTeams(names, even, { seed: 0 });
    expect(fairTeams([...names].reverse(), even, { seed: 0 })).toEqual(one);
    const two = fairTeams(names, even, { seed: 1 });
    expect(two.a).not.toEqual(one.a);
    expect([one.diff, two.diff]).toEqual([0, 0]);
    expect([two.a.length, two.b.length]).toEqual([3, 3]);
  });

  it("puts the common player on both sides and keeps the rest equal", () => {
    const s = fairTeams(["a", "b", "c", "d", "e"], { a: 4, b: 3, c: 2, d: 1, e: 9 }, { common: "E" });
    expect(s.common).toBe("E");
    expect([s.a.length, s.b.length]).toEqual([2, 2]);
    expect(s.diff).toBe(0);
  });

  it("with an odd count and no common player, the lowest rated plays for both", () => {
    const s = fairTeams(["a", "b", "c"], { a: 4, b: 3, c: 2 });
    expect(s).toMatchObject({ common: "c", diff: 1 });
    expect([s.a.length, s.b.length]).toEqual([1, 1]);
  });

  it("drops blank and repeated names, and rates unknown names at the average", () => {
    const s = fairTeams(["Ravi", "ravi ", " ", "Amit", "New"], { ravi: 10, amit: 2 });
    expect([...s.a, ...s.b, s.common].sort()).toEqual(["Amit", "New", "Ravi"]);
    expect(s.common).toBe("Amit");
  });

  it("handles big groups without trying every split", () => {
    const names = Array.from({ length: 24 }, (_, i) => `p${i + 1}`);
    const s = fairTeams(names, Object.fromEntries(names.map((n, i) => [n, i + 1])));
    expect([s.a.length, s.b.length]).toEqual([12, 12]);
    expect(s.diff).toBe(0);
  });
});

describe("solo matches", () => {
  // Aarav makes 16 off 4 and is bowled by Bilal; Bilal is out first ball to Aarav.
  let s = startSolo([{ id: "Aarav", name: "Aarav" }, { id: "Bilal", name: "Bilal" }], { ballsPerTurn: 6 });
  s = play(s, r(6), r(6), r(4), { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
  s = startTurn(s);
  s = { ...play(s, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } }), createdAt: DAY };

  it("is a finished solo match", () => {
    expect(s.status).toBe("done");
    expect(s.innings).toHaveLength(2);
  });

  it("is left out of team totals, margins, rivalry and team streaks", () => {
    const rec = records([s], "limited");
    expect([rec.highestTotal, rec.lowestAllOut, rec.closestFinish, rec.biggestWinRuns, rec.biggestWinWickets, rec.biggestCollapse])
      .toEqual([null, null, null, null, null, null]);
    expect(margin(s)).toBe(null);
    const [t0, t1] = s.teams.map((t) => t.name);
    expect(rivalry([s], t0, t1, "limited").played).toBe(0);
    expect(teamStreaks([s], [{ name: t0 }, { name: t1 }], "limited").map((t) => t.best)).toEqual([0, 0]);
  });

  it("still counts each turn for individual records", () => {
    const rec = records([s], "limited");
    expect(rec.highestScore).toMatchObject({ name: "Aarav", value: 16, text: "16 (4)", matchId: s.id });
    expect(rec.bestBowling).toMatchObject({ name: "Aarav", text: "1/0" });
    expect(rec.mostRunsInOver).toMatchObject({ name: "Bilal", value: 16 });
    const golden = milestones([s], "limited").find((p) => p.name === "Bilal")?.items.find((i) => i.kind === "goldenDuck");
    expect(golden).toMatchObject({ matchId: s.id });
    expect(hallOfShame([s], "limited").ducks).toEqual([{ name: "Bilal", value: 1 }]);
    expect(headToHead([s], "Aarav", "Bilal", "limited").aBatting).toMatchObject({ runs: 16, balls: 4, dismissals: 1 });
    expect(playerStreaks([s], "limited").find((p) => p.name === "Aarav")!.tens).toEqual({ current: 1, best: 1 });
    expect(ranking([s], "limited", 1).map((x) => x.name)).toEqual(["Aarav", "Bilal"]);
  });
});
