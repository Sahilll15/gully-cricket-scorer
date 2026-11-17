import { describe, expect, it } from "vitest";
import {
  addBall, afterWicket, awards, canBowl, currentBatter, formatText, howOut, inningsLabel, isCommon, livesLeft, needsBowler, nextBatter,
  replay, result, setBowler, soloRound, soloStandings, startInnings, startSolo, startTurn, suggestedBowler, target, turnBallsLeft, undo,
  upcomingBatters, yetToBat,
} from "./engine";
import type { BallInput, Match, Rules } from "./types";

const players = (...names: string[]) => names.map((n) => ({ id: n, name: n }));
const r = (runs: number): BallInput => ({ runs });
const out: BallInput = { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } };
const cur = (m: Match) => m.innings.length - 1;

/** Bowls one ball, picking the suggested bowler first when an over has just ended. */
function bowl(m: Match, b: BallInput): Match {
  if (needsBowler(m, cur(m))) m = setBowler(m, suggestedBowler(m)!);
  return addBall(m, b);
}
const play = (m: Match, ...balls: BallInput[]) => balls.reduce(bowl, m);
const dots = (m: Match, n: number) => play(m, ...Array.from({ length: n }, () => r(0)));
const solo = (names: string[], o: Partial<Rules> = {}, bowler?: string) => startSolo(players(...names), o, bowler);

describe("solo match setup", () => {
  it("puts everyone on both teams, so existing code sees common players", () => {
    const m = solo(["Aarav", "Bilal", "Chetan"]);
    expect(m.rules.format).toBe("solo");
    expect(m.teams[0].players.map((p) => p.id)).toEqual(["Aarav", "Bilal", "Chetan"]);
    expect(m.teams[1].players.map((p) => p.id)).toEqual(["Aarav", "Bilal", "Chetan"]);
    expect(isCommon(m, "Bilal")).toBe(true);
    expect(m.status).toBe("live");
    expect(currentBatter(m)).toBe("Aarav");
    expect(m.innings[0].bowler).toBe("Bilal");
    expect(m.innings[0].nonStriker).toBeNull();
  });

  it("uses one life, 12 balls and one round by default", () => {
    const m = solo(["A", "B"]);
    expect(livesLeft(m)).toBe(1);
    expect(turnBallsLeft(m)).toBe(12);
    expect(formatText(m)).toBe("Solo, 12 balls a turn");
    expect(formatText(solo(["A", "B"], { ballsPerTurn: null, lives: 2, rounds: 3 }))).toBe("Solo, no ball limit, 2 lives, 3 rounds");
  });

  it("needs two players and a bowler who isn't batting", () => {
    expect(() => startSolo(players("A"))).toThrow();
    const m = solo(["A", "B"], {}, "A");
    expect(m.status).toBe("setup");
    expect(m.innings).toHaveLength(0);
  });

  it("takes the first bowler from the scorer", () => {
    expect(solo(["A", "B", "C"], {}, "C").innings[0].bowler).toBe("C");
  });
});

describe("two players", () => {
  it("alternate turns and bowl to each other", () => {
    let m = solo(["Aarav", "Bilal"], { ballsPerTurn: 6, rounds: 2 });
    expect(nextBatter(m)).toBe("Bilal");
    m = play(m, r(1), r(1), r(1), r(1), r(1), r(1));
    expect(m.status).toBe("break");
    expect(currentBatter(m)).toBeNull();
    expect(nextBatter(m)).toBe("Bilal");
    expect(suggestedBowler(m)).toBe("Aarav");
    expect(startTurn(m, "Bilal")).toBe(m);

    m = startTurn(m);
    expect([currentBatter(m), m.innings[1].bowler]).toEqual(["Bilal", "Aarav"]);
    m = play(m, out);
    m = play(startTurn(m), r(4), out);
    expect(soloRound(m)).toBe(2);
    m = play(startTurn(m), r(2), out);
    expect(m.status).toBe("done");
    expect(m.innings.map((i) => [i.striker, i.bowler])).toEqual([["Aarav", "Bilal"], ["Bilal", "Aarav"], ["Aarav", "Bilal"], ["Bilal", "Aarav"]]);
    expect(nextBatter(m)).toBeNull();
  });

  it("lets the only other player bowl over after over", () => {
    let m = dots(solo(["A", "B"]), 6);
    expect(needsBowler(m, 0)).toBe(true);
    expect(canBowl(m, 0, "B")).toBe(true);
    expect(canBowl(m, 0, "A")).toBe(false);
    expect(suggestedBowler(m)).toBe("B");
    m = dots(m, 6);
    expect(m.status).toBe("break");
    expect(replay(m, 0).bowl.get("B")!.legal).toBe(12);
  });
});

