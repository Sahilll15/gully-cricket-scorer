import { describe, expect, it } from "vitest";
import {
  addBall, addPlayer, afterWicket, ballByBall, ballLost, bowlerOptions, canBowl, changeLog, changeRules, closeInnings, editBall,
  eveningTally, markLeft, needsBowler, newMatch, notBattedYet, notBowledYet, redo, rematch, replay, result, ruleChanges, rulesAt,
  rulesCard, setBowler, startInnings, startSolo, startTurn, stopLeaderWins, stopMatch, suggestedBowler, umpire, undo, upcomingBatters,
  nextBatter, yetToBat,
} from "./engine";
import type { BallInput, Match, Rules, Team } from "./types";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null, ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const r = (runs: number): BallInput => ({ runs });
const wd: BallInput = { runs: 0, extra: "wd" };
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

function fresh(o: Partial<Rules> = {}, n = 4): Match {
  const m = newMatch([team("A", n), team("B", n)], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return m;
}
const setup = (o: Partial<Rules> = {}, n = 4) => startInnings(fresh(o, n), "A1", "A2", "B1");
const play = (m: Match, ...balls: BallInput[]) => balls.reduce(addBall, m);
const dots = (m: Match, k: number) => play(m, ...Array.from({ length: k }, () => r(0)));

/** A match from before these features: none of the new fields, shaped as it was saved. */
function oldSaved(): Match {
  const m = play(setup(), r(1), r(4), wd, r(0), r(6));
  delete m.rulesLockedAt;
  return JSON.parse(JSON.stringify(m));
}

describe("old saved matches", () => {
  it("replay exactly as before with none of the new fields", () => {
    const m = oldSaved();
    const st = replay(m, 0);
    expect([st.runs, st.legal, st.wickets]).toEqual([12, 4, 0]);
    expect(rulesAt(m, 0)).toEqual(m.rules);
    expect(changeLog(m)).toEqual([]);
    expect(ruleChanges(m)).toEqual([]);
    expect(umpire(m)).toBeNull();
    expect(canBowl(m, 0, "B2")).toBe(true);
    expect(result(m)).toBeNull();
  });
});

describe("umpire rotation", () => {
  it("is null when the rule is off", () => {
    expect(umpire(setup())).toBeNull();
  });

  it("moves one along the fielding side each over and never picks the bowler", () => {
    let m = setup({ rotateUmpire: true, overs: 4 });
    expect(umpire(m)!.id).toBe("B2");   // over 1: B1 is first in line but bowling
    m = setBowler(dots(m, 6), "B2");
    expect(umpire(m)!.id).toBe("B3");   // over 2: B2 is in line but bowling
    m = setBowler(dots(m, 6), "B1");
    expect(umpire(m)!.id).toBe("B3");   // over 3: B3 is in line
    m = setBowler(dots(m, 6), "B2");
    expect(umpire(m)!.id).toBe("B4");
  });

  it("skips a common player who is batting and players who went home", () => {
    const a = team("A", 2), b = team("B", 2), C = { id: "C", name: "C" };
    a.players.push(C); b.players.push(C);
    const m0 = newMatch([a, b], rules({ rotateUmpire: true }));
    m0.toss = { winner: 0, choice: "bat" };
    const m = startInnings(m0, "A1", "C", "B1");
    expect(umpire(m)!.id).toBe("B2");
    expect(umpire(markLeft(m, "B2"))).toBeNull();   // only the bowler and the batting common player are left
  });

  it("is null between innings", () => {
    const m = closeInnings(setup({ rotateUmpire: true }));
    expect(m.status).toBe("break");
    expect(umpire(m)).toBeNull();
  });

  it("works in solo, skipping the batter and the bowler", () => {
    const m = startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }], { rotateUmpire: true });
    expect(umpire(m)!.id).toBe("C");
  });
});

