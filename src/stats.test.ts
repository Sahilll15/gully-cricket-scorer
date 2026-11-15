import { describe, expect, it } from "vitest";
import { addBall, afterWicket, newMatch, startInnings } from "./engine/engine";
import type { BallInput, Match, Rules, Team } from "./engine/types";
import { bowlAverage, bowlStrikeRate, fmtOf, leaders, profile } from "./stats";

const base: Rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string): Team => ({ name: p, players: [1, 2, 3, 4].map((i) => ({ id: `${p}${i}`, name: `${p}${i}` })) });
const play = (m: Match, ...b: BallInput[]) => b.reduce(addBall, m);
const r = (runs: number): BallInput => ({ runs });
const out = (m: Match, kind: "bowled" | "caught" | "stumped" | "run out", fielderId?: string): Match =>
  addBall(m, { runs: 0, wicket: { kind, out: "s", newId: afterWicket(m, m.innings.length - 1).fresh[0]?.id ?? null, ...(fielderId && { fielderId }) } });

/** A1 faces 6 balls and makes 12, then is caught by B2 off B1. */
function limited(): Match {
  let m = newMatch([team("A"), team("B")], base);
  m = startInnings(m, "A1", "A2", "B1");
  m = play(m, r(2), r(0), r(4), r(6), r(0), { runs: 0, extra: "wd" });
  m = out(m, "caught", "B2");
  return m;
}
/** Same players in a Test: A1 makes 2 off 9, stumped by B3. B1 bowls a maiden. */
function test(): Match {
  let m = newMatch([team("A"), team("B")], { ...base, format: "test" });
  m = startInnings(m, "A1", "A2", "B1");
  m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));
  m = play(m, r(1), r(2), r(0));                               // A2 takes a single, A1 back on strike
  return out(m, "stumped", "B3");
}

describe("stats by format", () => {
  it("old matches with no format count as limited overs", () => {
    const m = limited();
    delete m.rules.format;
    expect(fmtOf(m)).toBe("limited");
    expect(fmtOf(test())).toBe("test");
  });

  it("never mixes Test and limited-overs batting", () => {
    const all = [limited(), test()];
    const lim = profile(all, "A1", "limited"), tst = profile(all, "A1", "test");
    expect([lim.runs, lim.balls, lim.matches, lim.innings]).toEqual([12, 6, 1, 1]);
    expect([tst.runs, tst.balls, tst.matches, tst.innings]).toEqual([2, 9, 1, 1]);
    expect(leaders(all, "limited").find((x) => x.name === "A1")!.runs).toBe(12);
    expect(leaders(all, "test").find((x) => x.name === "A1")!.runs).toBe(2);
  });

  it("keeps bowling and fielding apart too", () => {
    const all = [limited(), test()];
    expect(profile(all, "B2", "limited").catches).toBe(1);
    expect(profile(all, "B2", "test").catches).toBe(0);
    expect(profile(all, "B3", "test").stumpings).toBe(1);
    expect(profile(all, "B3", "limited").stumpings).toBe(0);
    expect(profile(all, "B1", "test").maidens).toBe(1);
    expect(profile(all, "B1", "limited").maidens).toBe(0);
  });
});

describe("bowling", () => {
  it("counts overs, runs, wickets, maidens, wides and no-balls", () => {
    let m = newMatch([team("A"), team("B")], base);
    m = startInnings(m, "A1", "A2", "B1");
    m = play(m, r(0), r(0), r(0), r(0), r(0), r(0));           // maiden
    m = play(m, r(1), { runs: 0, extra: "wd" }, { runs: 2, extra: "nb" }, r(4));
    m = out(m, "bowled");
    m = out(m, "caught", "B1");                                  // caught and bowled
    const p = profile([m], "B1", "limited");
    expect(p.legal).toBe(10);
    expect(p.conceded).toBe(1 + 1 + 3 + 4);
    expect(p.wickets).toBe(2);
    expect(p.maidens).toBe(1);
    expect(p.wides).toBe(1);
    expect(p.noBalls).toBe(1);
    expect(p.catches).toBe(1);
    expect([p.bestW, p.bestR]).toEqual([2, 9]);
    expect(bowlAverage(p)).toBe(4.5);
    expect(bowlStrikeRate(p)).toBe(5);
  });

  it("average and strike rate are empty with no wickets", () => {
    const p = profile([limited()], "A1", "limited");
    expect(bowlAverage(p)).toBe(null);
    expect(bowlStrikeRate(p)).toBe(null);
  });
});

describe("fielding", () => {
  it("credits catches, run outs and stumpings to the named fielder", () => {
    let m = newMatch([team("A"), team("B")], base);
    m = startInnings(m, "A1", "A2", "B1");
    m = out(m, "caught", "B4");
    m = out(m, "run out", "B4");
    m = out(m, "stumped", "B4");
    const p = profile([m], "B4", "limited");
    expect([p.catches, p.runOuts, p.stumpings]).toEqual([1, 1, 1]);
    expect(p.matches).toBe(1);
    const row = leaders([m], "limited").find((x) => x.name === "B4")!;
    expect([row.catches, row.runOuts, row.stumpings]).toEqual([1, 1, 1]);
  });

  it("a wicket with no fielder named credits nobody", () => {
    let m = newMatch([team("A"), team("B")], base);
    m = startInnings(m, "A1", "A2", "B1");
    m = out(m, "caught");
    expect(leaders([m], "limited").reduce((s, x) => s + x.catches, 0)).toBe(0);
  });
});