describe("five players", () => {
  const five = ["P1", "P2", "P3", "P4", "P5"];

  it("bat in order, one turn each, then the match is done", () => {
    let m = solo(five);
    expect(upcomingBatters(m)).toEqual(["P2", "P3", "P4", "P5"]);
    const batted: string[] = [];
    while (m.status !== "done") {
      if (m.status === "break") m = startTurn(m);
      batted.push(currentBatter(m)!);
      m = play(m, r(1), out);
    }
    expect(batted).toEqual(five);
    expect(soloStandings(m).map((x) => x.turns)).toEqual([1, 1, 1, 1, 1]);
  });

  it("rotate the bowling each over, never to the batter", () => {
    let m = solo(five);
    expect(m.innings[0].bowler).toBe("P2");
    m = dots(m, 6);
    expect(needsBowler(m, 0)).toBe(true);
    expect(canBowl(m, 0, "P2")).toBe(false);
    expect(canBowl(m, 0, "P1")).toBe(false);
    expect(suggestedBowler(m)).toBe("P3");
    m = dots(m, 6);
    expect(m.status).toBe("break");
    expect(nextBatter(m)).toBe("P2");
    expect(suggestedBowler(m)).toBe("P4");
    m = play(startTurn(m), out);
    expect(m.innings[1].bowler).toBe("P4");
    expect(suggestedBowler(m)).toBe("P5");
    m = play(startTurn(m), out);
    expect(suggestedBowler(m)).toBe("P1");
  });

  it("skips the batter when the rotation lands on them", () => {
    let m = solo(five, {}, "P5");
    m = dots(m, 6);
    expect(suggestedBowler(m)).toBe("P2");
  });

  it("never changes strike on odd runs or at the end of an over", () => {
    const m = play(solo(five), r(1), r(3), r(1), r(1), r(1), r(1), r(1));
    const st = replay(m, 0);
    expect(st.striker).toBe("P1");
    expect(st.nonStriker).toBeNull();
    expect(st.bat.get("P1")!.runs).toBe(9);
    expect(st.bat.size).toBe(1);
  });
});

describe("ball cap", () => {
  it("ends the turn after 12 legal balls", () => {
    let m = dots(solo(["A", "B", "C"]), 11);
    expect(m.status).toBe("live");
    expect(turnBallsLeft(m)).toBe(1);
    m = play(m, r(4));
    expect(m.status).toBe("break");
    expect(turnBallsLeft(m)).toBe(12);
    expect(nextBatter(m)).toBe("B");
  });

  it("can be any number of balls", () => {
    const m = dots(solo(["A", "B"], { ballsPerTurn: 5 }), 5);
    expect(m.status).toBe("break");
    expect(replay(m, 0).legal).toBe(5);
  });

  it("has no cap when set to null: only outs end the turn", () => {
    let m = dots(solo(["A", "B", "C"], { ballsPerTurn: null }), 40);
    expect(m.status).toBe("live");
    expect(turnBallsLeft(m)).toBeNull();
    m = play(m, out);
    expect(m.status).toBe("break");
  });

  it("does not count wides and no-balls, which are bowled again", () => {
    let m = solo(["A", "B"], { ballsPerTurn: 6 });
    m = play(m, { runs: 0, extra: "wd" }, { runs: 4, extra: "nb" }, { runs: 1, extra: "wd" });
    expect(turnBallsLeft(m)).toBe(6);
    m = play(m, { runs: 2, extra: "b" });
    expect(turnBallsLeft(m)).toBe(5);
    m = dots(m, 5);
    expect(m.status).toBe("break");
    const row = soloStandings(m).find((x) => x.id === "A")!;
    expect(row.runs).toBe(1 + 5 + 2 + 2);   // wide, no-ball and 4, two wides run, two byes
    expect(row.balls).toBe(7);             // the no-ball is faced, wides are not
  });

  it("counts a wide as a ball when wides are not bowled again", () => {
    const m = play(solo(["A", "B"], { ballsPerTurn: 6, rebowl: false }), { runs: 0, extra: "wd" });
    expect(turnBallsLeft(m)).toBe(5);
  });
});

