import { describe, expect, it } from "vitest";
import { addBall, newMatch, startInnings } from "./engine/engine";
import type { Match } from "./engine/types";
import { soloMatch, teamMatch } from "./fixtures.test-util";
import { contribution, matchAwards, matchPace, mvp } from "./mvp";

const row = (m: Match, id: string) => mvp(m).find((r) => r.id === id)!;

describe("mvp points", () => {
  it("scores runs, boundaries, wickets and the economy bonus against the match pace", () => {
    const m = teamMatch();
    expect(matchPace(m)).toBeCloseTo(9.3);
    expect(row(m, "Lions2")).toMatchObject({ runs: 9, balls: 9, sixes: 1, batting: 11, bowling: 0, points: 11 });
    // 12 off the over is dearer than the match pace, so no bonus on top of the wicket.
    expect(row(m, "Tigers0")).toMatchObject({ wickets: 1, conceded: 12, bowling: 20, batting: 3, points: 23 });
    // 3 off an over against a pace of 9.3 earns the full 10.
    expect(row(m, "Tigers1")).toMatchObject({ bowling: 10, batting: 16, points: 26 });
    expect(row(m, "Lions0")).toMatchObject({ batting: 6, bowling: 6.6, points: 12.6 });
  });

  it("ranks best first and gives each player a side", () => {
    const rows = mvp(teamMatch());
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual(["Tigers1", "Tigers0", "Lions0"]);
    expect(rows[0].side).toBe(1);
  });

  it("rewards a strike rate faster than the match pace", () => {
    let m = newMatch([{ name: "A", players: [{ id: "a1", name: "a1" }, { id: "a2", name: "a2" }] }, { name: "B", players: [{ id: "b1", name: "b1" }, { id: "b2", name: "b2" }] }],
      { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null });
    m.toss = { winner: 0, choice: "bat" };
    m = [2, 2, 2, 2, 2, 2].reduce((x, runs) => addBall(x, { runs }), startInnings(m, "a1", "a2", "b1"));
    // Everyone scores at 12 an over, so 200 is exactly the pace: no bonus.
    expect(row(m, "a1").batting).toBe(12);
  });

  it("counts catches from the balls, so a solo life lost to a catch still counts", () => {
    const m = soloMatch();
    expect(row(m, "Chitra")).toMatchObject({ catches: 1, fielding: 8 });
    expect(row(m, "Asha").side).toBeNull();
  });
});

describe("match awards", () => {
  it("names all five with a one-line reason, skipping ones nobody earned", () => {
    const aw = matchAwards(teamMatch());
    expect(aw.map((a) => a.key)).toEqual(["potm", "hitter", "wickets", "economy"]);
    expect(aw[0]).toMatchObject({ title: "Player of the match", name: "Tigers B", line: "13 off 5, 0 for 3 · 26 points" });
    expect(aw[1]).toMatchObject({ title: "Super hitter", name: "Tigers B", line: "1 six in 13 off 5" });
    expect(aw[2]).toMatchObject({ title: "Wicket taker", name: "Tigers A", line: "1 for 12 in 1 over" });
    expect(aw[3]).toMatchObject({ title: "Economy king", name: "Tigers B", line: "3.0 an over across 1 over" });
  });

  it("gives Safe hands to the player with the most catches", () => {
    const safe = matchAwards(soloMatch()).find((a) => a.key === "catches");
    expect(safe).toMatchObject({ title: "Safe hands", name: "Chitra", line: "1 catch held" });
  });

  it("describes what a player did", () => {
    const r = row(soloMatch(), "Chitra");
    expect(contribution(r)).toBe("12 off 6, 0 for 6, 1 catch");
  });
});
