import * as E from "@shared/engine/engine";
import { BASE_RULES } from "@shared/presets";
import type { Match, Team } from "@shared/engine/types";

const team = (name: string, names: string[]): Team => ({ name, players: names.map((n, i) => ({ id: `${name[5]}${i + 1}`, name: n })) });

/** A short 2-over match, ready at ball one, so a new scorer can try the keypad straight away. */
export function demoMatch(): Match {
  let m = E.newMatch([team("Demo Titans", ["Aarav", "Vihaan", "Kabir", "Ishaan"]), team("Demo Kings", ["Rohan", "Arjun", "Dev", "Yash"])], { ...BASE_RULES, overs: 2 });
  return E.startInnings(m, "T1", "T2", "K1");
}
