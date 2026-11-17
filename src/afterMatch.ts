import * as E from "./engine/engine";
import type { Match } from "./engine/types";

/** "Rockets 2, Strikers 1 tonight": the evening's rematch chain. Null until at least two of them are done. */
export function tallyText(matches: Match[], m: Match): string | null {
  const t = E.eveningTally(matches, m);
  if (t.played < 2) return null;
  const wins = t.wins.map((w) => `${w.name} ${w.wins}`).join(", ");
  const drawn = t.drawn ? `${t.drawn} ${t.drawn === 1 ? "tie" : "ties"}` : "";
  return `${[wins, drawn].filter(Boolean).join(", ")} tonight`;
}

/** Rematches go from the Result screen; French cricket has no fixed order to start one from. */
export const canRematch = (m: Match) => m.status === "done" && !m.cup && !m.series && !E.isFrench(m);

/** Same teams and rules. The side that bowled first bats first this time, so nobody needs a coin. */
export function rematchMatch(m: Match, now = Date.now()): Match {
  const n = E.rematch(m, now);
  if (!E.isSolo(m)) n.toss = { winner: E.otherSide(E.firstBatting(m)), choice: "bat" };
  return n;
}
