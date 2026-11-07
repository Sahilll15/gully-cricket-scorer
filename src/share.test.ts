import { describe, expect, it } from "vitest";
import { addBall, newMatch, startInnings } from "./engine/engine";
import type { BallInput, Match, Team } from "./engine/types";
import { summaryText } from "./share";
import { playerPool } from "./stats";

const team = (p: string, names: string[]): Team => ({ name: p, players: names.map((n, i) => ({ id: `${p}${i}`, name: n })) });
const rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null } as const;

function played(): Match {
  const m = newMatch([team("Lions", ["Rahul", "Amit", "Player 3"]), team("Tigers", ["Sam", "Zaid"])], { ...rules });
  m.toss = { winner: 0, choice: "bat" };
  const balls: BallInput[] = [{ runs: 4 }, { runs: 1 }, { runs: 0, wicket: { kind: "bowled", out: "s", newId: "Lions2" } }];
  return balls.reduce(addBall, startInnings(m, "Lions0", "Lions1", "Tigers0"));
}

describe("full scorecard text", () => {
  it("lists every batter with how they got out, then the bowling", () => {
    const t = summaryText(played());
    expect(t).toContain("*Lions 5/1 (0.3 ov)*");
    expect(t).toContain("Rahul 5 (2), not out");
    expect(t).toContain("Amit 0 (1), b Sam");
    expect(t).toContain("Bowling: Sam 0.3-0-5-1");
    expect(t.indexOf("Rahul")).toBeLessThan(t.indexOf("Bowling"));
  });
});

describe("player pool", () => {
  it("collects named players from matches and saved teams once, skipping placeholders", () => {
    const pool = playerPool([played()], [{ players: [{ name: "rahul" }, { name: "Kabir" }] }]);
    expect(pool).toEqual(["Rahul", "Amit", "Sam", "Zaid", "Kabir"]);
  });
});
