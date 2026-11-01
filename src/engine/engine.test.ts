import { describe, expect, it } from "vitest";
import {
  addBall, awards, canBowl, closeInnings, editBall, minOvers, needsBowler, newMatch, redo, replay, result, retire, setBowler,
  setOvers, startInnings, swapStrike, undo, yetToBat,
} from "./engine";
import type { BallInput, Match, Rules, Team } from "./types";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 2, extraRun: true, rebowl: true, freeHit: true, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null, ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });

function setup(o: Partial<Rules> = {}, n = 4): Match {
  const m = newMatch([team("A", n), team("B", n)], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return startInnings(m, "A1", "A2", "B1");
}
const play = (m: Match, ...balls: BallInput[]) => balls.reduce(addBall, m);
const r = (runs: number): BallInput => ({ runs });

describe("scoring", () => {
  it("counts runs, legal balls and rotates strike on odd runs", () => {
    const st = replay(play(setup(), r(1), r(4), r(3)), 0);
    expect(st.runs).toBe(8);
    expect(st.legal).toBe(3);
    expect(st.striker).toBe("A1");
    expect(st.bat.get("A1")!.runs).toBe(1);
    expect(st.bat.get("A2")!.runs).toBe(7);
    expect(st.bat.get("A2")!.fours).toBe(1);
  });

  it("wide and no-ball add a run and are bowled again", () => {
    const st = replay(play(setup(), { runs: 0, extra: "wd" }, { runs: 4, extra: "nb" }), 0);
    expect(st.runs).toBe(6);
    expect(st.legal).toBe(0);
    expect(st.extras).toEqual({ wd: 1, nb: 1, b: 0, lb: 0 });
    expect(st.bat.get("A1")!.runs).toBe(4);
    expect(st.bat.get("A1")!.balls).toBe(1);
    expect(st.bowl.get("B1")!.runs).toBe(6);
  });

  it("can turn off the extra run and the re-bowl", () => {
    const st = replay(play(setup({ extraRun: false, rebowl: false }), { runs: 0, extra: "wd" }), 0);
    expect(st.runs).toBe(0);
    expect(st.legal).toBe(1);
  });

  it("byes go to extras, not the batter or the bowler", () => {
    const st = replay(play(setup(), { runs: 2, extra: "b" }, { runs: 1, extra: "lb" }), 0);
    expect(st.runs).toBe(3);
    expect(st.extras.b).toBe(2);
    expect(st.extras.lb).toBe(1);
    expect(st.bat.get("A1")!.runs).toBe(0);
    expect(st.bowl.get("B1")!.runs).toBe(0);
    expect(st.striker).toBe("A2");
  });

  it("swaps strike at the end of the over and asks for a new bowler", () => {
    let m = play(setup(), r(0), r(0), r(0), r(0), r(0), r(0));
    const st = replay(m, 0);
    expect(st.striker).toBe("A2");
    expect(st.bowl.get("B1")!.maidens).toBe(1);
    expect(needsBowler(m, 0)).toBe(true);
    expect(canBowl(m, 0, "B1")).toBe(false);
    m = setBowler(m, "B2");
    expect(needsBowler(m, 0)).toBe(false);
    m = addBall(m, r(1));
    expect(replay(m, 0).bowl.get("B2")!.runs).toBe(1);
  });

  it("caps overs per bowler", () => {
    let m = setup({ overs: 4, maxOversPerBowler: 1 });
    m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));
    m = setBowler(m, "B2");
    m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));
    expect(canBowl(m, 0, "B1")).toBe(false);
    expect(canBowl(m, 0, "B3")).toBe(true);
  });

  it("manual strike swap", () => {
    expect(replay(swapStrike(setup()), 0).striker).toBe("A2");
  });
});

