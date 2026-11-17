import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import type { BallInput, Match, Rules, Team } from "./engine/types";
import * as K from "./liveKit";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null, ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
function setup(o: Partial<Rules> = {}): Match {
  const m = E.newMatch([team("A"), team("B")], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return E.startInnings(m, "A1", "A2", "B1");
}
const add = (m: Match, i: BallInput) => ({ before: m, after: E.addBall(m, i), input: i });
const say = (m: Match, i: BallInput) => { const x = add(m, i); return K.commentary(x.before, x.after, x.input); };

describe("commentary", () => {
  it("calls boundaries with the batter's score, and wickets with the bowler", () => {
    const m = E.addBall(setup(), { runs: 4 });
    expect(say(m, { runs: 6 })).toBe("Six! A1 moves to 10");
    expect(say(setup(), { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } })).toBe("Out! Bowled by B1");
    expect(say(setup(), { runs: 1 })).toBe("One run, A1 on 1");
  });

  it("adds the score at the end of the over", () => {
    let m = setup();
    for (let i = 0; i < 5; i++) m = E.addBall(m, { runs: 1 });
    expect(say(m, { runs: 0 })).toBe("Dot ball. End of the over, 5 for 0");
  });

  it("reads overs by the match's balls an over", () => {
    let m = setup({ ballsPerOver: 4 });
    for (let i = 0; i < 3; i++) m = E.addBall(m, { runs: 0 });
    expect(say(m, { runs: 2 })).toBe("2 runs, A1 on 2. End of the over, 2 for 0");
  });
});

describe("notices", () => {
  it("explains a forced out and what a dismissal costs", () => {
    let m = setup({ dotBallsOut: 2, wicketPenalty: 3 });
    m = E.addBall(m, { runs: 0 });
    const x = add(m, { runs: 0 });
    expect(K.ballNotice(x.before, x.after, x.input)).toBe("A1 is out: 2 dot balls in a row. That dismissal costs 3 runs");
    expect(K.ballWasOut(x.before, x.after)).toBe(true);
  });

  it("says a protected player stays in", () => {
    const m = setup({ protectedPlayers: ["A1"] });
    expect(K.protectedNote(m, E.replay(m, 0))).toMatch(/Protected: A1/);
    const x = add(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(K.ballNotice(x.before, x.after, x.input)).toBe("A1 is protected and stays in, 5 runs off");
  });

  it("shows golden, power and Joker badges on the ball they fall on", () => {
    const m = setup({ goldenBall: { over: 1, ball: 1 }, powerBall: 1, jokerOver: 1 });
    expect(K.nextBallBadges(m, E.replay(m, 0))).toEqual(["Golden ball", "Power ball", "Joker over"]);
    expect(K.nextBallBadges(E.addBall(m, { runs: 1 }), E.replay(E.addBall(m, { runs: 1 }), 0))).toEqual(["Joker over"]);
  });
});

describe("wagon wheel", () => {
  it("sets a zone on a ball without changing the score, and redo keeps it", () => {
    const m = E.addBall(setup(), { runs: 4 }), z = K.setZone(m, 0, 0, 3);
    expect(z.innings[0].events[0]).toMatchObject({ zone: 3, runs: 4 });
    expect(E.replay(z, 0).runs).toBe(4);
    const u = E.undo(z);
    expect(E.redo(u.match, u.popped!).innings[0].events[0]).toMatchObject({ zone: 3 });
  });

  it("asks only after a scoring shot", () => {
    expect(K.wantsZone({ runs: 2 })).toBe(true);
    expect(K.wantsZone({ runs: 0 })).toBe(false);
    expect(K.wantsZone({ runs: 1, extra: "wd" })).toBe(false);
    expect(K.wantsZone({ runs: 0, wall: "back" })).toBe(true);
    expect(K.boxMode(rules({ walls: { back: 4 } }))).toBe(true);
    expect(K.zoneName(9)).toBe("Front wall");
  });
});

describe("rule changes", () => {
  it("reads numbers that are off as 0 and writes them back as null", () => {
    const m = setup(), f = K.ruleFields(m).find((x) => x.key === "retireAt")!;
    expect(K.fieldValue(m, f, {})).toBe(0);
    expect(K.setField({}, f, 0)).toEqual({ retireAt: null });
    expect(K.agreed(m, ["A1"])).toBe(false);
    expect(K.agreed(m, ["A1", "B2"])).toBe(true);
  });

  it("turf alerts fire once as each mark is crossed", () => {
    expect(K.turfAlert(10 * 60000 + 500, 10 * 60000 - 500)).toBe("10 minutes left on the turf");
    expect(K.turfAlert(9 * 60000, 8 * 60000)).toBeNull();
    expect(K.turfAlert(500, 0)).toBe("Time's up on the turf");
    expect(K.clock(65000)).toBe("1:05");
  });
});

describe("player left", () => {
  it("retires a batter who goes home and brings the next one in", () => {
    const m = K.leaveMatch(E.addBall(setup(), { runs: 1 }), "A2");
    const s = E.replay(m, 0);
    expect(m.left).toEqual(["A2"]);
    expect(s.striker).toBe("A3");
    expect(s.bat.get("A2")!.retired).toBe(true);
  });
});