describe("rules locked at the toss", () => {
  it("stamps the time when the first innings starts, not later innings", () => {
    const m = setup();
    expect(typeof m.rulesLockedAt).toBe("number");
    const second = startInnings({ ...closeInnings(m), rulesLockedAt: 5 }, "B1", "B2", "A1");
    expect(second.rulesLockedAt).toBe(5);
    expect(startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }]).rulesLockedAt).toBeTypeOf("number");
  });

  it("before the toss, changeRules just sets the rules", () => {
    const m = changeRules(fresh(), { freeHit: true }, []);
    expect(m.rules.freeHit).toBe(true);
    expect(m.innings).toEqual([]);
  });

  it("after the toss it records who agreed and when, as an event", () => {
    const m = changeRules(play(setup(), r(1)), { extraRun: false }, ["A1", "B1"], 1000);
    expect(m.rules.extraRun).toBe(false);
    expect(ruleChanges(m)).toEqual([{ t: "rules", from: { extraRun: true }, to: { extraRun: false }, agreedBy: ["A1", "B1"], at: 1000 }]);
  });

  it("applies from that ball on, not to balls before it", () => {
    let m = play(setup(), wd, r(1));
    m = changeRules(m, { extraRun: false, rebowl: false }, ["A1", "B1"]);
    m = play(m, wd);
    const st = replay(m, 0);
    expect(st.runs).toBe(2);          // first wide 1, single 1, second wide 0
    expect(st.legal).toBe(2);         // the second wide counts as a ball now
    expect(st.extras.wd).toBe(1);
    expect(rulesAt(m, 0).extraRun).toBe(true);
  });

  it("ignores no-op changes and the format", () => {
    const m = setup();
    expect(changeRules(m, { extraRun: true }, ["A1"])).toBe(m);
    expect(changeRules(m, { format: "test" }, ["A1"])).toBe(m);
  });

  it("records an unset optional rule as its default so undo restores it", () => {
    let m = changeRules(setup(), { rotateUmpire: true, retireAt: 10 }, ["A1"]);
    expect(ruleChanges(m)[0].from).toEqual({ rotateUmpire: false, retireAt: null });
    m = JSON.parse(JSON.stringify(m));
    const back = undo(m);
    expect(back.match.rules.rotateUmpire).toBe(false);
    expect(back.match.rules.retireAt).toBeNull();
    expect(back.popped?.t).toBe("rules");
    expect(ruleChanges(back.match)).toEqual([]);
  });

  it("undo then redo puts the change back", () => {
    const m = changeRules(play(setup(), r(1)), { noLbw: true }, ["A1"], 7);
    const { match, popped } = undo(m);
    expect(match.rules.noLbw).toBeFalsy();
    const again = redo(match, popped!);
    expect(again.rules.noLbw).toBe(true);
    expect(ruleChanges(again)[0]).toMatchObject({ to: { noLbw: true }, agreedBy: ["A1"], at: 7 });
  });

  it("cutting overs moves the innings limit, and undo restores it", () => {
    let m = dots(setup({ overs: 5, maxOversPerBowler: 3 }), 7);
    m = changeRules(m, { overs: 2 }, ["A1", "B1"]);
    expect(m.innings[0].overs).toBe(2);
    expect(m.rules.maxOversPerBowler).toBe(2);
    m = dots(m, 5);
    expect(m.status).toBe("break");
    m = undo(undo(undo(undo(undo(m).match).match).match).match).match;
    const back = undo(m).match;
    expect(back.rules.overs).toBe(5);
    expect(back.rules.maxOversPerBowler).toBe(3);
    expect(back.innings[0].overs).toBe(5);
  });

  it("can't cut overs below the balls already bowled", () => {
    const m = changeRules(dots(setup({ overs: 5 }), 13), { overs: 1 }, ["A1"]);
    expect(m.innings[0].overs).toBe(3);
    expect(m.rules.overs).toBe(1);
  });

  it("turning last man stands on gives the batting side one more wicket", () => {
    const m = changeRules(setup(), { lastManStands: true }, ["A1"]);
    expect(m.innings[0].wicketLimit).toBe(4);
    expect(undo(m).match.innings[0].wicketLimit).toBe(3);
  });

  it("a change between innings applies to the next one only, and undo takes it back first", () => {
    let m = closeInnings(play(setup(), wd, r(1)));
    m = changeRules(m, { extraRun: false }, ["A1", "B1"]);
    expect(m.status).toBe("break");
    expect(replay(m, 0).runs).toBe(2);
    m = startInnings(m, "B1", "B2", "A1");
    m = play(m, wd);
    expect(replay(m, 1).runs).toBe(0);
    m = undo(undo(m).match).match;   // the wide, then the empty innings
    const back = undo(m);
    expect(back.popped?.t).toBe("rules");
    expect(back.match.rules.extraRun).toBe(true);
    expect(back.match.innings[0].closed).toBe(true);
  });

  it("rulesCard lists the active rules as short sentences", () => {
    const card = rulesCard(fresh({ overs: 6, freeHit: true, wall: "four", maxOversPerBowler: 2, rotateUmpire: true, commonCantBowl: true, retireAt: 25 }));
    expect(card).toEqual([
      "6 overs a side.",
      "Wides and no-balls give a run.",
      "Wides and no-balls are bowled again.",
      "Free hit after a no-ball.",
      "Hitting the wall is a four.",
      "A bowler bowls 2 overs at most.",
      "Retire at 25 runs, so everyone bats.",
      "Fielders take turns to umpire, one over each.",
      "The common player can't bowl.",
    ]);
    expect(rulesCard(fresh({ overs: 1, extraRun: false, rebowl: false }))).toEqual(["1 over a side."]);
    expect(rulesCard(fresh({ format: "test", matchOvers: 40, extraRun: false, rebowl: false }))).toEqual([
      "Test match: two innings a side.", "Draw if it isn't over after 40 overs.",
    ]);
    const solo = startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }], { lives: 2, rounds: 3, extraRun: false, rebowl: false, commonCantBowl: true });
    expect(rulesCard(solo)).toEqual(["Solo: everyone bats on their own, everyone else bowls.", "12 balls a turn.", "2 lives a turn.", "Everyone bats 3 times."]);
  });

  it("rulesCard shows the rules after an agreed change", () => {
    const m = changeRules(setup(), { noLbw: true, sixOut: true }, ["A1"]);
    expect(rulesCard(m)).toContain("No lbw.");
    expect(rulesCard(m)).toContain("Hit out of the ground is out.");
  });
});