describe("wickets", () => {
  it("brings in the new batter at the out end", () => {
    const m = play(setup(), { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } });
    const st = replay(m, 0);
    expect(st.wickets).toBe(1);
    expect(st.striker).toBe("A3");
    expect(st.bat.get("A1")!.out).toEqual({ kind: "bowled", bowler: "B1" });
    expect(st.bowl.get("B1")!.wickets).toBe(1);
    expect(yetToBat(m, 0).map((p) => p.id)).toEqual(["A4"]);
  });

  it("run out after a run: non-striker out, not the bowler's wicket", () => {
    const st = replay(play(setup(), { runs: 1, wicket: { kind: "run out", out: "ns", newId: "A3" } }), 0);
    expect(st.runs).toBe(1);
    expect(st.striker).toBe("A2");
    expect(st.nonStriker).toBe("A3");
    expect(st.bowl.get("B1")!.wickets).toBe(0);
  });

  it("all out ends the innings at players minus one", () => {
    const m = play(setup(),
      { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } },
      { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A4" } },
      { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(m.status).toBe("break");
  });

  it("last man stands bats alone without rotating strike", () => {
    let m = play(setup({ lastManStands: true }, 3),
      { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } },
      { runs: 0, wicket: { kind: "caught", out: "s", newId: null } });
    let st = replay(m, 0);
    expect(m.status).toBe("live");
    expect(st.striker).toBe("A2");
    expect(st.nonStriker).toBe(null);
    m = addBall(m, r(1));
    st = replay(m, 0);
    expect(st.striker).toBe("A2");
    m = addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(m.status).toBe("break");
  });

  it("free hit follows a no-ball and survives a wide", () => {
    let m = addBall(setup(), { runs: 0, extra: "nb" });
    expect(replay(m, 0).freeHit).toBe(true);
    m = addBall(m, { runs: 0, extra: "wd" });
    expect(replay(m, 0).freeHit).toBe(true);
    m = addBall(m, r(0));
    expect(replay(m, 0).freeHit).toBe(false);
  });
});

describe("innings and result", () => {
  const firstInnings = () => {
    let m = play(setup({ overs: 1 }), r(4), r(1), r(0), r(0), r(0), r(2));
    expect(m.status).toBe("break");
    return startInnings(m, "B1", "B2", "A1");
  };

  it("chase ends as soon as the target is passed", () => {
    const m = play(firstInnings(), r(6), r(2));
    expect(m.status).toBe("done");
    expect(result(m)!.text).toBe("B won by 3 wickets");
  });

  it("defending team wins by runs", () => {
    const m = play(firstInnings(), r(1), r(0), r(0), r(0), r(0), r(0));
    expect(result(m)!.text).toBe("A won by 6 runs");
  });

  it("tie then super over", () => {
    let m = play(firstInnings(), r(6), r(0), r(0), r(0), r(0), r(1));
    expect(result(m)!.tie).toBe(true);
    m = startInnings(m, "B1", "B2", "A1");
    expect(m.innings[2].bat).toBe(1);
    expect(m.innings[2].overs).toBe(1);
    m = play(m, r(6), r(0), r(0), r(0), r(0), r(0));
    m = startInnings(m, "A1", "A2", "B1");
    m = play(m, r(4), r(4));
    expect(result(m)!.text).toBe("A won by 2 wickets (super over)");
  });

  it("undo steps back into the first innings", () => {
    let m = firstInnings();
    m = undo(m).match;
    expect(m.innings.length).toBe(1);
    expect(m.status).toBe("break");
    m = undo(m).match;
    expect(m.status).toBe("live");
    expect(replay(m, 0).runs).toBe(5);
    expect(replay(m, 0).legal).toBe(5);
  });

  it("end innings by hand, and undo reopens it", () => {
    let m = closeInnings(addBall(setup(), r(1)));
    expect(m.status).toBe("break");
    m = undo(m).match;
    expect(m.status).toBe("live");
    expect(replay(m, 0).runs).toBe(1);
  });

  it("editing a past ball replays everything after it", () => {
    let m = play(setup(), r(1), r(1));
    m = editBall(m, 0, 0, { runs: 4 });
    const st = replay(m, 0);
    expect(st.runs).toBe(5);
    expect(st.striker).toBe("A2");
  });

  it("player of the match favours the winning side", () => {
    const m = play(firstInnings(), r(6), r(2));
    expect(awards(m).potm!.id).toBe("B1");
  });
});

describe("common player", () => {
  const C = { id: "C", name: "Chotu" };
  function withCommon(): Match {
    const a = team("A", 2), b = team("B", 2);
    a.players.push(C); b.players.push(C);
    const m = newMatch([a, b], rules({ overs: 1 }));
    m.toss = { winner: 0, choice: "bat" };
    return m;
  }

  it("counts toward both teams' wickets and bats in both innings", () => {
    let m = startInnings(withCommon(), "A1", "C", "B1");
    expect(m.innings[0].wicketLimit).toBe(2);
    m = play(m, r(1), r(4), r(0), r(0), r(0), r(0));
    expect(replay(m, 0).bat.get("C")!.runs).toBe(4);
    m = startInnings(m, "B1", "C", "A1");
    m = play(m, r(1), r(6));
    expect(replay(m, 1).bat.get("C")!.runs).toBe(6);
    expect(replay(m, 0).bat.get("C")!.runs).toBe(4);
  });

  it("cannot bowl while batting, and cannot walk in while bowling", () => {
    let m = startInnings(withCommon(), "A1", "C", "B1");
    m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));
    expect(canBowl(m, 0, "C")).toBe(false);
    const big = withCommon();
    for (const t of big.teams) t.players.splice(2, 0, { id: `${t.name}3`, name: `${t.name}3` });
    m = startInnings(big, "A1", "A2", "C");
    expect(yetToBat(m, 0).map((p) => p.id)).toEqual(["A3"]);
    m = play(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } });
    // Only the bowler is left, so they are offered rather than leaving no one to bat.
    expect(yetToBat(m, 0).map((p) => p.id)).toEqual(["C"]);
  });

  it("gets the winner's bonus whichever side wins", () => {
    let m = startInnings(withCommon(), "A1", "A2", "C");
    m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));
    m = startInnings(m, "C", "B1", "A1");
    m = play(m, r(1));
    expect(result(m)!.winner).toBe(1);
    expect(awards(m).potm!.id).toBe("C");
  });
});

