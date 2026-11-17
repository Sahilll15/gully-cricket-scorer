import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import type { BallInput, Ev, Match, Rules, Team } from "./engine/types";
import { lostBallDebts, newBallDebt } from "./kitty";
import { biggestCollapse, deliveries, highestTotal, margin, mostRunsInOver, overs, records } from "./records";
import { fmtOf, leaders, profile } from "./stats";

const base: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const play = (m: Match, ...b: BallInput[]) => b.reduce(E.addBall, m);
const zeros = (n: number) => Array.from({ length: n }, (): BallInput => ({ runs: 0 }));
const out = (m: Match): Match => E.addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: E.afterWicket(m, m.innings.length - 1).fresh[0]?.id ?? null } });

function game(o: Partial<Rules>, first: BallInput[], chase: BallInput[], n = 4, wickets: [number, number] = [0, 0]): Match {
  let m = E.newMatch([team("A", n), team("B", n)], { ...base, ...o });
  m = E.startInnings(m, "A1", "A2", "B1");
  for (let i = 0; i < wickets[0]; i++) m = out(m);
  m = play(m, ...first);
  m = E.startInnings(m, "B1", "B2", "A1");
  for (let i = 0; i < wickets[1]; i++) m = out(m);
  return play(m, ...chase);
}

describe("stats and records with the gully formats", () => {
  it("counts runs doubled by a Joker over as the batter's, and in the over's record", () => {
    const m = game({ jokerOver: 1 }, [{ runs: 6 }, { runs: 6 }, ...zeros(4)], zeros(6));
    expect(m.status).toBe("done");
    expect(leaders([m], "limited").find((l) => l.name === "A1")!.runs).toBe(24);
    expect(mostRunsInOver([m])).toMatchObject({ value: 24, name: "B1" });
    expect(overs(m)[0].bat.get("A1")).toEqual({ runs: 24, sixes: 2 });
  });

  it("puts penalty runs in a team total, not on any batter", () => {
    let m = E.addPenalty(play(E.startInnings(E.newMatch([team("A"), team("B")], base), "A1", "A2", "B1"), { runs: 4 }), 0, 5, "Helmet");
    m = play(m, ...zeros(5));
    m = play(E.startInnings(m, "B1", "B2", "A1"), ...zeros(6));
    expect(highestTotal([m])).toMatchObject({ value: 9 });
    expect(leaders([m], "limited").find((l) => l.name === "A1")!.runs).toBe(4);
    expect(deliveries(m)[0].map((d) => d.total)).toEqual([4, 0, 0, 0, 0, 0]);
  });

  it("keeps a dismissal's cost out of the over's runs", () => {
    const m = game({ wicketPenalty: 5 }, [{ runs: 4 }, ...zeros(5)], zeros(5), 4, [0, 1]);
    expect(overs(m).find((o) => o.inn === 1)).toMatchObject({ runs: 0, wickets: 1 });
    expect(E.replay(m, 1).runs).toBe(-5);
    expect(margin(m)).toMatchObject({ kind: "runs", value: 9 });
  });

  it("treats pairs as limited overs, won by runs, with no collapse and batters who bat on counted as out", () => {
    const m = game({ format: "pairs", pairOvers: 1 }, [{ runs: 6 }, ...zeros(5)], zeros(6), 4, [2, 1]);
    expect(fmtOf(m)).toBe("limited");
    expect(m.status).toBe("done");
    expect(E.result(m)!.text).toBe("A won by 1 run");
    expect(margin(m)).toMatchObject({ kind: "runs", value: 1, winner: 0 });
    expect(biggestCollapse([m])).toBeNull();
    const p = profile([m], "A1", "limited");
    expect(p).toMatchObject({ innings: 1, notOuts: 0, runs: 6 });
    expect(records([m], "limited").lowestAllOut).toBeNull();
  });

  it("treats French cricket like solo: player records only", () => {
    const people = ["P", "Q"].map((id) => ({ id, name: id }));
    let m = E.startFrench(people);
    m = play(m, { runs: 4 }, { runs: 0, wicket: { kind: "caught", out: "s", newId: null, fielderId: "Q" } });
    m = E.stopMatch(m);
    expect(fmtOf(m)).toBe("limited");
    expect(leaders([m], "limited").find((l) => l.name === "P")!.runs).toBe(4);
    expect(profile([m], "P", "limited").recent[0].vs).toBe("Solo with 1 other");
    expect(records([m], "limited").highestTotal).toBeNull();
    expect(records([m], "limited").highestScore).toMatchObject({ value: 4, name: "P" });
  });

  it("reads overs in the match's own length", () => {
    const m = game({ ballsPerOver: 5, overs: 1 }, [{ runs: 6 }, ...zeros(4)], zeros(5));
    expect(highestTotal([m])!.text).toBe("6/0 (1.0 ov)");
    expect(deliveries(m)[0].map((d) => d.over)).toEqual([0, 0, 0, 0, 0]);
  });

  it("leaves a first innings carried in by startChase out of team records", () => {
    let m = E.startChase([team("A"), team("B")], base, 30, 2, 1);
    m = play(E.startInnings(m, "B1", "B2", "A1"), { runs: 6 }, ...zeros(5));
    expect(m.status).toBe("done");
    expect(highestTotal([m])).toMatchObject({ value: 6, name: "B" });
    expect(margin(m)).toMatchObject({ kind: "runs", value: 23 });
  });

  it("does not give a protected player's free dismissal to the bowler in a hat-trick or head to head", () => {
    let m = E.newMatch([team("A"), team("B")], { ...base, protectedPlayers: ["A1"] });
    m = E.startInnings(m, "A1", "A2", "B1");
    m = E.addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(deliveries(m)[0][0].outId).toBeNull();
    expect(overs(m)[0].wickets).toBe(0);
  });
});

