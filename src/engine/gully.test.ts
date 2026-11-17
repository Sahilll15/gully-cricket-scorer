import { describe, expect, it } from "vitest";
import * as E from "./engine";
import type { BallInput, Match, Rules, Team, WicketKind } from "./types";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null, ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const cur = (m: Match) => m.innings.length - 1;
const st = (m: Match, i = cur(m)) => E.replay(m, i);

/** Bowls one ball, picking the first bowler allowed when an over has just ended. */
function bowl(m: Match, b: BallInput): Match {
  if (E.needsBowler(m, cur(m))) m = E.setBowler(m, E.bowlerOptions(m).find((o) => !o.blocked)!.id);
  return E.addBall(m, b);
}
const play = (m: Match, ...b: BallInput[]) => b.reduce(bowl, m);
const r = (runs: number, o: Partial<BallInput> = {}): BallInput => ({ runs, ...o });
const dots = (n: number) => Array.from({ length: n }, () => r(0));
const out = (m: Match, kind: WicketKind = "bowled"): Match =>
  bowl(m, { runs: 0, wicket: { kind, out: "s", newId: E.needsNewBatter(m, st(m).striker!) ? E.afterWicket(m, cur(m)).fresh[0]?.id ?? null : null } });

function setup(o: Partial<Rules> = {}, n = 4): Match {
  const m = E.newMatch([team("A", n), team("B", n)], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return E.startInnings(m, "A1", "A2", "B1");
}

describe("must run", () => {
  it("reads an old tipAndRun as touch, and mustRun wins over it", () => {
    expect(E.mustRunMode(rules({ tipAndRun: true }))).toBe("touch");
    expect(E.mustRunMode(rules())).toBe("off");
    expect(E.mustRunMode(rules({ tipAndRun: true, mustRun: "off" }))).toBe("off");
    expect(E.mustRunMode(rules({ mustRun: "every-hit" }))).toBe("every-hit");
  });

  it("asks about a 0 only when the bat touched it, or on every ball for compulsory run", () => {
    const touch = rules({ mustRun: "touch" }), every = rules({ mustRun: "every-hit" });
    expect(E.mustRunPrompt(touch, { runs: 0, touched: true })).toBe(true);
    expect(E.mustRunPrompt(touch, { runs: 0 })).toBe(false);
    expect(E.mustRunPrompt(touch, { runs: 1, touched: true })).toBe(false);
    expect(E.mustRunPrompt(every, { runs: 0 })).toBe(true);
    expect(E.mustRunPrompt(every, { runs: 0, extra: "wd" })).toBe(false);
    expect(E.mustRunPrompt(every, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } })).toBe(false);
    expect(E.mustRunPrompt(rules({ mustRun: "every-hit", noRunning: true }), { runs: 0 })).toBe(false);
    expect(E.mustRunPrompt(rules(), { runs: 0, touched: true })).toBe(false);
  });

  it("offers didn't run only with must run on, and not on byes", () => {
    expect(E.wicketKinds(rules(), null, false)).not.toContain("didn't run");
    expect(E.wicketKinds(rules({ mustRun: "touch" }), null, false)).toContain("didn't run");
    expect(E.wicketKinds(rules({ mustRun: "touch" }), "nb", false)).toEqual(["run out", "didn't run"]);
    expect(E.wicketKinds(rules({ mustRun: "touch" }), "b", false)).toEqual(["run out"]);
  });

  it("didn't run puts the striker out without crediting the bowler, and keeps touched on the ball", () => {
    const m = play(setup({ mustRun: "touch" }), r(0, { touched: true, wicket: { kind: "didn't run", out: "s", newId: "A3" } }));
    const s = st(m);
    expect(s.wickets).toBe(1);
    expect(s.bowl.get("B1")!.wickets).toBe(0);
    expect(E.howOut(m, s.bat.get("A1")!)).toBe("didn't run");
    expect(m.innings[0].events[0]).toMatchObject({ touched: true });
  });

  it("changing must run mid-match is taken back to what tipAndRun meant", () => {
    const m = E.changeRules(play(setup({ tipAndRun: true }), r(1)), { mustRun: "every-hit" }, ["A1", "B1"], 1);
    expect(E.mustRunMode(m.rules)).toBe("every-hit");
    expect(E.mustRunMode(E.undo(m).match.rules)).toBe("touch");
  });
});

