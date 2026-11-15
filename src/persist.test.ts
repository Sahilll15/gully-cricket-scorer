import { describe, expect, it } from "vitest";
import { merge, type Backup } from "./backup";
import { migrate, STORE_VERSION } from "./persist";
import { replay } from "./engine/engine";
import type { Match } from "./engine/types";
import type { Tournament } from "./engine/tournament";

const rules = { overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none" as const, tipAndRun: false, maxOversPerBowler: null };
const match: Match = {
  id: "m1", createdAt: 1, teams: [{ name: "A", players: [{ id: "a", name: "Ravi" }, { id: "b", name: "Sam" }] }, { name: "B", players: [{ id: "c", name: "Om" }] }],
  toss: null, status: "live", rules,
  innings: [{ bat: 0, overs: 5, wicketLimit: 1, superOver: false, striker: "a", nonStriker: "b", bowler: "c", bowlerSetAt: 0, closed: false,
    events: [{ t: "ball", runs: 4, bowler: "c" }, { t: "ball", runs: 1, bowler: "c" }] }],
};
const cup: Tournament = { id: "c1", name: "Old cup", createdAt: 1, teamIds: ["x", "y"], format: "league-final", rules,
  fixtures: [{ id: "f", a: "x", b: "y", round: 1, stage: "league", matchId: "m1" }] };

describe("saved data from older versions", () => {
  it("v3 state keeps every match, team and cup, and gains empty series and player details", () => {
    const v3 = { matches: [match], screen: "home", viewId: null, teams: [{ id: "x", name: "A", players: [] }], cups: [cup], cupId: null, player: null, lastSetup: null };
    const s = migrate(JSON.parse(JSON.stringify(v3))) as Record<string, unknown>;
    expect(s.matches).toEqual([match]);
    expect(s.cups).toEqual([cup]);
    expect(s.teams).toEqual(v3.teams);
    expect(s.series).toEqual([]);
    expect(s.infos).toEqual({});
    expect(replay((s.matches as Match[])[0], 0).runs).toBe(5);
  });

  it("v1 state with only matches still loads", () => {
    const s = migrate({ matches: [match] }) as Record<string, unknown>;
    expect(s).toMatchObject({ matches: [match], teams: [], cups: [], series: [], infos: {}, lastSetup: null });
  });

  it("the store version moved on", () => expect(STORE_VERSION).toBe(4));
});

describe("backup with series and player details", () => {
  const empty: Backup = { v: 1, matches: [], teams: [], cups: [] };
  it("an old backup without them merges cleanly", () => {
    const local: Backup = { ...empty, series: [], infos: { ravi: { role: "bat" } } };
    expect(merge(local, empty)).toMatchObject({ series: [], infos: { ravi: { role: "bat" } } });
  });

  it("keeps series from both phones and this phone's player details win", () => {
    const s = (id: string) => ({ id, name: id, createdAt: 1, a: "x", b: "y", games: 3, rules });
    const local: Backup = { ...empty, series: [s("one")], infos: { ravi: { role: "bat", hand: "L" } } };
    const cloud: Backup = { ...empty, series: [s("two")], infos: { ravi: { role: "bowl" }, om: { role: "wk" } } };
    const both = merge(local, cloud);
    expect(both.series!.map((x) => x.id).sort()).toEqual(["one", "two"]);
    expect(both.infos).toEqual({ ravi: { role: "bat", hand: "L" }, om: { role: "wk" } });
  });
});