describe("change log", () => {
  it("records each edit of an earlier ball with when, where, from and to", () => {
    let m = play(setup(), r(1), r(2), r(0), r(0), r(0), r(0), r(3));
    m = editBall(m, 0, 1, { runs: 4 }, 100);
    m = editBall(m, 0, 6, { runs: 0, extra: "wd" }, 200);
    expect(m.changes).toEqual([
      { at: 100, innings: 0, ball: 1, from: { runs: 2 }, to: { runs: 4 } },
      { at: 200, innings: 0, ball: 6, from: { runs: 3 }, to: { runs: 0, extra: "wd" } },
    ]);
    expect(changeLog(m).map((c) => c.text)).toEqual([
      "1st innings, over 1: 2 changed to 4",
      "1st innings, over 2: 3 changed to Wd",
    ]);
  });

  it("doesn't log an edit that changes nothing, and keeps the wicket in the label", () => {
    let m = play(setup(), r(1), { runs: 1, wicket: { kind: "run out", out: "s", newId: "A3" } });
    m = editBall(m, 0, 0, { runs: 1 });
    expect(m.changes).toBeUndefined();
    m = editBall(m, 0, 1, { runs: 0 }, 5);
    expect(changeLog(m)[0].text).toBe("1st innings, over 1: 1 W changed to W");
  });
});