describe("box cricket", () => {
  it("scores each wall's value plus any runs taken, and a wall hit is not a boundary", () => {
    const m = play(setup({ walls: { side: 1, back: 4, roof: 2, fullBack: 6 } }), r(0, { wall: "back" }), r(1, { wall: "side" }), r(0, { wall: "fullBack" }));
    const s = st(m);
    expect(s.runs).toBe(4 + 2 + 6);
    expect(s.bat.get("A1")!.runs).toBe(6);
    expect(s.bat.get("A2")!.runs).toBe(6);   // crossed on the 1 run after the side wall, so A2 faced the full back
    expect(s.bat.get("A1")!.fours + s.bat.get("A2")!.sixes).toBe(0);
    expect(E.ballByBall(m, 0)[0].map((f) => f.label)).toEqual(["Back 4", "Side 1+1", "Full back 6"]);
  });

  it("falls back to the old one-wall rule for a surface with no value", () => {
    const m = play(setup({ wall: "six", walls: { side: 1 } }), r(0, { wall: "back" }), r(0, { wall: "side" }));
    expect(st(m).runs).toBe(7);
    expect(E.wallValue(rules(), "roof")).toBe(0);
  });

  it("takes the wicket penalty off for every dismissal", () => {
    const m = out(play(setup({ wicketPenalty: 5 }), r(4)));
    const s = st(m);
    expect(s.runs).toBe(-1);
    expect(s.deducted).toBe(5);
    expect(s.fow[0].score).toBe(-1);
    expect(s.bat.get("A1")!.out?.kind).toBe("bowled");
  });

  it("no running: ground runs count nothing and the batters never cross, walls and boundaries still score", () => {
    const m = play(setup({ noRunning: true, walls: { back: 4 } }), r(1), r(3), r(4), r(0, { wall: "back" }), r(2, { overthrow: 1 }));
    const s = st(m);
    expect(s.runs).toBe(8);
    expect(s.striker).toBe("A1");
    expect(s.bat.get("A1")!.runs).toBe(8);
  });

  it("three dots in a row is out on its own, and a scoring ball resets the count", () => {
    let m = play(setup({ dotBallsOut: 3 }), r(0), r(0), r(2), r(0), r(0));
    expect(st(m).wickets).toBe(0);
    expect(E.forcedOut(m, r(0))).toBe("dot balls");
    expect(E.forcedOut(m, r(1))).toBeNull();
    expect(E.forcedOut(m, r(0, { extra: "wd" }))).toBeNull();
    m = bowl(m, r(0));
    const s = st(m);
    expect(s.wickets).toBe(1);
    expect(s.bat.get("A1")!.out?.kind).toBe("dot balls");
    expect([s.striker, s.nonStriker]).toEqual(["A2", "A3"]);   // A3 walked in on the last ball of the over
    expect(E.howOut(m, s.bat.get("A1")!)).toBe("dot balls");
  });

  it("a wide is not a dot and does not break the run", () => {
    const m = play(setup({ dotBallsOut: 2 }), r(0), r(0, { extra: "wd" }), r(0));
    expect(st(m).bat.get("A1")!.out?.kind).toBe("dot balls");
  });

  it("dots are counted per batter", () => {
    let m = play(setup({ dotBallsOut: 2 }), r(1), r(1), r(1), r(1), r(1), r(0), r(0));
    expect(st(m).wickets).toBe(0);   // A2's dot ended the over, then A1 faced one
    m = play(E.swapStrike(m), r(0));
    expect(st(m).bat.get("A2")!.out?.kind).toBe("dot balls");
  });
});

