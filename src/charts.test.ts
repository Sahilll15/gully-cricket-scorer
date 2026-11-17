import { describe, expect, it } from "vitest";
import { barTicks, chartInnings, manhattan, overTicks, partnerships, runRates, ticks, turns, worm } from "./charts";
import { soloMatch, teamMatch } from "./fixtures.test-util";
import { result } from "./engine/engine";

describe("worm", () => {
  it("adds up runs over by over for both innings, with a dot where each wicket fell", () => {
    const [a, b] = worm(teamMatch());
    expect(a.label).toBe("Lions");
    expect(a.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 12 }, { x: 2, y: 15 }]);
    expect(a.wickets).toEqual([{ x: 0.5, y: 5 }]);
    expect(b.label).toBe("Tigers");
    expect(b.side).toBe(1);
    expect(b.points[b.points.length - 1]).toEqual({ x: 1 + 2 / 6, y: 16 });
  });

  it("draws one line per solo turn, named after the batter", () => {
    const lines = worm(soloMatch());
    expect(lines.map((l) => l.label)).toEqual(["Asha", "Bilal", "Chitra"]);
    expect(lines.map((l) => l.batter)).toEqual(["Asha", "Bilal", "Chitra"]);
    expect(lines[0].wickets).toEqual([{ x: 0.5, y: 10 }]);
  });

  it("leaves super overs out", () => {
    const m = teamMatch();
    m.innings.push({ ...m.innings[0], superOver: true });
    expect(chartInnings(m)).toEqual([0, 1]);
  });
});

describe("manhattan", () => {
  it("gives runs and wickets per over, extras included", () => {
    expect(manhattan(teamMatch(), 0)).toEqual([{ over: 1, runs: 12, wickets: 1 }, { over: 2, runs: 3, wickets: 0 }]);
    expect(manhattan(teamMatch(), 5)).toEqual([]);
  });
});

describe("run rates", () => {
  it("tracks the run rate and, in a chase, the rate still needed", () => {
    const m = teamMatch();
    expect(result(m)?.winner).toBe(1);
    const [first, chase] = runRates(m);
    expect(first.points.map((p) => p.y)).toEqual([12, 7.5]);
    expect(first.required).toEqual([null, null]);
    expect(chase.points[0].y).toBe(6);
    expect(chase.points[1].y).toBeCloseTo(12);
    expect(chase.required).toEqual([10, null]);
  });
});

describe("partnerships", () => {
  it("splits each stand into both batters' runs, extras and balls", () => {
    const [first, second] = partnerships(teamMatch(), 0);
    expect(first).toMatchObject({ wicket: 1, a: "Lions0", b: "Lions1", aRuns: 5, bRuns: 0, extras: 0, runs: 5, balls: 3, end: "out" });
    expect(second).toMatchObject({ wicket: 2, a: "Lions2", b: "Lions0", aRuns: 9, bRuns: 0, extras: 1, runs: 10, balls: 9, end: "unbroken" });
  });
});

describe("solo turns", () => {
  it("lists every turn's runs, balls and outs", () => {
    expect(turns(soloMatch()).map(({ label, runs, balls, outs }) => [label, runs, balls, outs]))
      .toEqual([["Asha", 10, 3, 1], ["Bilal", 6, 6, 0], ["Chitra", 12, 6, 0]]);
    expect(turns(teamMatch())).toEqual([]);
  });
});

describe("axis ticks", () => {
  it("rounds the top up to a friendly step", () => {
    expect(ticks(15)).toEqual([0, 5, 10, 15]);
    expect(ticks(0)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(ticks(41)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(ticks(37)).toEqual([0, 10, 20, 30, 40]);
    expect(overTicks(2)).toEqual([0, 1, 2]);
    expect(overTicks(11)).toEqual([0, 2, 4, 6, 8, 10, 11].filter((x) => x !== 10));
    expect(overTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(barTicks(3)).toEqual([1, 2, 3]);
    expect(barTicks(20)).toEqual([1, 5, 10, 15, 20]);
  });
});