describe("no bowler bowls two overs in a row", () => {
  const over = (m: Match) => play(m, r(0), r(0), r(0), r(0), r(0), r(0));

  it("asks again for a bowler after undoing and re-scoring the last ball of an over", () => {
    let m = over(setup());
    m = setBowler(m, "B2");
    m = play(m, r(1));
    m = undo(m).match;            // back to the new over's first ball
    m = undo(m).match;            // back into the last ball of over 1
    m = play(m, r(0));            // over 1 done again
    expect(needsBowler(m, 0)).toBe(true);
    expect(canBowl(m, 0, "B1")).toBe(false);
  });

  it("won't let the last over's bowler take over part-way through the next over", () => {
    let m = setBowler(over(setup()), "B2");
    m = play(m, r(0), r(0));
    expect(canBowl(m, 0, "B1")).toBe(false);
    expect(canBowl(m, 0, "B3")).toBe(true);
  });
});

describe("changing overs mid-match", () => {
  it("cuts the current innings and the rest of the match", () => {
    let m = setup({ overs: 5 });
    m = play(m, r(1), r(1), r(1), r(1), r(1), r(1), r(1));
    expect(minOvers(m)).toBe(2);
    m = setOvers(m, 2);
    expect(m.innings[0].overs).toBe(2);
    expect(m.rules.overs).toBe(2);
    m = play(m, r(0), r(0), r(0), r(0));
    expect(m.status).toBe("live");
    m = setBowler(m, "B3");
    m = addBall(m, r(0));
    expect(m.status).toBe("break");
    m = startInnings(m, "B1", "B2", "A1");
    expect(m.innings[1].overs).toBe(2);
  });

  it("never goes below balls already bowled, and ends the innings when cut to exactly that", () => {
    let m = play(setup({ overs: 5 }), r(0), r(0), r(0), r(0), r(0), r(0));
    m = setOvers(m, 0);
    expect(m.innings[0].overs).toBe(1);
    expect(m.status).toBe("break");
  });

  it("can raise the overs at the innings break for the chase", () => {
    let m = closeInnings(play(setup({ overs: 2 }), r(4)));
    m = setOvers(m, 4);
    expect(m.innings[0].overs).toBe(2);
    m = startInnings(m, "B1", "B2", "A1");
    expect(m.innings[1].overs).toBe(4);
  });
});

describe("batting alone", () => {
  it("an innings started with one batter lets every player bat", () => {
    const m0 = newMatch([team("A", 3), team("B", 3)], rules());
    m0.toss = { winner: 0, choice: "bat" };
    let m = startInnings(m0, "A1", null, "B1");
    expect(m.innings[0].wicketLimit).toBe(3);
    m = play(m, r(1));
    expect(replay(m, 0).striker).toBe("A1");
    m = play(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A2" } }, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "A3" } });
    expect(m.status).toBe("live");
    expect(replay(m, 0).nonStriker).toBe(null);
    m = addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(m.status).toBe("break");
  });
});

describe("retired batter", () => {
  it("is replaced, stays not out, and costs no wicket", () => {
    let m = play(setup(), r(2));
    m = retire(m, "s", "A3");
    const st = replay(m, 0);
    expect(st.striker).toBe("A3");
    expect(st.wickets).toBe(0);
    expect(st.bat.get("A1")).toMatchObject({ runs: 2, out: null, retired: true });
    expect(yetToBat(m, 0).map((p) => p.id)).toEqual(["A4"]);
  });

  it("with nobody to come in, the other batter carries on alone", () => {
    let m = retire(setup(), "ns", null);
    expect(replay(m, 0).nonStriker).toBe(null);
    expect(m.status).toBe("live");
    m = retire(m, "s", null);
    expect(m.status).toBe("break");
  });

  it("undo and redo bring the retirement back", () => {
    const m = retire(setup(), "s", "A3");
    const { match, popped } = undo(m);
    expect(replay(match, 0).striker).toBe("A1");
    expect(replay(redo(match, popped!), 0).striker).toBe("A3");
  });
});