describe("sixes only", () => {
  it("counts only fours, sixes and walls; running scores nothing", () => {
    const m = play(setup({ onlyBoundaries: true, walls: { back: 2 } }), r(1), r(2), r(4), r(6), r(1, { wall: "back" }), r(1, { overthrow: 4 }));
    const s = st(m);
    expect(s.runs).toBe(12);
    expect(s.bat.get("A1")!.sixes + s.bat.get("A2")!.sixes).toBe(1);
  });

  it("with dotOut, any ball that scores nothing is out, a run included", () => {
    let m = setup({ onlyBoundaries: true, dotOut: true });
    expect(E.forcedOut(m, r(2))).toBe("dot balls");
    expect(E.forcedOut(m, r(4))).toBeNull();
    m = play(m, r(6), r(2));
    expect(st(m).wickets).toBe(1);
    expect(E.wicketKinds(m.rules, null, false)).toContain("dot balls");
  });
});

describe("balls per over", () => {
  it("ends the over after 5 balls and counts overs in fives", () => {
    let m = play(setup({ ballsPerOver: 5 }), ...dots(5));
    const s = st(m);
    expect(s.bpo).toBe(5);
    expect(s.overs[0]).toHaveLength(5);
    expect(s.bowl.get("B1")!.maidens).toBe(1);
    expect(s.striker).toBe("A2");
    expect(E.needsBowler(m, 0)).toBe(true);
    expect(E.oversText(s.legal, s.bpo)).toBe("1.0");
    m = play(m, ...dots(5));
    expect(st(m).ended).toBe(true);
    expect(st(m).legal).toBe(10);
    expect(E.ballsLeft(m, 0)).toBe(0);
  });

  it("keeps balls per over between 3 and 8, default 6", () => {
    expect(E.ballsPerOver(rules())).toBe(6);
    expect(E.ballsPerOver(rules({ ballsPerOver: 1 }))).toBe(3);
    expect(E.ballsPerOver(rules({ ballsPerOver: 12 }))).toBe(8);
    expect(E.runRate(10, 5, 5)).toBe(10);
  });

  it("caps a bowler by overs of that length", () => {
    let m = play(setup({ ballsPerOver: 4, overs: 4, maxOversPerBowler: 1 }), ...dots(4));
    m = E.setBowler(m, "B2");
    m = play(m, ...dots(4));
    expect(E.bowlerOptions(m).find((o) => o.id === "B1")!.blocked).toBe("cap");
    expect(E.bowlerOptions(m).find((o) => o.id === "B1")!.overs).toBe("1.0");
  });

  it("a fixed-balls innings: 100 balls in 5-ball overs is 20 overs and ends at 100", () => {
    let m = setup({ overs: 20, inningsBalls: 100, ballsPerOver: 5 }, 2);
    expect(m.innings[0]).toMatchObject({ balls: 100, overs: 20 });
    expect(E.formatText(m)).toBe("100 balls");
    expect(E.rulesCard(m)).toEqual(expect.arrayContaining(["100 balls a side.", "5 balls an over."]));
    m = play(m, ...dots(99));
    expect(E.ballsLeft(m, 0)).toBe(1);
    expect(m.status).toBe("live");
    m = play(m, r(1));
    expect(m.status).toBe("break");
  });

  it("cutting the overs of a fixed-balls innings sets the balls too", () => {
    let m = play(setup({ overs: 20, inningsBalls: 100, ballsPerOver: 5 }), ...dots(7));
    m = E.setOvers(m, 4);
    expect(m.innings[0].balls).toBe(20);
    expect(m.rules.inningsBalls).toBeUndefined();
  });

  it("balls per over can't change once the match is under way", () => {
    const m = E.changeRules(play(setup(), r(1)), { ballsPerOver: 5 }, [], 1);
    expect(m.rules.ballsPerOver).toBeUndefined();
    const pre = E.changeRules(E.newMatch([team("A"), team("B")], rules()), { ballsPerOver: 5 }, []);
    expect(pre.rules.ballsPerOver).toBe(5);
  });

  it("formats say so", () => {
    expect(E.formatText(setup({ ballsPerOver: 8, overs: 3 }))).toBe("3 overs of 8 balls");
  });
});

