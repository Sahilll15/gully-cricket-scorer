import { describe, expect, it } from "vitest";
import * as E from "./engine/engine";
import { r, teamMatch } from "./fixtures.test-util";
import { revisedTarget } from "./season";

const chase = () => {
  const m = teamMatch();
  return { ...m, status: "live" as const, innings: [m.innings[0], { ...m.innings[1], closed: false, events: m.innings[1].events.slice(0, 6) }] };
};

describe("revised target", () => {
  it("replaces first innings plus one while the chase is on", () => {
    const m = chase();
    expect(E.target(m, 1)).toBe(16);
    const n = E.setRevisedTarget(m, 9);
    expect(E.target(n, 1)).toBe(9);
    expect(E.target(E.setRevisedTarget(n, null), 1)).toBe(16);
  });

  it("ends the chase once the revised target is reached, and names the win", () => {
    let m = E.setRevisedTarget(chase(), 10);
    expect(E.replay(m, 1).ended).toBe(false);
    m = E.addBall(m, r(6));
    expect(E.replay(m, 1).ended).toBe(true);
    m = { ...m, status: "done" };
    expect(E.result(m)?.text).toContain("revised target 10");
    expect(E.result(m)?.winner).toBe(1);
  });

  it("a short chase loses by the revised gap, and one run short of it ties", () => {
    const m = { ...E.setRevisedTarget(chase(), 10), status: "done" as const };
    expect(E.result(m)?.text).toContain("Lions won by 3 runs");
    expect(E.result({ ...E.setRevisedTarget(chase(), 7), status: "done" as const })?.tie).toBe(true);
  });

  it("only works in a limited-overs chase that is still going", () => {
    const m = chase();
    const first = { ...m, innings: [m.innings[0]] } as typeof m;
    expect(E.setRevisedTarget(first, 5)).toBe(first);
    const done = { ...m, status: "done" as const };
    expect(E.setRevisedTarget(done, 5)).toBe(done);
  });

  it("scales a first innings total to the overs left", () => {
    expect(revisedTarget(60, 10, 5)).toBe(31);
  });
});
