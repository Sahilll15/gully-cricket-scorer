import { describe, expect, it } from "vitest";
import { addBall, declare, newMatch, startInnings, stopMatch } from "./engine";
import { endSeries, newSeries, endBody, nextRules, rulesLabel, seriesMatches, seriesScore, seriesSub, type Series } from "./series";
import type { BallInput, Match, Rules, Team } from "./types";

const rules: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string): Team => ({ name: p, players: [1, 2, 3].map((i) => ({ id: `${p}${i}`, name: `${p}${i}` })) });
const play = (m: Match, ...b: BallInput[]) => b.reduce(addBall, m);
const r = (runs: number): BallInput => ({ runs });

/** Side 0 is India. `winner` 0 or 1 wins, null ties. */
function game(s: Series, winner: 0 | 1 | null, at: number): Match {
  let m = newMatch([team("India"), team("Aus")], s.rules);
  m.createdAt = at;
  m.series = { id: s.id };
  m = startInnings(m, "India1", "India2", "Aus1");
  m = play(m, ...Array(6).fill(r(winner === 0 ? 2 : 1)));
  m = startInnings(m, "Aus1", "Aus2", "India1");
  return play(m, ...(winner === 1 ? [r(4), r(4)] : Array(6).fill(r(1))));
}

describe("series score", () => {
  const s = newSeries("Border Gavaskar", "india", "aus", 5, rules);

  it("starts level with match 1 next", () => {
    expect(seriesScore(s, [])).toMatchObject({ a: 0, b: 0, drawn: 0, played: 0, next: 1, winner: null });
  });

  it("counts wins for each side and names the leader", () => {
    const ms = [game(s, 0, 1), game(s, 1, 2), game(s, 0, 3)];
    const sc = seriesScore(s, ms);
    expect(sc).toMatchObject({ a: 2, b: 1, played: 3, next: 4, winner: null });
    expect(sc.text(["India", "Aus"])).toBe("India lead 2-1");
    expect(sc.tally(["India", "Aus"])).toBe("India 2, Aus 1");
  });

  it("ties count as drawn, level series reads level", () => {
    const sc = seriesScore(s, [game(s, 0, 1), game(s, 1, 2), game(s, null, 3)]);
    expect(sc).toMatchObject({ a: 1, b: 1, drawn: 1 });
    expect(sc.text(["India", "Aus"])).toBe("Level 1-1");
  });

  it("a side that can't be caught has clinched, and the rest can still be played", () => {
    const sc = seriesScore(s, [game(s, 1, 1), game(s, 1, 2), game(s, 1, 3)]);
    expect(sc).toMatchObject({ clinched: true, leader: 1, winner: null, done: false, next: 4 });
    expect(sc.text(["India", "Aus"])).toBe("Aus have clinched the series 3-0");
  });

  it("finishes after the last match, drawn if level", () => {
    const s2 = newSeries("Two", "india", "aus", 2, rules);
    const sc = seriesScore(s2, [game(s2, 0, 1), game(s2, 1, 2)]);
    expect(sc).toMatchObject({ next: null, done: true, winner: null });
    expect(sc.text(["India", "Aus"])).toBe("Series tied 1-1");
  });

  it("an unfinished match is the one to carry on, not a new one", () => {
    let m = newMatch([team("India"), team("Aus")], rules);
    m.series = { id: s.id };
    m = startInnings(m, "India1", "India2", "Aus1");
    const sc = seriesScore(s, [game(s, 0, 1), m]);
    expect(sc).toMatchObject({ played: 1, next: null, current: m.id });
  });

  it("only its own matches count", () => {
    const other = game(newSeries("x", "a", "b", 3, rules), 0, 1);
    const plain = game(s, 0, 2);
    delete plain.series;
    expect(seriesMatches(s, [other, plain])).toHaveLength(0);
  });
});