describe("pairs cricket", () => {
  /** 8 players, 4 overs, a new pair every over. */
  const pairs = (o: Partial<Rules> = {}, n = 8) => setup({ format: "pairs", overs: 4, pairOvers: 1, ...o }, n);

  it("pairs up the openers, then the rest of the side in order", () => {
    expect(pairs().innings[0].pairs).toEqual([["A1", "A2"], ["A3", "A4"], ["A5", "A6"], ["A7", "A8"]]);
    expect(setup({ format: "pairs" }, 5).innings[0].pairs).toEqual([["A1", "A2"], ["A3", "A4"], ["A5", "A1"]]);
  });

  it("rotates pairs at the over mark", () => {
    let m = play(pairs(), ...dots(6));
    expect([st(m).striker, st(m).nonStriker]).toEqual(["A3", "A4"]);
    m = play(m, ...dots(6));
    expect([st(m).striker, st(m).nonStriker]).toEqual(["A5", "A6"]);
    expect(st(m).order).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
  });

  it("brings no new pair in once the overs are done", () => {
    const m = play(pairs({ overs: 2 }), ...dots(12));
    expect(m.status).toBe("break");
    expect(st(m, 0).order).toEqual(["A1", "A2", "A3", "A4"]);
  });

  it("a dismissal costs 5 by default and the batter bats on", () => {
    let m = play(pairs(), r(4));
    expect(E.needsNewBatter(m, "A1")).toBe(false);
    expect(E.afterWicket(m, 0)).toEqual({ fresh: [], back: [] });
    m = out(m);
    const s = st(m);
    expect(s.runs).toBe(-1);
    expect(s.wickets).toBe(1);
    expect(s.striker).toBe("A1");
    expect(s.bat.get("A1")!.out).toBeNull();
    expect(s.bat.get("A1")!.outs).toBe(1);
    expect(E.howOut(m, s.bat.get("A1")!)).toBe("not out, dismissed 1 time");
    expect(s.allOut).toBe(false);
  });

  it("never all out, however many dismissals", () => {
    let m = pairs({}, 4);
    for (let i = 0; i < 6; i++) m = out(m);
    expect(m.status).toBe("live");
    expect(st(m).runs).toBe(-30);
  });

  it("keeps per-pair standings", () => {
    let m = play(pairs(), r(4), r(6), ...dots(4));
    m = out(play(m, r(1), r(1), r(1)));
    m = play(m, ...dots(2));
    const rows = E.pairStandings(m, 0);
    expect(rows).toEqual([
      { ids: ["A1", "A2"], names: "A1 & A2", runs: 10, outs: 0, balls: 6 },
      { ids: ["A3", "A4"], names: "A3 & A4", runs: -2, outs: 1, balls: 6 },
    ]);
    expect(E.pairStandings(setup(), 0)).toEqual([]);
  });

  it("the chase bats out its overs and the result is by runs", () => {
    let m = play(pairs({ overs: 1 }), r(4), ...dots(5));
    m = E.startInnings(m, "B1", "B2", "A1");
    m = play(m, r(6));
    expect(m.status).toBe("live");   // past the target, but still batting
    m = out(m);
    m = play(m, ...dots(4));
    expect(m.status).toBe("done");
    expect(E.result(m)!.text).toBe("A won by 3 runs");
    expect(E.formatText(m)).toBe("Pairs, 1 overs");
  });

  it("chasers ahead at the end win by runs", () => {
    let m = play(pairs({ overs: 1 }), ...dots(6));
    m = play(E.startInnings(m, "B1", "B2", "A1"), r(2), ...dots(5));
    expect(E.result(m)).toMatchObject({ text: "B won by 2 runs", winner: 1 });
  });

  it("double wicket: two-player teams bat all their overs as one pair", () => {
    let m = setup({ format: "pairs", overs: 2, pairOvers: 2 }, 2);
    expect(m.innings[0].pairs).toEqual([["A1", "A2"]]);
    m = out(play(m, r(6), ...dots(5)));
    m = play(m, ...dots(5));
    expect(m.status).toBe("break");
    expect(st(m, 0).runs).toBe(1);
    expect(E.pairStandings(m, 0)).toEqual([{ ids: ["A1", "A2"], names: "A1 & A2", runs: 1, outs: 1, balls: 12 }]);
  });

  it("forced outs carry on too, with no one walking in", () => {
    const m = play(pairs({ dotBallsOut: 2 }), r(0), r(0));
    expect(m.innings[0].events[1]).toMatchObject({ wicket: { kind: "dot balls", outId: "A1", newId: null } });
    expect(st(m).striker).toBe("A1");
  });
});

