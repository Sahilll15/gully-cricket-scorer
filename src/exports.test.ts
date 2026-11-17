import { describe, expect, it } from "vitest";
import { cell, csvName, statsCsv } from "./csv";
import { soloMatch, teamMatch } from "./fixtures.test-util";
import { poster } from "./poster";
import { scoresheetHtml } from "./scoresheet";
import { canRematch, rematchMatch, tallyText } from "./afterMatch";

describe("stats csv", () => {
  it("has a header and one row per player, most runs first", () => {
    const lines = statsCsv([teamMatch()], "limited").trim().split("\r\n");
    expect(lines[0]).toBe("Player,Matches,Runs,Balls,Strike rate,Fours,Sixes,Wickets,Overs,Runs conceded,Economy,Maidens,Catches,Run outs,Stumpings");
    expect(lines[1]).toBe("Tigers B,1,13,5,260.0,1,1,0,1.0,3,3.00,0,0,0,0");
    expect(lines).toHaveLength(7);
  });

  it("quotes commas and quotes, and keeps names from running as formulas", () => {
    expect(cell('Raj, "Bhai"')).toBe('"Raj, ""Bhai"""');
    expect(cell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(cell(-3)).toBe("-3");
    expect(csvName("test", Date.UTC(2026, 10, 16))).toBe("gully-stats-test-2026-11-16.csv");
  });
});

describe("scoresheet", () => {
  it("prints every innings with batting, bowling, awards and MVP points", () => {
    const html = scoresheetHtml(teamMatch());
    expect(html).toContain("<h1>Lions vs Tigers</h1>");
    expect(html).toContain("Tigers won by");
    expect(html).toContain("Fall of wickets");
    expect(html).toContain("Economy king");
    expect(html).toContain("MVP points");
    expect(html.match(/<section>/g)).toHaveLength(2);
  });

  it("labels solo turns by the batter and escapes names", () => {
    const m = soloMatch();
    m.teams[0].players[0].name = m.teams[1].players[0].name = "<Asha>";
    const html = scoresheetHtml(m);
    expect(html).toContain("<h1>Solo, 3 players</h1>");
    expect(html).toContain("Standings");
    expect(html).toContain("<span>&lt;Asha&gt;</span>");
    expect(html).not.toContain("<Asha>");
  });
});

describe("posters", () => {
  it("puts the winner, margin, both scores and the top three on the team poster", () => {
    const p = poster(teamMatch());
    expect(p.headline).toBe("Tigers win");
    expect(p.margin).toMatch(/^by \d wickets?$/);
    expect(p.rows.map((r) => [r.name, r.score, r.won])).toEqual([["Lions", "15/1", false], ["Tigers", "16/0", true]]);
    expect(p.performers.map((r) => r.name)).toEqual(["Tigers B", "Tigers A", "Lions A"]);
    expect(p.star?.name).toBe("Tigers B");
  });

  it("shows the solo standings and the winner instead of two teams", () => {
    const p = poster(soloMatch());
    expect(p.solo).toBe(true);
    expect(p.headline).toBe("Chitra wins");
    expect(p.rows.map((r) => [r.name, r.score])).toEqual([["Chitra", "12"], ["Asha", "10"], ["Bilal", "6"]]);
    expect(p.star?.name).toBe("Chitra");
  });
});

describe("rematch", () => {
  it("swaps who bats first and links back to the last match", () => {
    const m = teamMatch(), n = rematchMatch(m, m.createdAt + 1000);
    expect(n.prevId).toBe(m.id);
    expect(n.toss).toEqual({ winner: 1, choice: "bat" });
    expect(n.status).toBe("setup");
    expect(canRematch(m)).toBe(true);
    expect(canRematch({ ...m, cup: { id: "c", fixtureId: "f" } })).toBe(false);
  });

  it("reads out the evening's tally once two rematches are done", () => {
    const a = teamMatch(), b = { ...teamMatch(), id: "b", prevId: a.id, createdAt: a.createdAt + 1000 };
    expect(tallyText([a], a)).toBeNull();
    expect(tallyText([a, b], b)).toBe("Tigers 2, Lions 0 tonight");
  });
});
