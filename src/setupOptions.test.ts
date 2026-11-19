import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import { applyPreset, PRESETS } from "./presets";
import { buildTeams, DEFAULT_RULES, forMatch, modeOf, pairsOf, presetMatches, protectIds, setWallChoice, shows, withMode } from "./setupOptions";

describe("setup options", () => {
  it("every preset lights its own card and switches to its format", () => {
    for (const p of PRESETS) {
      const r = applyPreset(p.id, DEFAULT_RULES), mode = modeOf(r), test = r.format === "test";
      expect(presetMatches(p.id, r, mode, test), p.id).toBe(true);
      expect(mode).toBe(p.id === "box-pairs" || p.id === "double-wicket" ? "pairs" : p.id === "solo" || p.id === "solo-test" ? "solo" : p.id === "french" ? "french" : "teams");
    }
  });

  it("an edit after a preset turns its card off", () => {
    const r = applyPreset("box", DEFAULT_RULES);
    expect(presetMatches("box", { ...r, dotBallsOut: 4 }, "teams", false)).toBe(false);
    expect(presetMatches("gully", r, "teams", false)).toBe(false);
  });

  it("drops options that don't fit the format", () => {
    const r = { ...DEFAULT_RULES, inningsBalls: 100, wicketPenalty: 5, retireAt: 20, maxOversPerBowler: 2, lives: 2 };
    const test = forMatch(r, "teams", true);
    expect(test).toMatchObject({ format: "test", maxOversPerBowler: null, retireAt: 20 });
    expect(test.inningsBalls).toBeUndefined();
    expect(test.wicketPenalty).toBeUndefined();
    const pairs = forMatch(r, "pairs", false);
    expect(pairs).toMatchObject({ format: "pairs", wicketPenalty: 5 });
    expect(pairs.retireAt).toBeUndefined();
    expect(forMatch(r, "teams", false).format).toBeUndefined();
  });

  it("leaving solo puts limited overs back", () => {
    const solo = { ...DEFAULT_RULES, overs: 2, format: "solo" as const };
    expect(withMode(solo, "teams").overs).toBe(DEFAULT_RULES.overs);
    expect(withMode(DEFAULT_RULES, "pairs")).toMatchObject({ format: "pairs", wicketPenalty: 5 });
    expect(shows("protected", "solo", false)).toBe(false);
    expect(shows("matchOvers", "teams", true)).toBe(true);
  });

  it("box walls give each surface a value and replace the single wall rule", () => {
    const box = setWallChoice({ ...DEFAULT_RULES, wall: "four" }, "box");
    expect(box.wall).toBe("none");
    expect(E.wallValue(box, "back")).toBe(4);
    expect(setWallChoice(box, "six").walls).toBeUndefined();
  });

  it("pairs read two by two, an odd one out with the first opener, as the engine does", () => {
    expect(pairsOf(["a", "b", "c", "d", "e"])).toEqual([["a", "b"], ["c", "d"], ["e", "a"]]);
    const { teams } = buildTeams("A", "B", ["a1", "a2", "a3"], ["b1", "b2", "b3"], 3, 3, "");
    let m = E.newMatch(teams, forMatch(DEFAULT_RULES, "pairs", false));
    const ids = teams[0].players.map((p) => p.id);
    m = E.startInnings(m, ids[0], ids[1], teams[1].players[0].id);
    expect(m.innings[0].pairs).toEqual(pairsOf(ids));
  });

  it("protected players are picked by name and stored by id", () => {
    const { teams, common } = buildTeams("A", "B", ["Ravi"], ["Sam"], 2, 2, "Kid");
    expect(protectIds(teams, ["kid", "sam"]).sort()).toEqual([common!.id, teams[1].players[0].id].sort());
  });
});
