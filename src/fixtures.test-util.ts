import { addBall, needsBowler, newMatch, setBowler, startInnings, startSolo, startTurn, suggestedBowler } from "./engine/engine";
import type { BallInput, Match, Team } from "./engine/types";

const team = (p: string, n = 4): Team => ({ name: p, players: Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, name: `${p} ${"ABCD"[i]}` })) });
const rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null } as const;

export const r = (runs: number): BallInput => ({ runs });
export const bowled = (newId: string | null): BallInput => ({ runs: 0, wicket: { kind: "bowled", out: "s", newId } });
const play = (m: Match, balls: BallInput[]) => balls.reduce(addBall, m);

/**
 * Lions 15/1 in 2 overs (12 and 3, Lions B bowled in the first), Tigers 16/0 in 1.2 (6, then 6 and 4).
 * Over bowlers: Tigers A then Tigers B; Lions A then Lions D.
 */
export function teamMatch(): Match {
  let m = newMatch([team("Lions"), team("Tigers")], { ...rules });
  m.toss = { winner: 0, choice: "bat" };
  m = startInnings(m, "Lions0", "Lions1", "Tigers0");
  m = play(m, [r(4), r(1), bowled("Lions2"), r(6), r(0), r(1)]);
  m = setBowler(m, "Tigers1");
  m = play(m, [{ runs: 0, extra: "wd" }, r(2), r(0), r(0), r(0), r(0), r(0)]);
  m = startInnings(m, "Tigers0", "Tigers1", "Lions0");
  m = play(m, [r(1), r(1), r(1), r(1), r(1), r(1)]);
  m = setBowler(m, "Lions3");
  return play(m, [r(6), r(4)]);
}

/** Solo, 6 balls a turn: Asha 10 (caught by Chitra), Bilal 6, Chitra 12. */
export function soloMatch(): Match {
  const p = ["Asha", "Bilal", "Chitra"].map((n) => ({ id: n, name: n }));
  const bowl = (m: Match, b: BallInput) => addBall(needsBowler(m, m.innings.length - 1) ? setBowler(m, suggestedBowler(m)!) : m, b);
  let m = startSolo(p, { ballsPerTurn: 6 });
  m = [r(6), r(4), { runs: 0, wicket: { kind: "caught", out: "s", newId: null, fielderId: "Chitra" } } as BallInput].reduce(bowl, m);
  m = [r(1), r(1), r(1), r(1), r(1), r(1)].reduce(bowl, startTurn(m));
  return [r(6), r(6), r(0), r(0), r(0), r(0)].reduce(bowl, startTurn(m));
}
