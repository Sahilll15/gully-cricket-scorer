import { describe, expect, it } from "vitest";
import {
  bookData, defaultDuel, defaultRivalry, heroRecords, HERO_RECORD_KEYS, milestoneFeed, RECORD_GROUPS, RECORD_ROWS, recordDetail, recordGroups, SECTIONS,
  SHAME, SHAME_FIRST, shameLead, shareSummary, topList,
} from "./book";
import { addBall, newMatch, startInnings } from "../../engine/engine";
import type { BallInput, Match, Rules, Team } from "../../engine/types";
import { careerSpeed, records, type Records } from "../../records";

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

const base: Rules = { overs: 1, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null };
const team = (p: string): Team => ({ name: p, players: Array.from({ length: 4 }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}` })) });
const r = (runs: number): BallInput => ({ runs });
const zeros = (n: number): BallInput[] => Array.from({ length: n }, () => r(0));

/** One over each way: a's 1 and 2 open and b's 1 bowls, then the reverse. Second innings score is chase. */
function game(a: string, b: string, first: BallInput[], chase: BallInput[], day: number): Match {
  let m = newMatch([team(a), team(b)], base);
  m = first.reduce(addBall, startInnings(m, `${a}1`, `${a}2`, `${b}1`));
  m = chase.reduce(addBall, startInnings(m, `${b}1`, `${b}2`, `${a}1`));
  return { ...m, createdAt: day * DAY, status: "done" };
}
const m1 = game("A", "B", [r(6), r(6), r(4), r(0), r(2), r(6)], zeros(6), 1);
const m2 = game("A", "B", [r(1), r(6), r(0), r(0), r(0), r(0)], [r(4), ...zeros(5)], 2);
const m3 = game("C", "D", [r(2), ...zeros(5)], zeros(6), 3);

describe("jump chips", () => {
  it("lists the five sections in page order", () => {
    expect(SECTIONS.map((s) => s.v)).toEqual(["fame", "shame", "streaks", "rivals", "milestones"]);
  });
});

describe("topList", () => {
  it("ranks by career runs with a rank, name and value", () => {
    const rows = topList([m1, m2], "limited", "runs");
    expect(rows[0]).toMatchObject({ rank: 1, name: "A1", value: 25 });
    expect(rows.map((x) => x.rank)).toEqual(rows.map((_, i) => i + 1));
    expect(rows.every((x, i) => i === 0 || rows[i - 1].value >= x.value)).toBe(true);
  });

  it("drops players on zero and caps the list", () => {
    expect(topList([m1], "limited", "wickets")).toEqual([]);
    expect(topList([m1, m2, m3], "limited", "runs", 2)).toHaveLength(2);
  });

  it("rates players on the card score and names the tier", () => {
    const rows = topList([m1, m2], "limited", "rating");
    expect(rows[0].rank).toBe(1);
    expect(rows[0].sub).toMatch(/^(Bronze|Silver|Gold|Icon), 2 matches$/);
  });

  it("is empty with no matches", () => {
    expect(topList([], "test", "rating")).toEqual([]);
  });
});

describe("heroRecords", () => {
  it("picks best player, highest score, best bowling and fastest to 50 in that order", () => {
    const speed = careerSpeed([m1, m2], "limited");
    const best = { name: "A1", matches: 4, rating: 60 };
    const rec = { ...records([m1, m2], "limited"), bestBowling: { value: 3, text: "3/12", name: "B1", matchId: m2.id, date: DAY } };
    const picks = heroRecords(best, rec, [{ runs: 50, rows: [{ name: "A1", balls: 30, innings: 3, matchId: m1.id, date: DAY }] }, ...speed]);
    expect(picks.map((p) => p.key)).toEqual(["best", "highestScore", "bestBowling", "fastest"]);
    expect(picks[3]).toMatchObject({ label: "Fastest to 50", big: "30 balls", who: "A1" });
    expect(picks[0].player).toBe("A1");
  });

  it("skips what nobody has yet", () => {
    expect(heroRecords(null, records([], "limited"), [])).toEqual([]);
  });
});

describe("record groups", () => {
  it("covers every record row exactly once", () => {
    const keys = RECORD_GROUPS.flatMap((g) => g.keys).sort();
    expect(keys).toEqual(RECORD_ROWS.map((x) => x.key).sort());
    expect(RECORD_GROUPS.map((g) => g.title)).toEqual(["Batting", "Bowling", "Team"]);
  });

  it("leaves out unset records and the headline ones", () => {
    const rec = records([m1, m2], "limited");
    const tiles = recordGroups(rec).flatMap((g) => g.tiles.map((t) => t.row.key));
    expect(tiles).not.toContain(HERO_RECORD_KEYS[0]);
    expect(tiles).toContain("mostSixesInnings");
    expect(recordGroups(records([], "limited"))).toEqual([]);
    expect(recordGroups(rec, []).flatMap((g) => g.tiles.map((t) => t.row.key))).toContain("highestScore");
  });
});

describe("default pairs", () => {
  it("opens head to head on the batter and bowler who met most", () => {
    const pair = defaultDuel([m1, m2, m3], "limited")!;
    expect(pair).toHaveLength(2);
    expect(pair[0]).not.toBe(pair[1]);
    expect(defaultDuel([m1, m2, m3], "limited")).toEqual(pair);
  });

  it("has no duel before a ball is bowled", () => {
    expect(defaultDuel([], "limited")).toBeNull();
  });

  it("picks the saved-team pair with the most games", () => {
    const teams = [{ name: "A" }, { name: "C" }, { name: "B" }, { name: "D" }];
    expect(defaultRivalry([m1, m2, m3], teams, "limited")).toEqual(["A", "B"]);
  });

  it("falls back to the first two teams and needs at least two", () => {
    expect(defaultRivalry([], [{ name: "X" }, { name: "Y" }, { name: "Z" }], "limited")).toEqual(["X", "Y"]);
    expect(defaultRivalry([m1], [{ name: "X" }], "limited")).toBeNull();
  });
});

describe("hall of shame lines", () => {
  it("writes one roast line per group from its worst entry", () => {
    const ducks = SHAME.find((g) => g.key === "ducks")!;
    expect(shameLead(ducks, [{ name: "Rahul", value: 4 }, { name: "Aarav", value: 2 }])).toBe("Rahul leads the duck count with 4 ducks.");
    expect(shameLead(SHAME.find((g) => g.key === "expensiveOvers")!, [{ name: "Aarav", value: 31 }])).toBe("Aarav went for 31 runs in one over.");
  });

  it("has no line for an empty group, and the first groups exist", () => {
    expect(shameLead(SHAME[0], [])).toBeNull();
    expect(SHAME_FIRST.every((k) => SHAME.some((g) => g.key === k))).toBe(true);
  });

  it("keeps copy free of dashes", () => {
    const text = SHAME.flatMap((g) => [g.title, g.blurb, g.empty, g.lead({ name: "A", value: 2 })]).join(" ");
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("bookData", () => {
  it("carries the new lists", () => {
    const d = bookData([m1, m2], [{ name: "A" }, { name: "B" }], "limited");
    expect(Object.keys(d.tops).sort()).toEqual(["rating", "runs", "sixes", "wickets"]);
    expect(d.heroes.length).toBeGreaterThan(0);
    expect(d.rival).toEqual(["A", "B"]);
  });
});