describe("French cricket", () => {
  const people = ["Asha", "Bunty", "Chiku", "Dolly"].map((n) => ({ id: n, name: n }));
  const caught = (by: string): BallInput => ({ runs: 0, wicket: { kind: "caught", out: "s", newId: null, fielderId: by } });

  it("starts with the first player batting and only caught or hit legs as ways out", () => {
    const m = E.startFrench(people);
    expect(E.isFrench(m) && E.isSolo(m)).toBe(true);
    expect(E.currentBatter(m)).toBe("Asha");
    expect(m.innings[0].bowler).toBe("Bunty");
    expect(E.wicketKinds(m.rules, null, false)).toEqual(["caught", "hit legs"]);
    expect(E.formatText(m)).toBe("French cricket");
    expect(E.rulesCard(m)[0]).toMatch(/French cricket/);
  });

  it("has no overs: the turn goes on until out, nobody is asked for a bowler", () => {
    const m = E.addBall(E.startFrench(people), r(1));
    let x = m;
    for (let i = 0; i < 20; i++) x = E.addBall(x, r(1));
    expect(x.status).toBe("live");
    expect(E.needsBowler(x, 0)).toBe(false);
    expect(E.turnBallsLeft(x)).toBeNull();
    expect(st(x).runs).toBe(21);
  });

  it("whoever got the batter out bats next, the last batter bowls first", () => {
    let m = E.startFrench(people);
    m = E.setBowler(m, "Chiku");
    m = E.addBall(m, r(2));
    m = E.addBall(m, caught("Dolly"));
    expect(m.status).toBe("break");
    expect(E.frenchOutBy(m)).toBe("Dolly");
    expect(E.nextBatter(m)).toBe("Dolly");
    m = E.frenchNext(m, "Dolly");
    expect(E.currentBatter(m)).toBe("Dolly");
    expect(m.innings[1].bowler).toBe("Asha");
    expect(E.inningsLabel(m, 1)).toBe("Dolly");
  });

  it("hit legs is the bowler's; with no catcher the bowler bats next", () => {
    let m = E.addBall(E.startFrench(people), { runs: 0, wicket: { kind: "hit legs", out: "s", newId: null } });
    expect(E.frenchOutBy(m)).toBe("Bunty");
    expect(st(m, 0).bowl.get("Bunty")!.wickets).toBe(1);
    m = E.startTurn(m);
    expect(E.currentBatter(m)).toBe("Bunty");
  });

  it("refuses a batter who isn't playing, or a bowler who is the batter", () => {
    const m = E.addBall(E.startFrench(people), caught("Bunty"));
    expect(E.frenchNext(m, "Nobody")).toBe(m);
    expect(E.frenchNext(m, "Bunty", "Bunty")).toBe(m);
  });

  it("goes on until stopped, then most runs wins; undo takes the stop back", () => {
    let m = E.addBall(E.addBall(E.startFrench(people), r(4)), caught("Bunty"));
    m = E.addBall(E.frenchNext(m, "Bunty"), r(6));
    m = E.addBall(m, caught("Chiku"));
    expect(m.status).toBe("break");
    m = E.stopMatch(m);
    expect(m.status).toBe("done");
    expect(E.result(m)).toMatchObject({ winnerId: "Bunty", text: "Bunty wins with 6" });
    expect(E.undo(m).match.status).toBe("break");
  });

  it("stopping mid-turn ends the match there", () => {
    const m = E.stopMatch(E.addBall(E.startFrench(people), r(3)));
    expect(m.status).toBe("done");
    expect(E.soloStandings(m)[0]).toMatchObject({ id: "Asha", runs: 3 });
  });
});

