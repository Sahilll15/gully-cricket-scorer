import { describe, expect, it } from "vitest";
import {
  addBall, afterWicket, canFollowOn, declare, newMatch, nextBattingSide, otherSide, replay, result, retire, startInnings,
  stopMatch, testStatus, undo,
} from "./engine";
import type { Match, Rules, Team } from "./types";

const rules = (o: Partial<Rules> = {}): Rules => ({
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null, format: "test", ...o,
});
const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });

function testMatch(o: Partial<Rules> = {}, n = 4): Match {
  const m = newMatch([team("A", n), team("B", n)], rules(o));
  m.toss = { winner: 0, choice: "bat" };
  return startInnings(m, "A1", "A2", "B1");
}
const next = (m: Match, followOn = false): Match => {
  const side = nextBattingSide(m, followOn), bat = m.teams[side].players, bowl = m.teams[otherSide(side)].players;
  return startInnings(m, bat[0].id, bat[1].id, bowl[0].id, followOn ? { followOn: true } : undefined);
};
const score = (m: Match, runs: number): Match => {
  for (; runs > 0; runs -= Math.min(6, runs)) m = addBall(m, { runs: Math.min(6, runs) });
  return m;
};
const wicket = (m: Match): Match =>
  addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: afterWicket(m, m.innings.length - 1).fresh[0]?.id ?? null } });
const allOut = (m: Match): Match => { while (m.status === "live") m = wicket(m); return m; };
/** Plays one full innings: `runs`, then all out. */
const inn = (m: Match, runs: number) => allOut(score(m, runs));

describe("test match innings", () => {
  it("has no over limit", () => {
    let m = testMatch();
    for (let i = 0; i < 120; i++) m = addBall(m, { runs: 0 });
    expect(replay(m, 0).legal).toBe(120);
    expect(m.status).toBe("live");
  });

  it("bats A, B, A, B without a super over", () => {
    let m = inn(testMatch(), 50);
    expect(m.status).toBe("break");
    m = inn(next(m), 40);
    m = inn(next(m), 30);
    m = next(m);
    expect(m.innings.map((i) => i.bat)).toEqual([0, 1, 0, 1]);
    expect(m.innings.some((i) => i.superOver)).toBe(false);
  });

  it("a declaration ends the innings, and undo takes it back", () => {
    let m = declare(score(testMatch(), 30));
    expect(m.status).toBe("break");
    expect(m.innings[0].declared).toBe(true);
    expect(replay(m, 0).ended).toBe(true);
    m = undo(m).match;
    expect(m.status).toBe("live");
    expect(m.innings[0].declared).toBeFalsy();
  });

  it("the retired-batter rule still ends a Test innings as all out", () => {
    let m = testMatch({}, 3);
    m = retire(m, "s", "A3");
    m = addBall(m, { runs: 0, wicket: { kind: "bowled", out: "s", newId: null } });
    expect(replay(m, 0).allOut).toBe(true);
    expect(m.status).toBe("break");
  });

  it("last man stands lets the last batter bat on", () => {
    let m = testMatch({ lastManStands: true });
    for (let i = 0; i < 3; i++) m = wicket(m);
    expect(m.status).toBe("live");
    m = wicket(m);
    expect(m.status).toBe("break");
  });
});

describe("follow-on", () => {
  it("is offered only when the side batting first leads", () => {
    let m = inn(testMatch(), 100);
    m = inn(next(m), 30);
    expect(canFollowOn(m)).toBe(true);
    let level = inn(testMatch(), 30);
    level = inn(next(level), 30);
    expect(canFollowOn(level)).toBe(false);
  });

  it("not enforced: the side batting first bats again", () => {
    let m = inn(testMatch(), 100);
    m = inn(next(m), 30);
    m = next(m);
    expect(m.innings[2].bat).toBe(0);
    m = inn(m, 20);
    expect(m.status).toBe("break");
    expect(testStatus(m)).toBe("B need 91 to win");
  });

  it("enforced: the side batting second bats again and loses by an innings", () => {
    let m = inn(testMatch(), 100);
    m = inn(next(m), 30);
    m = next(m, true);
    expect(m.innings[2].bat).toBe(1);
    expect(m.innings[2].followOn).toBe(true);
    m = inn(m, 40);
    expect(m.status).toBe("done");
    expect(result(m)!.text).toBe("A won by an innings and 30 runs");
    expect(result(m)!.winner).toBe(0);
  });

  it("enforced, and the side following on gets ahead: the first side chases", () => {
    let m = inn(testMatch(), 100);
    m = inn(next(m), 30);
    m = inn(next(m, true), 100);
    expect(m.status).toBe("break");
    m = next(m);
    expect(m.innings[3].bat).toBe(0);
    expect(testStatus(m)).toBe("A need 31 to win");
    m = score(m, 31);
    expect(result(m)!.text).toBe("A won by 3 wickets");
  });

  it("is ignored when it isn't allowed", () => {
    let m = inn(testMatch(), 30);
    m = inn(next(m), 60);
    m = next(m, true);
    expect(m.innings[2].bat).toBe(0);
    expect(m.innings[2].followOn).toBeFalsy();
  });
});