describe("bowler picker", () => {
  it("gives overs bowled and overs left under the cap", () => {
    let m = setup({ overs: 5, maxOversPerBowler: 2 });
    m = setBowler(dots(m, 6), "B2");
    m = setBowler(dots(m, 6), "B1");
    m = setBowler(dots(m, 6), "B3");
    expect(bowlerOptions(m)[0].blocked).toBe("just bowled");   // checked before the cap, as canBowl always has
    m = dots(m, 6);
    expect(bowlerOptions(m).map((o) => [o.id, o.overs, o.oversLeft, o.blocked])).toEqual([
      ["B1", "2.0", 0, "cap"],
      ["B2", "1.0", 1, null],
      ["B3", "1.0", 1, "just bowled"],
      ["B4", "0.0", 2, null],
    ]);
  });

  it("marks who just bowled, with no cap meaning null overs left", () => {
    const opts = bowlerOptions(dots(setup(), 6));
    expect(opts[0]).toEqual({ id: "B1", name: "B1", balls: 6, overs: "1.0", oversLeft: null, blocked: "just bowled" });
    expect(opts.slice(1).every((o) => o.blocked === null)).toBe(true);
  });

  it("agrees with canBowl for every player", () => {
    const m = setBowler(dots(setup({ overs: 3, maxOversPerBowler: 1 }), 6), "B2");
    for (const o of bowlerOptions(m)) expect(o.blocked === null).toBe(canBowl(m, 0, o.id));
  });

  it("solo: the batter is blocked as batting", () => {
    const m = startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }]);
    expect(bowlerOptions(m).map((o) => [o.id, o.blocked])).toEqual([["A", "batting"], ["B", null], ["C", null]]);
  });

  it("is empty before the toss", () => {
    expect(bowlerOptions(fresh())).toEqual([]);
  });
});

describe("everyone gets a go", () => {
  it("lists who hasn't batted or bowled for each side", () => {
    let m = play(setup(), { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } });
    expect(ids(notBattedYet(m, 0))).toEqual(["A4"]);
    expect(ids(notBowledYet(m, 1))).toEqual(["B2", "B3", "B4"]);
    expect(ids(notBattedYet(m, 1))).toEqual(["B1", "B2", "B3", "B4"]);
    m = startInnings(closeInnings(m), "B1", "B2", "A4");
    expect(ids(notBattedYet(m, 1))).toEqual(["B3", "B4"]);
    expect(ids(notBowledYet(m, 0))).toEqual(["A1", "A2", "A3", "A4"]);   // A4 is picked but hasn't bowled a ball
    m = play(m, r(0));
    expect(ids(notBowledYet(m, 0))).toEqual(["A1", "A2", "A3"]);
  });

  it("leaves out players who went home and a common player barred from bowling", () => {
    const a = team("A", 2), b = team("B", 2), C = { id: "C", name: "C" };
    a.players.push(C); b.players.push(C);
    const m0 = newMatch([a, b], rules({ commonCantBowl: true }));
    m0.toss = { winner: 0, choice: "bat" };
    const m = markLeft(startInnings(m0, "A1", "A2", "B1"), "B2");
    expect(ids(notBowledYet(m, 1))).toEqual(["B1"]);
    expect(ids(notBattedYet(m, 1))).toEqual(["B1", "C"]);
  });
});

