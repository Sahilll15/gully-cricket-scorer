import { describe, expect, it } from "vitest";
import { parse } from "./voice";

const ball = (runs: number, extra?: string) => ({ kind: "ball", input: extra ? { runs, extra } : { runs } });

describe("voice", () => {
  it.each([
    ["this ball 6 run", ball(6)],
    ["this ball 4 run", ball(4)],
    ["this ball four runs", ball(4)],
    ["4 un", ball(4)],
    ["six", ball(6)],
    ["is ball pe chauka", ball(4)],
    ["chhakka", ball(6)],
    ["dot ball", ball(0)],
    ["single", ball(1)],
    ["two runs", ball(2)],
    ["wide", ball(0, "wd")],
    ["wide and they ran two", ball(2, "wd")],
    ["no ball", ball(0, "nb")],
    ["this ball no ball six", ball(6, "nb")],
    ["leg bye one", ball(1, "lb")],
    ["two byes", ball(2, "b")],
  ])("%s", (said, want) => expect(parse(said)).toEqual(want));

  it.each(["out", "bowled", "caught behind", "run out", "this ball out"])("%s is a wicket", (said) =>
    expect(parse(said)).toEqual({ kind: "out" }));

  it.each(["undo", "galat", "cancel that"])("%s undoes", (said) => expect(parse(said)).toEqual({ kind: "undo" }));

  it.each(["hello there", "what a shot", "for the win"])("ignores %s", (said) => expect(parse(said)).toBeNull());
});