describe("lives", () => {
  it("keeps the batter in until the last life is gone", () => {
    let m = solo(["A", "B", "C"], { lives: 2 });
    m = play(m, r(4), out);
    expect(m.status).toBe("live");
    expect(currentBatter(m)).toBe("A");
    expect(livesLeft(m)).toBe(1);
    expect(howOut(m, replay(m, 0).bat.get("A")!)).toBe("not out");
    m = play(m, r(2), out);
    expect(m.status).toBe("break");
    expect(livesLeft(m)).toBe(2);
    expect(howOut(m, replay(m, 0).bat.get("A")!)).toBe("b B");
    expect(soloStandings(m).find((x) => x.id === "A")).toMatchObject({ runs: 6, outs: 2, balls: 4 });
    expect(replay(m, 0).bowl.get("B")!.wickets).toBe(2);
  });

  it("a batter who still has a life when the balls run out is not out", () => {
    let m = solo(["A", "B"], { lives: 2, ballsPerTurn: 6 });
    m = play(m, out, r(1), r(1), r(1), r(1), r(1));
    expect(m.status).toBe("break");
    expect(howOut(m, replay(m, 0).bat.get("A")!)).toBe("not out");
    expect(soloStandings(m).find((x) => x.id === "A")!.outs).toBe(1);
  });

  it("offers nobody to walk in after a wicket", () => {
    const m = solo(["A", "B", "C"]);
    expect(afterWicket(m, 0)).toEqual({ fresh: [], back: [] });
    expect(yetToBat(m, 0)).toEqual([]);
  });
});

describe("undo in a solo match", () => {
  it("steps back across a turn change", () => {
    let m = play(solo(["A", "B", "C"], { ballsPerTurn: 6 }), r(1), r(1), r(1), r(1), r(1));
    m = play(m, r(6));
    expect(m.status).toBe("break");
    m = startTurn(m);
    expect(currentBatter(m)).toBe("B");

    let u = undo(m);
    expect(u.droppedInnings?.striker).toBe("B");
    m = u.match;
    expect(m.status).toBe("break");
    expect(nextBatter(m)).toBe("B");

    u = undo(m);
    m = u.match;
    expect(u.popped).toMatchObject({ t: "ball", runs: 6 });
    expect(m.status).toBe("live");
    expect(currentBatter(m)).toBe("A");
    expect(turnBallsLeft(m)).toBe(1);
    expect(replay(m, 0).runs).toBe(5);
  });

  it("brings back a life", () => {
    let m = play(solo(["A", "B"], { lives: 2 }), out, out);
    expect(m.status).toBe("break");
    m = undo(m).match;
    expect(m.status).toBe("live");
    expect(livesLeft(m)).toBe(1);
  });

  it("reopens a finished match", () => {
    let m = play(solo(["A", "B"]), out);
    m = play(startTurn(m), out);
    expect(m.status).toBe("done");
    m = undo(m).match;
    expect(m.status).toBe("live");
    expect(currentBatter(m)).toBe("B");
    expect(result(m)).toBeNull();
  });
});

describe("rounds", () => {
  it("move on once everyone has batted", () => {
    let m = solo(["A", "B", "C"], { rounds: 2 });
    expect(soloRound(m)).toBe(1);
    m = play(m, out);
    m = play(startTurn(m), out);
    expect(upcomingBatters(m)).toEqual(["C"]);
    m = startTurn(m);
    expect(upcomingBatters(m)).toEqual([]);
    m = play(m, out);
    expect(m.status).toBe("break");
    expect(soloRound(m)).toBe(2);
    expect(nextBatter(m)).toBe("A");
    expect(upcomingBatters(m)).toEqual(["A", "B", "C"]);
    m = startTurn(m);
    expect(inningsLabel(m, 3)).toBe("A, round 2");
    expect(soloRound(m)).toBe(2);
    m = play(m, out);
    m = play(startTurn(m), out);
    m = play(startTurn(m), out);
    expect(m.status).toBe("done");
    expect(soloRound(m)).toBe(2);
    expect(startTurn(m)).toBe(m);
    expect(addBall(m, r(4))).toBe(m);
    expect(soloStandings(m).every((x) => x.turns === 2)).toBe(true);
  });

  it("labels turns by name when there is one round", () => {
    expect(inningsLabel(solo(["Aarav", "Bilal"]), 0)).toBe("Aarav");
  });

  it("add each player's runs across rounds", () => {
    let m = play(solo(["A", "B"], { rounds: 2 }), r(6), out);
    m = play(startTurn(m), r(4), out);
    m = play(startTurn(m), r(2), out);
    m = play(startTurn(m), r(1), out);
    const rows = soloStandings(m);
    expect(rows.map((x) => [x.id, x.runs, x.balls, x.outs])).toEqual([["A", 8, 4, 2], ["B", 5, 4, 2]]);
  });
});