describe("test match results", () => {
  it("an innings win without the follow-on", () => {
    let m = inn(testMatch(), 30);
    m = inn(next(m), 100);
    m = inn(next(m), 40);
    expect(m.status).toBe("done");
    expect(result(m)!.text).toBe("B won by an innings and 30 runs");
  });

  it("4th innings chase won, by wickets left", () => {
    let m = inn(testMatch(), 50);
    m = inn(next(m), 40);
    m = inn(next(m), 30);
    m = next(m);
    expect(testStatus(m)).toBe("B need 41 to win");
    m = wicket(m);
    m = score(m, 41);
    expect(m.status).toBe("done");
    expect(result(m)!.text).toBe("B won by 2 wickets");
    expect(result(m)!.winner).toBe(1);
  });

  it("4th innings chase lost, by runs", () => {
    let m = inn(testMatch(), 50);
    m = inn(next(m), 40);
    m = inn(next(m), 30);
    m = inn(next(m), 20);
    expect(result(m)!.text).toBe("A won by 20 runs");
  });

  it("tie when the chasing side is all out with scores level", () => {
    let m = inn(testMatch(), 50);
    m = inn(next(m), 40);
    m = inn(next(m), 30);
    m = inn(next(m), 40);
    const res = result(m)!;
    expect(res.text).toBe("Match tied");
    expect(res.tie).toBe(true);
  });

  it("stopping before a result is a draw", () => {
    let m = inn(testMatch(), 50);
    m = inn(next(m), 40);
    m = inn(next(m), 30);
    m = score(next(m), 20);
    m = stopMatch(m);
    expect(m.status).toBe("done");
    const res = result(m)!;
    expect(res.text).toBe("Match drawn");
    expect(res.draw).toBe(true);
    expect(res.winner).toBe(null);
    m = undo(m).match;
    expect(m.status).toBe("live");
  });

  it("an overs cap ends the match as a draw", () => {
    let m = testMatch({ matchOvers: 2 });
    for (let i = 0; i < 6; i++) m = addBall(m, { runs: 1 });
    m = declare(m);
    m = next(m);
    for (let i = 0; i < 5; i++) m = addBall(m, { runs: 0 });
    expect(m.status).toBe("live");
    m = addBall(m, { runs: 0 });
    expect(m.status).toBe("done");
    expect(result(m)!.text).toBe("Match drawn");
  });

  it("shows the live lead", () => {
    let m = inn(testMatch(), 50);
    m = next(m);
    expect(testStatus(m)).toBe("A lead by 50");
    m = score(m, 66);
    expect(testStatus(m)).toBe("B lead by 16");
  });
});

describe("limited overs is unchanged", () => {
  it("a match without a format still ends after its overs and plays a super over on a tie", () => {
    const m0 = newMatch([team("A"), team("B")], { ...rules(), format: undefined, overs: 1 });
    let m = startInnings(m0, "A1", "A2", "B1");
    for (let i = 0; i < 6; i++) m = addBall(m, { runs: 1 });
    expect(m.status).toBe("break");
    m = startInnings(m, "B1", "B2", "A1");
    for (let i = 0; i < 6; i++) m = addBall(m, { runs: 1 });
    expect(result(m)!.text).toBe("Match tied");
    m = startInnings(m, "B1", "B2", "A1");
    expect(m.innings[2].superOver).toBe(true);
    expect(m.innings[2].bat).toBe(1);
  });
});
