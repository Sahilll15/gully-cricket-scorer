import * as E from "./engine/engine";
import type { Match } from "./engine/types";

/** The line under a match card, like a score app's status: the chase in progress, who is batting, or the result. */
export function cardStatus(m: Match): { text: string; live: boolean } {
  const res = E.result(m);
  if (res) return { text: res.text, live: false };
  const idx = m.innings.length - 1;
  if (idx < 0) return { text: m.toss ? `${m.teams[m.toss.winner].name} won the toss` : "Match not started", live: true };
  if (E.isSolo(m) || E.isTest(m)) return { text: E.isTest(m) ? E.testStatus(m) ?? "Test in progress" : "Tap to keep scoring", live: true };
  const inn = m.innings[idx], tgt = E.target(m, idx);
  if (m.status === "break") {
    const next = E.otherSide(inn.bat), need = E.replay(m, idx).runs + 1;
    return { text: `Innings break. ${m.teams[next].name} need ${need}`, live: true };
  }
  if (tgt !== null) {
    const st = E.replay(m, idx), need = tgt - st.runs, left = E.ballsLeft(m, idx);
    return { text: `${m.teams[inn.bat].name} need ${Math.max(0, need)}${left !== null ? ` off ${left} ball${left === 1 ? "" : "s"}` : ""}`, live: true };
  }
  return { text: `${m.teams[inn.bat].name} batting`, live: true };
}