describe("lost-ball ledger with lost events", () => {
  const ball = (runs: number, o: Partial<Extract<Ev, { t: "ball" }>> = {}): Ev => ({ t: "ball", runs, bowler: "b1", ...o });
  const lost = (striker: string | null): Ev => ({ t: "lost", reason: "Ball lost", striker, bowler: "b1" });
  const hitOut = ball(6, { wicket: { kind: "hit out", out: "s", newId: "a2", outId: "a1" } });
  const match = (events: Ev[]): Match => ({
    id: "m1", createdAt: 1, toss: null, status: "done",
    teams: [{ name: "Lane", players: [{ id: "a1", name: "Rahul" }, { id: "a2", name: "Amit" }] }, { name: "Gully", players: [{ id: "b1", name: "Vikas" }] }],
    rules: base,
    innings: [{ bat: 0, overs: 1, wicketLimit: 2, superOver: false, striker: "a1", nonStriker: "a2", bowler: "b1", bowlerSetAt: 0, closed: true, events }],
  });

  it("the striker owes a ball marked lost", () => {
    const [d, ...rest] = lostBallDebts(match([ball(1), lost("a2")]), [], 7);
    expect(rest).toEqual([]);
    expect(d).toMatchObject({ player: "Amit", innings: 0, ball: 1, createdAt: 7 });
  });

  it("a lost ball right after a hit out is the same ball, owed once", () => {
    const debts = lostBallDebts(match([hitOut, lost("a2")]));
    expect(debts.map((d) => [d.player, d.ball])).toEqual([["Rahul", 0]]);
  });

  it("a lost ball after another delivery is a new one", () => {
    const debts = lostBallDebts(match([hitOut, ball(0), lost("a2")]));
    expect(debts.map((d) => [d.player, d.ball])).toEqual([["Rahul", 0], ["Amit", 2]]);
  });

  it("skips a lost ball with no striker, and one the ledger already has", () => {
    expect(lostBallDebts(match([lost(null)]))).toEqual([]);
    expect(lostBallDebts(match([lost("a1")]), [newBallDebt("Rahul", "m1", 0, 0)])).toEqual([]);
  });
});
