import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import { cardStatus } from "./cardStatus";
import { r, teamMatch } from "./fixtures.test-util";

describe("cardStatus", () => {
  it("names the result for a finished match", () => {
    const c = cardStatus(teamMatch());
    expect(c.live).toBe(false);
    expect(c.text).toMatch(/won by/);
  });

  it("shows the chase while the second innings is on", () => {
    const m = teamMatch();
    const chase = { ...m, status: "live" as const, innings: [m.innings[0], { ...m.innings[1], closed: false, events: m.innings[1].events.slice(0, 6) }] };
    const c = cardStatus(chase);
    expect(c.live).toBe(true);
    expect(c.text).toMatch(/Tigers need 10 off \d+ balls?/);
  });

  it("says who is batting in the first innings", () => {
    const team = (p: string) => ({ name: p, players: [0, 1, 2].map((i) => ({ id: `${p}${i}`, name: `${p} ${i}` })) });
    const rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null } as const;
    let m = E.newMatch([team("Lions"), team("Tigers")], { ...rules });
    m.toss = { winner: 0, choice: "bat" };
    m = E.addBall(E.startInnings(m, "Lions0", "Lions1", "Tigers0"), r(1));
    expect(cardStatus(m)).toEqual({ text: "Lions batting", live: true });
  });
});