describe("common player can't bowl", () => {
  function withCommon(o: Partial<Rules> = {}): Match {
    const a = team("A", 2), b = team("B", 2), C = { id: "C", name: "C" };
    a.players.push(C); b.players.push(C);
    const m = newMatch([a, b], rules(o));
    m.toss = { winner: 0, choice: "bat" };
    return startInnings(m, "A1", "A2", "B1");
  }

  it("blocks the common player only when the rule is on", () => {
    expect(canBowl(withCommon(), 0, "C")).toBe(true);
    const m = withCommon({ commonCantBowl: true });
    expect(canBowl(m, 0, "C")).toBe(false);
    expect(bowlerOptions(m).find((o) => o.id === "C")!.blocked).toBe("common");
    expect(canBowl(m, 0, "B2")).toBe(true);
  });

  it("makes an over change needed if the common player was picked", () => {
    let m = setBowler(withCommon({ commonCantBowl: true }), "C");
    m = dots(m, 6);
    expect(needsBowler(m, 0)).toBe(true);
  });

  it("doesn't count the common player as another bowler for the back-to-back rule", () => {
    const a = team("A", 2), b = team("B", 1), C = { id: "C", name: "C" };
    a.players.push(C); b.players.push(C);
    const m0 = newMatch([a, b], rules({ commonCantBowl: true }));
    m0.toss = { winner: 0, choice: "bat" };
    const m = dots(startInnings(m0, "A1", "A2", "B1"), 6);
    expect(canBowl(m, 0, "B1")).toBe(true);   // only bowler left, so he bowls again
  });

  it("never applies in solo, where everyone is a common player", () => {
    const m = startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }], { commonCantBowl: true });
    expect(canBowl(m, 0, "B")).toBe(true);
  });
});

describe("stop now, leader wins", () => {
  it("the side ahead on runs per ball wins and the result says so", () => {
    let m = play(setup({ overs: 2 }), r(6), r(0), r(0), r(0), r(0), r(0));   // A: 6 off 6
    m = setBowler(m, "B2");
    m = dots(m, 6);
    m = startInnings(m, "B1", "B2", "A1");
    m = play(m, r(4), r(1));   // B: 5 off 2
    m = stopLeaderWins(m);
    expect(m.status).toBe("done");
    expect(m.stoppedLead).toBe(true);
    const res = result(m)!;
    expect(res.text).toBe("B win, match stopped: ahead on run rate");
    expect(res).toMatchObject({ winner: 1, tie: false, stopped: true });
    expect(addBall(m, r(1))).toBe(m);
  });

  it("the side that batted first wins when the chasers are behind the rate", () => {
    let m = play(setup({ overs: 1 }), r(4), r(4), r(0), r(0), r(0), r(0));
    m = startInnings(m, "B1", "B2", "A1");
    m = play(m, r(1), r(0));
    expect(result(stopLeaderWins(m))!.text).toBe("A win, match stopped: ahead on run rate");
  });

  it("level on runs per ball is a tie", () => {
    let m = play(setup({ overs: 1 }), r(1), r(1), r(1), r(1), r(1), r(1));
    m = startInnings(m, "B1", "B2", "A1");
    m = play(m, r(1), r(1));
    expect(result(stopLeaderWins(m))).toMatchObject({ text: "Match tied, match stopped: level on run rate", tie: true, winner: null });
  });

  it("does nothing until both sides have faced a ball, and in a Test", () => {
    const first = play(setup(), r(4));
    expect(stopLeaderWins(first)).toBe(first);
    const chase = startInnings(closeInnings(first), "B1", "B2", "A1");
    expect(stopLeaderWins(chase)).toBe(chase);
    const test = play(startInnings(fresh({ format: "test" }), "A1", "A2", "B1"), r(1));
    expect(stopLeaderWins(test)).toBe(test);
  });

  it("undo takes it back and the existing Test draw is untouched", () => {
    let m = play(setup({ overs: 1 }), r(4), r(0), r(0), r(0), r(0), r(0));
    m = play(startInnings(m, "B1", "B2", "A1"), r(1));
    const stopped = stopLeaderWins(m);
    const back = undo(stopped).match;
    expect(back.stoppedLead).toBeUndefined();
    expect(back.status).toBe("live");
    expect(replay(back, 1).legal).toBe(1);
    const t = stopMatch(play(startInnings(fresh({ format: "test" }), "A1", "A2", "B1"), r(1)));
    expect(result(t)).toMatchObject({ text: "Match drawn", draw: true });
    expect(result(t)!.stopped).toBeUndefined();
  });
});

