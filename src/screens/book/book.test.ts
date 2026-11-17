import { describe, expect, it } from "vitest";
import { bookData, milestoneFeed, RECORD_ROWS, recordDetail, shareSummary } from "./book";
import type { Records } from "../../records";

const DAY = 86_400_000;
const none: Records = {
  highestScore: null, bestBowling: null, mostSixesInnings: null, highestTotal: null, lowestAllOut: null,
  closestFinish: null, biggestWinRuns: null, biggestWinWickets: null, mostRunsInOver: null, biggestCollapse: null,
};

describe("gully book copy", () => {
  it("feeds milestones newest first and marks the last week as new", () => {
    const now = 100 * DAY;
    const feed = milestoneFeed([
      { name: "Aarav", items: [{ kind: "50", label: "First 50", matchId: "m1", date: 10 * DAY, count: 1 }] },
      { name: "Rohan", items: [{ kind: "hatTrick", label: "Hat-trick", matchId: "m2", date: 98 * DAY, count: 1 }] },
    ], now);
    expect(feed.map((f) => [f.line, f.isNew])).toEqual([["Rohan took a hat-trick", true], ["Aarav's first fifty", false]]);
  });

  it("drops the detail line when it only repeats the big number", () => {
    const bowl = RECORD_ROWS.find((r) => r.key === "bestBowling")!, bat = RECORD_ROWS.find((r) => r.key === "highestScore")!;
    expect(recordDetail(bowl, { value: 3, text: "3/12", name: "A", matchId: "m", date: 0 })).toBeNull();
    expect(bat.big({ value: 45, text: "45* (20)", name: "A", matchId: "m", date: 0 })).toBe("45*");
  });

  it("writes a short share text without blank gaps", () => {
    const text = shareSummary({ fmt: "limited", played: 1, since: null, runs: 1, sixes: 0, wickets: 2, ducks: 1, best: null, records: none });
    expect(text).toBe("Our Gully Book (limited overs)\n1 match\n1 run, 0 sixes, 2 wickets, 1 duck\n\nScored with ai.sahilchalke.com/score");
  });

  it("is empty with no matches", () => {
    const d = bookData([], [{ name: "Tigers" }], "test");
    expect(d.o.played).toBe(0);
    expect(d.best).toBeNull();
    expect(d.feed).toEqual([]);
    expect(d.teams).toEqual([{ name: "Tigers", current: 0, best: 0 }]);
  });
});
