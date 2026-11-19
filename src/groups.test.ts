import { describe, expect, it } from "vitest";
import { cleanNames, decodeGroup, encodeGroup, groupLink, groupShareText, importInvite, mergeGroups, newGroup, playersFrom } from "./groups";
import { merge } from "./backup";
import { migrate } from "./persist";

const sunday = () => newGroup("Sunday boys", ["Ravi", "Sam", "Om"]);

describe("cleanNames", () => {
  it("trims, drops blanks and auto names, and de-duplicates ignoring case", () => {
    expect(cleanNames([" Ravi ", "ravi", "", "Player 3", "Sam  K"])).toEqual(["Ravi", "Sam K"]);
  });
});

describe("share code", () => {
  it("round-trips a group, including accents and emoji", () => {
    const g = newGroup("Sunday boys 🏏", ["Ravi", "Zoë", "रवि", "Nuño"]);
    expect(decodeGroup(encodeGroup(g))).toEqual({ name: "Sunday boys 🏏", names: ["Ravi", "Zoë", "रवि", "Nuño"] });
  });

  it("finds the code inside a link or a pasted message", () => {
    const g = sunday();
    expect(decodeGroup(groupLink(g, "https://ai.sahilchalke.com/score/"))?.name).toBe("Sunday boys");
    expect(decodeGroup(groupShareText(g, "https://x.test/"))?.names).toEqual(["Ravi", "Sam", "Om"]);
  });

  it("never carries ids", () => {
    expect(encodeGroup(sunday())).not.toContain(sunday().players[0].id);
  });

  it("rejects junk, tampered and empty codes", () => {
    expect(decodeGroup("")).toBeNull();
    expect(decodeGroup("hello")).toBeNull();
    expect(decodeGroup("GSG1.!!!")).toBeNull();
    expect(decodeGroup("GSG1.AAAA")).toBeNull();
    expect(decodeGroup(encodeGroup({ name: "Empty", players: [] }))).toBeNull();
  });
});

describe("importInvite", () => {
  it("adds a new group with fresh ids", () => {
    const r = importInvite([], { name: "Sunday boys", names: ["Ravi", "Sam"] });
    expect(r.groups).toHaveLength(1);
    expect(r.added).toBe(2);
    expect(r.group.players.every((p) => p.id)).toBe(true);
  });

  it("merges into a group with the same name instead of duplicating it", () => {
    const have = [sunday()];
    const r = importInvite(have, { name: "sunday BOYS", names: ["ravi", "Dev"] });
    expect(r.groups).toHaveLength(1);
    expect(r.group.players.map((p) => p.name)).toEqual(["Ravi", "Sam", "Om", "Dev"]);
    expect(r.added).toBe(1);
  });
});

describe("playersFrom", () => {
  it("skips players the team already has, case-insensitively, and gives new ids", () => {
    const g = sunday();
    const out = playersFrom(g, [{ id: "x", name: "ravi" }]);
    expect(out.map((p) => p.name)).toEqual(["Sam", "Om"]);
    expect(out.some((p) => g.players.some((q) => q.id === p.id))).toBe(false);
  });

  it("can take just the chosen names", () => {
    expect(playersFrom(sunday(), [], ["om"]).map((p) => p.name)).toEqual(["Om"]);
  });
});

describe("account sync and old saves", () => {
  it("merges the same group from two devices without losing players", () => {
    const a = sunday(), b = { ...a, players: [...a.players.slice(0, 1), { id: "z", name: "Dev" }] };
    expect(mergeGroups([a], [b])[0].players.map((p) => p.name)).toEqual(["Ravi", "Sam", "Om", "Dev"]);
  });

  it("backup merge keeps groups from both sides, and old backups without groups still merge", () => {
    const a = sunday(), b = newGroup("Office", ["Kiran"]);
    const out = merge({ v: 1, matches: [], teams: [], cups: [], groups: [a] }, { v: 1, matches: [], teams: [], cups: [], groups: [b] });
    expect(out.groups?.map((g) => g.name)).toEqual(["Sunday boys", "Office"]);
    expect(merge({ v: 1, matches: [], teams: [], cups: [] }, { v: 1, matches: [], teams: [], cups: [] }).groups).toEqual([]);
  });

  it("older saved state gains empty groups and keeps existing ones", () => {
    expect((migrate({ matches: [] }) as { groups: unknown }).groups).toEqual([]);
    const g = [sunday()];
    expect((migrate({ groups: g }) as { groups: unknown }).groups).toEqual(g);
  });
});
