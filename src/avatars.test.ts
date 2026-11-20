import { describe, expect, it } from "vitest";
import { initials, KITS, nameHash, playerArt, playerJersey, shade, teamArt, teamCode, teamJersey } from "./avatars";

const PLAYERS = ["Ravi", "Aman", "Sahil", "Priya", "Kabir", "Neha", "Arjun", "Zoya", "Rohit", "Ishaan", "Meera", "Dev", "Tanvi", "Yash", "Farhan", "Lata"];
const TEAMS = ["Gully Kings", "Street Lions", "Building B", "Tigers XI", "Sunday Strikers", "Lane 4", "Rooftop Rebels", "Night Owls",
  "Chawl Chargers", "Mumbai Mavericks", "Society XI", "Team A"];

describe("name-seeded jerseys", () => {
  it("gives the same jersey for the same name, ignoring case and outer spaces", () => {
    expect(playerJersey(" ravi ")).toEqual(playerJersey("Ravi"));
    expect(teamJersey("gully kings")).toEqual(teamJersey("Gully Kings"));
    expect(playerArt(playerJersey("Ravi"))).toEqual(playerArt(playerJersey("Ravi")));
    expect(nameHash("abc")).toBe(nameHash("ABC"));
  });

  it("derives player initials from the first and last word", () => {
    expect(initials("Ravi")).toBe("R");
    expect(initials("ravi kumar")).toBe("RK");
    expect(initials("Ravi Kumar Shah")).toBe("RS");
    expect(initials("  ")).toBe("?");
  });

  it("derives 2 to 3 letter team codes", () => {
    expect(teamCode("Mumbai Mavericks")).toBe("MM");
    expect(teamCode("Team A")).toBe("TA");
    expect(teamCode("Tigers XI")).toBe("TXI");
    expect(teamCode("Lane 4")).toBe("L4");
    expect(teamCode("Royal Challengers Bangalore Club")).toBe("RCB");
    expect(teamCode("Tigers")).toBe("TIG");
    for (const t of TEAMS) expect(teamCode(t)).toMatch(/^[A-Z0-9]{2,3}$/);
  });

  it("spreads names across kit colours and squad numbers", () => {
    expect(new Set(PLAYERS.map((n) => playerJersey(n).kit.base)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(TEAMS.map((n) => teamJersey(n).kit.base)).size).toBeGreaterThanOrEqual(7);
    const many = Array.from({ length: 400 }, (_, i) => `Player ${i}`);
    expect(new Set(many.map((n) => playerJersey(n).kit)).size).toBe(KITS.length);
    const numbers = many.map((n) => playerJersey(n).number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(99);
    expect(new Set(numbers).size).toBeGreaterThan(80);
  });

  it("drops the squad number at small sizes and draws valid shapes", () => {
    const texts = (small: boolean) => playerArt(playerJersey("Ravi Kumar"), small).shapes.filter((s) => s.t === "text");
    expect(texts(false).map((s) => s.t === "text" && s.text)).toEqual(["RK", String(playerJersey("Ravi Kumar").number)]);
    expect(texts(true).map((s) => s.t === "text" && s.text)).toEqual(["RK"]);
    for (const n of [...PLAYERS, ...TEAMS]) {
      for (const small of [false, true]) {
        for (const s of [...playerArt(playerJersey(n), small).shapes, ...teamArt(teamJersey(n), small).shapes]) {
          if (s.t === "path") expect(s.d).not.toMatch(/NaN|undefined/);
          expect(s.fill ?? s.stroke).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("shades colours toward black or white", () => {
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#ff8a3d", 0)).toBe("#ff8a3d");
  });
});
