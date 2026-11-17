import type { Rules } from "./engine/types";

/** Ready-made formats. Each sets only what it needs; applyPreset fills in the rest. */
export type PresetId =
  | "gully" | "tip-and-run" | "compulsory-run" | "box" | "box-pairs" | "double-wicket" | "sixes-only"
  | "tape-ball" | "office" | "hundred" | "french" | "solo" | "test";

export interface Preset { id: PresetId; name: string; description: string; rules: Partial<Rules> }

const BOX_WALLS = { side: 1, back: 4, fullBack: 6 };

export const PRESETS: Preset[] = [
  { id: "gully", name: "Gully classic", description: "Six overs, one tip one hand, last man stands, hit out of the ground is out.",
    rules: { overs: 6, oneTipCatch: true, lastManStands: true, sixOut: true } },
  { id: "tip-and-run", name: "Tip and run", description: "Touch the ball with the bat and you have to run.",
    rules: { overs: 5, mustRun: "touch" } },
  { id: "compulsory-run", name: "Compulsory run", description: "Run on every ball you face, or you're out.",
    rules: { overs: 5, mustRun: "every-hit" } },
  { id: "box", name: "Box cricket", description: "Walls score runs, three dots in a row is out, every wicket costs 5.",
    rules: { overs: 6, walls: BOX_WALLS, wicketPenalty: 5, dotBallsOut: 3 } },
  { id: "box-pairs", name: "Pairs box cricket", description: "Pairs bat four overs each, a wicket costs 5 and you bat on.",
    rules: { format: "pairs", overs: 16, pairOvers: 4, wicketPenalty: 5, walls: BOX_WALLS } },
  { id: "double-wicket", name: "Double wicket", description: "Two a side, both bat all the overs, every wicket costs 5.",
    rules: { format: "pairs", overs: 4, pairOvers: 4, wicketPenalty: 5 } },
  { id: "sixes-only", name: "Sixes only", description: "Running scores nothing, only fours, sixes and walls count.",
    rules: { overs: 3, onlyBoundaries: true } },
  { id: "tape-ball", name: "Tape ball", description: "Eight overs with a taped tennis ball, free hits and no lbw.",
    rules: { overs: 8, freeHit: true, noLbw: true } },
  { id: "office", name: "Office cricket", description: "Corridor rules: the wall is a four, retire at 20, no lbw.",
    rules: { overs: 4, wall: "four", oneTipCatch: true, lastManStands: true, retireAt: 20, noLbw: true } },
  { id: "hundred", name: "100 balls", description: "A hundred balls a side in five-ball overs.",
    rules: { overs: 20, inningsBalls: 100, ballsPerOver: 5, maxOversPerBowler: 4 } },
  { id: "french", name: "French cricket", description: "Bat till you're caught or hit on the legs; whoever gets you out bats next.",
    rules: { format: "french", lives: 1 } },
  { id: "solo", name: "Solo", description: "Everyone bats on their own for twelve balls, everyone else bowls.",
    rules: { format: "solo", ballsPerTurn: 12, lives: 1, rounds: 1 } },
  { id: "test", name: "Test", description: "Two innings a side with no over limit.",
    rules: { format: "test", matchOvers: null } },
];

export const preset = (id: PresetId): Preset | undefined => PRESETS.find((p) => p.id === id);

/** The rules a preset sets, format included. */
export const presetRules = (id: PresetId): Partial<Rules> => ({ ...(preset(id)?.rules ?? {}) });

/** Rules every match needs, for a preset applied from scratch. */
export const BASE_RULES: Rules = {
  overs: 6, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

/** Options a preset may set: cleared first, so switching presets leaves nothing of the last one behind. */
const VARIANT_KEYS: (keyof Rules)[] = [
  "format", "matchOvers", "lives", "ballsPerTurn", "rounds", "sixOut", "noLbw", "retireAt", "mustRun", "walls", "wicketPenalty",
  "noRunning", "dotBallsOut", "onlyBoundaries", "dotOut", "ballsPerOver", "inningsBalls", "pairOvers", "lastManRunsTwo", "missesOut",
  "goldenBall", "powerBall", "jokerOver", "protectedPlayers",
];

/** Same result from any starting rules: BASE_RULES plus the preset. Only base's match-day toggles (umpire, common player) carry over. */
export function applyPreset(id: PresetId, base: Rules = BASE_RULES): Rules {
  const out: Rules = { ...base, ...BASE_RULES };
  for (const k of VARIANT_KEYS) delete out[k];
  return { ...out, ...presetRules(id) };
}