describe("add or remove a player mid-match", () => {
  it("addPlayer adds to the side and gives a batting side one more wicket", () => {
    const m = setup();
    const { match, id } = addPlayer(m, 0, "  Ravi ");
    expect(match.teams[0].players[4]).toEqual({ id, name: "Ravi" });
    expect(match.innings[0].wicketLimit).toBe(4);
    expect(ids(yetToBat(match, 0))).toContain(id);
    const fielder = addPlayer(m, 1, "Sid");
    expect(fielder.match.innings[0].wicketLimit).toBe(3);
    expect(canBowl(fielder.match, 0, fielder.id)).toBe(true);
    expect(m.teams[0].players).toHaveLength(4);   // the original is untouched
  });

  it("addPlayer in solo puts them in the batting order on both lists", () => {
    const m = startSolo([{ id: "A", name: "A" }, { id: "B", name: "B" }]);
    const { match, id } = addPlayer(m, 0, "Cee");
    expect(ids(match.teams[0].players)).toEqual(["A", "B", id]);
    expect(ids(match.teams[1].players)).toEqual(["A", "B", id]);
    expect(upcomingBatters(match)).toEqual(["B", id]);
  });

  it("markLeft stops a player batting or bowling again without touching past balls", () => {
    let m = setBowler(dots(setup({ overs: 3 }), 6), "B2");
    m = play(m, r(4));
    const before = replay(m, 0);
    m = markLeft(m, "B1");
    expect(m.left).toEqual(["B1"]);
    expect(replay(m, 0).runs).toBe(before.runs);
    expect(replay(m, 0).bowl.get("B1")!.legal).toBe(6);
    m = dots(m, 5);
    expect(canBowl(m, 0, "B1")).toBe(false);
    expect(bowlerOptions(m).map((o) => o.id)).not.toContain("B1");
    expect(markLeft(m, "B1")).toBe(m);
    expect(markLeft(m, "nobody")).toBe(m);
  });

  it("a batter who left can't walk in, and the side loses that wicket", () => {
    let m = markLeft(setup(), "A4");
    expect(m.innings[0].wicketLimit).toBe(2);
    expect(ids(yetToBat(m, 0))).toEqual(["A3"]);
    m = play(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } });
    expect(afterWicket(m, 0).fresh).toEqual([]);
    m = play(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(m.status).toBe("break");
  });

  it("a retired batter who left can't come back", () => {
    let m = play(setup({}, 5), r(0));
    m = addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A4" } });
    m = { ...m, innings: [{ ...m.innings[0], events: [...m.innings[0].events, { t: "retire", out: "ns", newId: "A3" }] }] };
    expect(afterWicket(m, 0).back.map((p) => p.id)).toEqual(["A2"]);
    expect(afterWicket(markLeft(m, "A2"), 0).back).toEqual([]);
  });

  it("solo: a player who left loses the turns not yet started", () => {
    const P = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }];
    let m = startSolo(P, { ballsPerTurn: 1, rounds: 2 });
    m = addBall(m, r(2));   // A's turn ends
    m = markLeft(m, "B");
    expect(nextBatter(m)).toBe("C");
    expect(suggestedBowler(m)).not.toBe("B");
    expect(startTurn(m, "B")).toBe(m);
    m = addBall(startTurn(m)!, r(1));
    m = addBall(startTurn(m)!, r(1));   // round 2, A
    expect(m.innings.map((i) => i.striker)).toEqual(["A", "C", "A"]);
    m = addBall(startTurn(m)!, r(1));   // round 2, C
    expect(m.status).toBe("done");
  });
});