describe("open series", () => {
  const s = newSeries("Sunday", "india", "aus", null, rules);
  const names: [string, string] = ["India", "Aus"];

  it("has no plan, no clinch and always a next match", () => {
    const sc = seriesScore(s, [game(s, 0, 1), game(s, 0, 2), game(s, 0, 3)]);
    expect(sc).toMatchObject({ planned: null, clinched: false, done: false, winner: null, next: 4, leader: 0 });
    expect(sc.text(names)).toBe("India lead 3-0");
    expect(seriesScore(s, []).text(names)).toBe("Open series");
  });

  it("ending it names the side with more wins", () => {
    const sc = seriesScore(endSeries(s), [game(s, 0, 1), game(s, 1, 2), game(s, 1, 3)]);
    expect(sc).toMatchObject({ done: true, winner: 1, next: null });
    expect(sc.text(names)).toBe("Aus win the series 2-1");
  });

  it("equal wins ends as tied, ties between teams are not wins", () => {
    const sc = seriesScore(endSeries(s), [game(s, 0, 1), game(s, 1, 2), game(s, null, 3)]);
    expect(sc).toMatchObject({ done: true, winner: null, drawn: 1 });
    expect(sc.text(names)).toBe("Series tied 1-1");
  });

  it("ending with no matches played is a tie at 0-0", () => {
    expect(seriesScore(endSeries(s), []).text(names)).toBe("Series tied 0-0");
  });

  it("endSeries keeps the first end time", () => {
    const e = endSeries({ ...s, ended: 5 });
    expect(e.ended).toBe(5);
  });

  it("a planned series can be ended early after a clinch", () => {
    const p = newSeries("Three", "india", "aus", 3, rules);
    const ms = [game(p, 0, 1), game(p, 0, 2)];
    expect(seriesScore(p, ms)).toMatchObject({ clinched: true, done: false, next: 3 });
    expect(seriesScore(endSeries(p), ms)).toMatchObject({ done: true, winner: 0 });
  });

  it("each match keeps its own rules and the next one defaults to the last", () => {
    const first = game(s, 0, 1);
    const second = game(s, 1, 2);
    second.rules = { ...rules, overs: 10 };
    expect(nextRules(s, [])).toBe(s.rules);
    expect(nextRules(s, [second, first]).overs).toBe(10);
  });

  it("a series saved before open series (fixed games, no ended) still scores", () => {
    const old = { id: "old", name: "Old", createdAt: 1, a: "india", b: "aus", games: 2, rules } as Series;
    const ms = [game(old, 0, 1), game(old, 1, 2)];
    const sc = seriesScore(old, ms);
    expect(sc).toMatchObject({ planned: 2, done: true, winner: null });
    expect(sc.text(names)).toBe("Series tied 1-1");
    const nogames = { id: "o2", name: "O", createdAt: 1, a: "india", b: "aus", rules } as Series;
    expect(seriesScore(nogames, []).planned).toBe(null);
  });
});

describe("series copy", () => {
  const s = newSeries("Sunday", "india", "aus", null, rules);
  const names: [string, string] = ["India", "Aus"];
  it("describes the plan and what ending will say", () => {
    expect(seriesSub(s, seriesScore(s, [game(s, 0, 1)]))).toBe("Open series · 1 played");
    const p = newSeries("P", "india", "aus", 3, rules);
    expect(seriesSub(p, seriesScore(p, []))).toBe("3 matches planned · 0 played");
    expect(endBody(s, [game(s, 0, 1), game(s, 0, 2), game(s, 1, 3)], names)).toBe("India 2, Aus 1. India win the series 2-1.");
    expect(endBody(s, [game(s, 0, 1), game(s, 1, 2)], names)).toBe("India 1, Aus 1. Series tied 1-1.");
    expect(rulesLabel(rules)).toBe("1 over");
    expect(rulesLabel({ ...rules, format: "test", matchOvers: 30 })).toBe("Test, 30 overs max");
  });
});

describe("Test series", () => {
  it("draws count as drawn, wins as wins", () => {
    const s = newSeries("Ashes", "india", "aus", 3, { ...rules, format: "test" });
    let draw = newMatch([team("India"), team("Aus")], s.rules);
    draw.series = { id: s.id };
    draw = startInnings(draw, "India1", "India2", "Aus1");
    draw = stopMatch(play(draw, r(4)));
    let win = newMatch([team("India"), team("Aus")], s.rules);
    win.series = { id: s.id };
    win = startInnings(win, "India1", "India2", "Aus1");
    win = declare(play(win, r(6), r(6)));
    win = startInnings(win, "Aus1", "Aus2", "India1");
    win = play(win, ...Array(2).fill({ runs: 0, wicket: { kind: "bowled", out: "s", newId: null } }));
    win = startInnings(win, "Aus1", "Aus2", "India1", { followOn: true });
    win = play(win, ...Array(2).fill({ runs: 0, wicket: { kind: "bowled", out: "s", newId: null } }));
    const sc = seriesScore(s, [draw, win]);
    expect(sc).toMatchObject({ a: 1, b: 0, drawn: 1, played: 2, next: 3 });
  });
});