describe("standings and result", () => {
  /** A 10 off 6, B 10 off 4, C 4 off 2. Everyone bowls to the others. */
  function threeWay(): Match {
    let m = play(solo(["A", "B", "C"], { ballsPerTurn: 6 }), r(1), r(1), r(2), r(2), r(2), r(2));
    m = play(startTurn(m), r(4), r(4), r(2), out);
    return play(startTurn(m), r(4), { runs: 0, wicket: { kind: "caught", out: "s", newId: null, fielderId: "B" } });
  }

  it("ranks by runs, then fewer balls faced", () => {
    const rows = soloStandings(threeWay());
    expect(rows.map((x) => x.id)).toEqual(["B", "A", "C"]);
    expect(rows[0]).toMatchObject({ runs: 10, balls: 4, strikeRate: 250, outs: 1, turns: 1 });
    expect(rows[1]).toMatchObject({ runs: 10, balls: 6, outs: 0 });
  });

  it("counts wickets and runs conceded per bowler", () => {
    const rows = soloStandings(threeWay()), by = (id: string) => rows.find((x) => x.id === id)!;
    expect(by("B")).toMatchObject({ wickets: 0, conceded: 10, bowled: 6 });
    expect(by("C")).toMatchObject({ wickets: 1, conceded: 10, bowled: 4 });
    expect(by("A")).toMatchObject({ wickets: 1, conceded: 4, bowled: 2 });
  });

  it("names the winner, and how a tie on runs was broken", () => {
    const res = result(threeWay())!;
    expect(res.text).toBe("B wins with 10, 4 balls to A's 6");
    expect(res.winnerId).toBe("B");
    expect(res.winner).toBeNull();
    expect(res.tie).toBe(false);
  });

  it("says who won with how many", () => {
    let m = play(solo(["Aarav", "Bilal"]), r(6), r(6), r(6), r(6), r(6), r(4), out);
    m = play(startTurn(m), r(4), out);
    expect(result(m)!.text).toBe("Aarav wins with 34");
  });

  it("is a tie when runs and balls are both level", () => {
    let m = play(solo(["A", "B", "C"]), r(6), out);
    m = play(startTurn(m), r(6), out);
    m = play(startTurn(m), r(6), out);
    expect(result(m)).toMatchObject({ text: "A, B and C tie on 6", tie: true, winner: null });
    expect(result(m)!.winnerId).toBeUndefined();
  });

  it("has no result until the last turn is over", () => {
    expect(result(play(solo(["A", "B"]), out))).toBeNull();
  });

  it("gives the winner the award points for winning", () => {
    let m = play(solo(["A", "B"]), r(6), out);
    m = play(startTurn(m), r(4), out);
    const aw = awards(m);
    expect(aw.topScorer?.id).toBe("A");
    expect(aw.potm?.id).toBe("A");
  });
});

describe("existing engine calls on a solo match", () => {
  it("have no target to chase between players", () => {
    let m = play(solo(["A", "B"]), r(6), out);
    m = play(startTurn(m), r(6), r(6));
    expect(target(m, 1)).toBeNull();
    expect(m.status).toBe("live");
  });

  it("startInnings starts the next turn in rotation", () => {
    let m = play(solo(["A", "B", "C"]), out);
    m = startInnings(m, "C", "A", "A");
    expect([currentBatter(m), m.innings[1].bowler]).toEqual(["B", "A"]);
  });
});
