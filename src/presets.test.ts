import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import type { BallInput, Match } from "./engine/types";
import { applyPreset, BASE_RULES, PRESETS, preset, presetRules, type PresetId } from "./presets";

const team = (p: string, n: number) => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });

/** Starts a match from a preset the way the app would and plays a few balls. */
function start(id: PresetId): Match {
  const rules = applyPreset(id), n = id === "double-wicket" ? 2 : 8, people = team("P", 4).players;
  if (rules.format === "french") return E.startFrench(people, rules);
  if (rules.format === "solo") return E.startSolo(people, rules);
  const m = E.newMatch([team("A", n), team("B", n)], rules);
  return E.startInnings(m, "A1", "A2", "B1");
}
const balls: BallInput[] = [{ runs: 1 }, { runs: 4 }, { runs: 0 }, { runs: 6 }, { runs: 0, extra: "wd" }, { runs: 2 }];

describe("presets", () => {
  it("has the fourteen named formats, each with a one-line description", () => {
    expect(PRESETS.map((p) => p.name)).toEqual([
      "Gully classic", "Tip and run", "Compulsory run", "Box cricket", "Pairs box cricket", "Double wicket", "Sixes only",
      "Tape ball", "Office cricket", "100 balls", "French cricket", "Solo", "Solo Test", "Test",
    ]);
    for (const p of PRESETS) expect(p.description).toMatch(/^[A-Z].+\.$/);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it("returns the rules and format each preset sets", () => {
    expect(presetRules("tip-and-run")).toMatchObject({ mustRun: "touch" });
    expect(presetRules("compulsory-run")).toMatchObject({ mustRun: "every-hit" });
    expect(presetRules("box")).toMatchObject({ walls: { side: 1, back: 4, fullBack: 6 }, wicketPenalty: 5, dotBallsOut: 3 });
    expect(presetRules("box-pairs")).toMatchObject({ format: "pairs", overs: 16, pairOvers: 4 });
    expect(presetRules("double-wicket").format).toBe("pairs");
    expect(presetRules("sixes-only")).toMatchObject({ onlyBoundaries: true });
    expect(presetRules("hundred")).toMatchObject({ inningsBalls: 100, ballsPerOver: 5 });
    expect(presetRules("french").format).toBe("french");
    expect(presetRules("solo").format).toBe("solo");
    expect(presetRules("test").format).toBe("test");
    expect(presetRules("gully").format).toBeUndefined();
    expect(preset("office")?.name).toBe("Office cricket");
  });

  it("hands back a copy, so changing it doesn't change the preset", () => {
    presetRules("box").overs = 99;
    expect(presetRules("box").overs).toBe(6);
  });

  it("switching presets leaves nothing of the last one behind", () => {
    const box = applyPreset("box");
    const gully = applyPreset("gully", { ...box, rotateUmpire: true });
    expect(gully).toEqual({ ...BASE_RULES, rotateUmpire: true, ...presetRules("gully") });
    expect(gully.walls).toBeUndefined();
    expect(gully.wicketPenalty).toBeUndefined();
  });

  it("every preset starts and scores a few balls", () => {
    for (const p of PRESETS) {
      let m = start(p.id);
      expect(m.status, p.id).toBe("live");
      for (const b of balls) m = E.addBall(m, b);
      const st = E.replay(m, m.innings.length - 1);
      expect(st.legal, p.id).toBe(5);
      expect(E.formatText(m).length, p.id).toBeGreaterThan(0);
      expect(E.rulesCard(m).length, p.id).toBeGreaterThan(0);
    }
  });

  it("box cricket scores the walls it promises", () => {
    let m = start("box");
    m = E.addBall(m, { runs: 0, wall: "back" });
    m = E.addBall(m, { runs: 0, wall: "fullBack" });
    expect(E.replay(m, 0).runs).toBe(10);
  });
});