describe("ball lost", () => {
  it("is a dead ball: nothing counts and the over carries on", () => {
    let m = play(setup(), r(1), r(2));
    m = ballLost(m, "Into the drain");
    const st = replay(m, 0);
    expect([st.runs, st.legal, st.overs[0].length]).toEqual([3, 2, 2]);
    expect(m.innings[0].events[m.innings[0].events.length - 1]).toEqual({ t: "lost", reason: "Into the drain", striker: "A2", bowler: "B1" });
  });

  it("shows in ball-by-ball in its place", () => {
    let m = play(setup(), r(1), r(0), r(0), r(0), r(0), r(0));
    m = ballLost(m);
    m = play(setBowler(m, "B2"), r(4));
    expect(ballByBall(m, 0).map((o) => o.map((b) => b.label))).toEqual([["1", "•", "•", "•", "•", "•"], ["Lost", "4"]]);
    expect(ballByBall(m, 0)[1][0]).toEqual({ evIdx: 6, label: "Lost", lost: "Ball lost" });
  });

  it("undo takes it off and redo puts it back", () => {
    const m = ballLost(play(setup(), r(1)), "Over the wall");
    const { match, popped } = undo(m);
    expect(match.innings[0].events).toHaveLength(1);
    expect(redo(match, popped!).innings[0].events[1]).toMatchObject({ t: "lost", reason: "Over the wall" });
  });

  it("only while the innings is live", () => {
    const m = closeInnings(setup());
    expect(ballLost(m)).toBe(m);
  });
});

describe("rematch and evening tally", () => {
  const day = Date.UTC(2026, 10, 16, 12);

  it("rematch keeps teams, rules and players, and resets the toss and innings", () => {
    let m = changeRules(play(setup({ overs: 3 }), r(1)), { noLbw: true }, ["A1"]);
    m = markLeft(m, "B4");
    const next = rematch(m, day);
    expect(next.prevId).toBe(m.id);
    expect(next.id).not.toBe(m.id);
    expect(next.rules).toEqual(m.rules);
    expect(next.teams[0]).toEqual(m.teams[0]);
    expect(ids(next.teams[1].players)).toEqual(["B1", "B2", "B3"]);
    expect([next.toss, next.innings, next.status, next.createdAt]).toEqual([null, [], "setup", day]);
    expect(next.left).toBeUndefined();
    expect(next.rulesLockedAt).toBeUndefined();
  });

  /** A finished 1-over match, won by `winner` (side) or tied. */
  function finished(winner: 0 | 1 | null, at: number, prev?: Match): Match {
    let m = prev ? rematch(prev, at) : { ...fresh({ overs: 1 }), createdAt: at };
    m.toss = { winner: 0, choice: "bat" };
    m = startInnings(m, "A1", "A2", "B1");
    m = play(m, r(winner === 0 ? 2 : 1), ...Array.from({ length: 5 }, () => r(0)));
    m = startInnings(m, "B1", "B2", "A1");
    return play(m, r(winner === 1 ? 2 : 1), ...Array.from({ length: 5 }, () => r(0)));
  }

  it("counts wins per team across the chain on the same day", () => {
    const g1 = finished(0, day), g2 = finished(1, day + 1000, g1), g3 = finished(0, day + 2000, g2), g4 = finished(null, day + 3000, g3);
    const other = finished(1, day + 500);
    expect(result(g4)!.tie).toBe(true);
    const all = [g1, g2, g3, g4, other];
    const expected = { played: 4, drawn: 1, wins: [{ name: "A", wins: 2 }, { name: "B", wins: 1 }] };
    expect(eveningTally(all, g2)).toEqual(expected);   // works from the middle of the chain
    expect(eveningTally(all, g4)).toEqual(expected);
    expect(eveningTally(all, other)).toEqual({ played: 1, drawn: 0, wins: [{ name: "B", wins: 1 }, { name: "A", wins: 0 }] });
  });

  it("leaves out matches from another day and counts an unfinished one as not played", () => {
    const yesterday = finished(1, day - 86_400_000);
    const today = finished(0, day, yesterday);
    const live = rematch(today, day + 1000);
    expect(eveningTally([yesterday, today, live], live)).toEqual({ played: 1, drawn: 0, wins: [{ name: "A", wins: 1 }, { name: "B", wins: 0 }] });
  });
});