describe("last man and misses", () => {
  it("the last batter on his own scores one for every two run; boundaries count in full", () => {
    let m = setup({ lastManStands: true, lastManRunsTwo: true }, 2);
    m = out(m);
    expect(st(m).nonStriker).toBeNull();
    m = play(m, r(3), r(2), r(4));
    expect(st(m).runs).toBe(1 + 1 + 4);
    expect(st(m).bat.get("A2")!.runs).toBe(6);
  });

  it("does nothing while there are two batters", () => {
    expect(st(play(setup({ lastManRunsTwo: true }), r(3))).runs).toBe(3);
  });

  it("solo: the third miss is out on its own", () => {
    let m = E.startSolo([{ id: "P", name: "P" }, { id: "Q", name: "Q" }], { missesOut: 3, lives: 2 });
    m = E.addBall(m, r(0, { missed: true }));
    m = E.addBall(m, r(1));
    m = E.addBall(m, r(0, { missed: true }));
    expect(E.forcedOut(m, r(0, { missed: true }))).toBe("misses");
    m = E.addBall(m, r(0, { missed: true }));
    expect(st(m).wickets).toBe(1);
    expect(E.livesLeft(m)).toBe(1);
    // The count starts again after a life is lost.
    m = E.addBall(m, r(0, { missed: true }));
    expect(st(m).wickets).toBe(1);
    expect(E.wicketKinds(m.rules, null, false)).toContain("misses");
  });
});

describe("variants", () => {
  it("golden ball doubles its runs and a wicket on it costs 6", () => {
    const g = { goldenBall: { over: 1, ball: 2 } };
    expect(st(play(setup(g), r(1), r(4))).runs).toBe(9);
    expect(st(play(setup(g), r(1), r(4))).bat.get("A2")!.runs).toBe(8);
    const m = out(play(setup(g), r(1)));
    expect(st(m).runs).toBe(-5);
    expect(st(m).wickets).toBe(1);
  });

  it("power ball doubles that ball of every over, a wide on it too", () => {
    const m = play(setup({ powerBall: 3 }), r(1), r(1), r(0, { extra: "wd" }), r(2), ...dots(3), r(1), r(3));
    // over 1: 1, 1, wide (2), 2 doubled to 4, then dots; over 2: 1, then ball 2 is 3, ball 3 not reached
    expect(st(m).runs).toBe(1 + 1 + 2 + 4 + 1 + 3);
  });

  it("Joker over doubles every run in it", () => {
    const m = play(setup({ jokerOver: 2 }), r(1), ...dots(5), r(4), r(0, { extra: "nb" }));
    expect(st(m).runs).toBe(1 + 8 + 2);
    expect(st(m).extras.nb).toBe(2);
  });

  it("multipliers stack", () => {
    const m = play(setup({ jokerOver: 1, powerBall: 1, goldenBall: { over: 1, ball: 1 } }), r(1));
    expect(st(m).runs).toBe(8);
  });

  it("a protected player's first dismissal costs runs instead; the second is out", () => {
    let m = play(setup({ protectedPlayers: ["A1"] }), r(4));
    expect(E.needsNewBatter(m, "A1")).toBe(false);
    expect(E.needsNewBatter(m, "A2")).toBe(true);
    m = bowl(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    let s = st(m);
    expect(s.runs).toBe(-1);
    expect(s.wickets).toBe(0);
    expect(s.striker).toBe("A1");
    expect(s.bat.get("A1")!).toMatchObject({ out: null, saved: 1 });
    expect(s.bowl.get("B1")!.wickets).toBe(0);
    expect(E.needsNewBatter(m, "A1")).toBe(true);
    m = out(m);
    s = st(m);
    expect(s.wickets).toBe(1);
    expect(s.bat.get("A1")!.out?.kind).toBe("bowled");
  });

  it("the protected penalty follows wicketPenalty when set", () => {
    const m = bowl(setup({ protectedPlayers: ["A1"], wicketPenalty: 3 }), { runs: 0, wicket: { kind: "caught", out: "s", newId: null } });
    expect(st(m).runs).toBe(-3);
  });

  it("variants are on the rules card", () => {
    const card = E.rulesCard(setup({ goldenBall: { over: 2, ball: 3 }, powerBall: 4, jokerOver: 1, protectedPlayers: ["A1"], walls: { side: 1, back: 4 } }));
    expect(card).toEqual(expect.arrayContaining([
      "Golden ball, over 2 ball 3: runs double, a wicket costs 6.", "Power ball: ball 4 of every over scores double.",
      "Joker over: over 1 scores double.", "Protected: A1. First time out costs 5 runs instead.", "Walls: side 1, back 4.",
    ]));
  });
});

describe("overthrows and penalty runs", () => {
  it("adds overthrows to the batter's runs, crosses on the total, and shows them", () => {
    const m = play(setup(), r(1, { overthrow: 4 }), r(2, { overthrow: 1 }));
    const s = st(m);
    expect(s.runs).toBe(8);
    expect(s.bat.get("A1")!.runs).toBe(5);
    expect(s.bat.get("A1")!.fours).toBe(0);
    expect(s.bat.get("A2")!.runs).toBe(3);
    expect(s.striker).toBe("A1");
    expect(E.ballLabel(m.innings[0].events[0] as never)).toBe("1+4 ot");
    expect(s.bowl.get("B1")!.runs).toBe(8);
  });

  it("overthrows off byes are extras", () => {
    const s = st(play(setup(), r(1, { extra: "b", overthrow: 4 })));
    expect(s.extras.b).toBe(5);
    expect(s.bat.get("A1")!.runs).toBe(0);
    expect(s.bowl.get("B1")!.runs).toBe(0);
  });

  it("penalty runs to the batting side go on its score now", () => {
    let m = E.addPenalty(play(setup(), r(1)), 0, 5, "Ball hit the helmet");
    expect(st(m)).toMatchObject({ runs: 6, penalties: 5, legal: 1 });
    expect(E.ballByBall(m, 0)[0].map((f) => f.label)).toEqual(["1", "Pen +5"]);
    expect(E.ballByBall(m, 0)[0][1].penalty).toMatchObject({ side: 0, runs: 5, reason: "Ball hit the helmet" });
    const { match, popped } = E.undo(m);
    expect(st(match).runs).toBe(1);
    m = E.redo(match, popped!);
    expect(st(m).runs).toBe(6);
  });

  it("penalty runs to the fielding side go on its next innings if it hasn't batted", () => {
    let m = E.addPenalty(play(setup({ overs: 1 }), r(1)), 1, 5, "Fake fielding");
    expect(st(m, 0).runs).toBe(1);
    m = play(m, ...dots(5));
    m = E.startInnings(m, "B1", "B2", "A1");
    expect(st(m, 1)).toMatchObject({ runs: 5, penalties: 5 });
  });

  it("penalty runs to the fielding side in the chase raise the target", () => {
    let m = play(setup({ overs: 1 }), r(4), ...dots(5));
    m = E.startInnings(m, "B1", "B2", "A1");
    expect(E.target(m, 1)).toBe(5);
    m = E.addPenalty(m, 0, 5, "Ball tampering");
    expect(E.target(m, 1)).toBe(10);
    expect(st(m, 0).runs).toBe(9);
  });

  it("ignores a zero penalty and a finished match", () => {
    const m = setup();
    expect(E.addPenalty(m, 0, 0)).toBe(m);
  });
});

describe("retired hurt", () => {
  it("shows retired hurt, never out, and the batter comes back in the same place in the order", () => {
    let m = play(setup(), r(2));
    m = E.retire(m, "s", "A3", true);
    expect(m.innings[0].events[1]).toEqual({ t: "retire", out: "s", newId: "A3", hurt: true });
    let s = st(m);
    expect(E.howOut(m, s.bat.get("A1")!)).toBe("retired hurt");
    expect(s.bat.get("A1")!.out).toBeNull();
    expect(E.afterWicket(m, 0).back.map((p) => p.id)).toEqual(["A1"]);
    m = bowl(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A1" } });
    s = st(m);
    expect(s.order).toEqual(["A1", "A2", "A3"]);
    expect(s.bat.get("A1")).toMatchObject({ retired: false, cameBack: true, runs: 2 });
    expect(s.bat.get("A1")!.hurt).toBeUndefined();
    expect(E.howOut(m, s.bat.get("A1")!)).toBe("not out");
  });

  it("plain retire still says retired not out, and redo keeps hurt", () => {
    const m = E.retire(play(setup(), r(1)), "ns", "A3");
    expect(E.howOut(m, st(m).bat.get("A1")!)).toBe("retired not out");
    const hurt = E.retire(setup(), "s", "A3", true), u = E.undo(hurt);
    expect(E.redo(u.match, u.popped!).innings[0].events[0]).toMatchObject({ hurt: true });
  });
});

describe("chase from a target", () => {
  it("starts at the break with the first innings given, and the chase works as usual", () => {
    let m = E.startChase([team("A"), team("B")], rules({ overs: 2 }), 12, 2, 1);
    expect(m.status).toBe("break");
    expect(E.inningsScore(m, 0)).toBe("11/2");
    expect(st(m, 0)).toMatchObject({ legal: 0, ended: true, allOut: false });
    m = E.startInnings(m, "B1", "B2", "A1");
    expect(m.innings[1].bat).toBe(1);
    expect(E.target(m, 1)).toBe(12);
    m = play(m, r(6), r(4), r(2));
    expect(m.status).toBe("done");
    expect(E.result(m)!.text).toBe("B won by 3 wickets");
  });

  it("defaults to no wickets fallen and can be lost", () => {
    let m = E.startChase([team("A"), team("B")], rules({ overs: 1 }), 5);
    expect(E.inningsScore(m, 0)).toBe("4/0");
    m = play(E.startInnings(m, "B1", "B2", "A1"), ...dots(6));
    expect(E.result(m)!.text).toBe("A won by 4 runs");
  });
});

describe("old saved data", () => {
  it("a match with none of the new options plays the same as before", () => {
    const m = play(setup(), r(1), r(4), r(0, { extra: "wd" }), r(6));
    const s = st(m);
    expect(s).toMatchObject({ runs: 12, legal: 3, penalties: 0, deducted: 0, bpo: 6, maxBalls: 12 });
    expect(m.innings[0].events[0]).toEqual({ t: "ball", runs: 1, bowler: "B1" });
    expect(m.innings[0].pairs).toBeUndefined();
    expect(m.innings[0].balls).toBeUndefined();
  });
});
