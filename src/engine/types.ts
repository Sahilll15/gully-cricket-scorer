export type Side = 0 | 1;
export type Extra = "wd" | "nb" | "b" | "lb";
export type WicketKind =
  | "bowled" | "caught" | "run out" | "stumped" | "lbw" | "hit wicket" | "one-tip catch" | "wall out" | "hit out"
  | "didn't run" | "dot balls" | "misses" | "hit legs";
/** Where a box-cricket ball hit. fullBack is the back wall without a bounce. */
export type Surface = "side" | "back" | "roof" | "fullBack";
/** "touch": run whenever the bat touches it (tip and run). "every-hit": run on every ball faced (compulsory run). */
export type MustRun = "off" | "touch" | "every-hit";

export interface Player { id: string; name: string }
export interface Team { name: string; players: Player[] }

export interface Rules {
  overs: number;
  extraRun: boolean;        // wide and no-ball add 1 run
  rebowl: boolean;          // wide and no-ball are bowled again
  freeHit: boolean;
  lastManStands: boolean;
  oneTipCatch: boolean;
  wall: "none" | "four" | "six" | "out";
  tipAndRun: boolean;       // older matches only: true reads as mustRun "touch"
  maxOversPerBowler: number | null;
  // "test": two innings a side, no over limit. "solo": no teams, one batter at a time. Older matches have none: limited overs.
  // "pairs": limited overs where pairs bat pairOvers each and a dismissal costs runs. "french": solo with no overs, caught or hit legs only.
  format?: "test" | "solo" | "pairs" | "french";
  matchOvers?: number | null;   // Test only: total overs before the match stops as a draw
  lives?: number;               // Solo only: outs that end a turn. Default 1.
  ballsPerTurn?: number | null; // Solo only: legal balls in a turn, null for no cap. Default 12.
  rounds?: number;              // Solo only: times everyone bats. Default 1.
  sixOut?: boolean;         // hit out of the ground is out, the ball is lost
  noLbw?: boolean;
  retireAt?: number | null; // a batter on this many runs retires not out, so everyone bats
  rotateUmpire?: boolean;   // the fielding side takes turns to umpire, one over each
  commonCantBowl?: boolean; // the common player bats for both sides but never bowls
  mustRun?: MustRun;        // unset: "touch" if tipAndRun, else "off"
  walls?: Partial<Record<Surface, number>>;   // runs for hitting each surface; unset ones fall back to `wall`
  wicketPenalty?: number;   // runs taken off the batting side per dismissal. Pairs default 5.
  noRunning?: boolean;      // runs by running count 0 and the batters never cross
  dotBallsOut?: number;     // this many dot balls in a row and the batter is out
  onlyBoundaries?: boolean; // runs by running count 0: only 4s, 6s and walls score
  dotOut?: boolean;         // any dot ball is out (sixes only)
  ballsPerOver?: number;    // 3 to 8, default 6
  inningsBalls?: number;    // fixed balls an innings, like the 100-ball format
  pairOvers?: number;       // Pairs only: overs each pair bats. Default 4.
  lastManRunsTwo?: boolean; // the last batter on his own scores one for every two runs run
  missesOut?: number;       // this many play-and-misses in a turn and the batter is out
  goldenBall?: { over: number; ball: number } | null;   // 1-based; runs on it double, a wicket on it costs 6
  powerBall?: number | null;   // 1-based ball of every over whose runs double
  jokerOver?: number | null;   // 1-based over whose runs double
  protectedPlayers?: string[]; // ids whose first dismissal each innings costs wicketPenalty (5 if unset) instead
}

export interface Wicket {
  kind: WicketKind; out: "s" | "ns"; newId: string | null;
  outId?: string;   // who is out, by id. Older balls only have `out`, read after the batters cross.
  fielderId?: string;   // who took the catch, made the stumping or hit the stumps
}

export interface Ball {
  t: "ball";
  runs: number;             // off the bat, or byes/leg-byes/wides run
  extra?: Extra;
  wicket?: Wicket;
  stay?: true;              // odd runs but the batters did not cross (a short run, a misfield)
  bowler: string;
  touched?: true;           // the bat touched it, for must run
  missed?: true;            // play and miss, for missesOut
  overthrow?: number;       // overthrow runs on top of `runs`, credited like them
  wall?: Surface;           // box cricket: the surface it hit; scores that wall's value plus `runs`
  zone?: number;            // wagon wheel: where the shot went, display only
}
export interface Swap { t: "swap" }
/** Batter leaves without being out (injury, has to go home). */
export interface Retire { t: "retire"; out: "s" | "ns"; newId: string | null; hurt?: true }
/** Dead ball: the ball went missing. Not a delivery, so nothing is counted. */
export interface Lost { t: "lost"; reason: string; striker: string | null; bowler: string }
/** Rules changed mid-match by agreement. Replay applies `to` from here; undo puts `from` back. */
export interface RulesChange {
  t: "rules"; from: Partial<Rules>; to: Partial<Rules>; agreedBy: string[]; at: number;
  inn?: { overs: number; wicketLimit: number; balls?: number };   // the innings' own limits before the change
  between?: true;   // made between innings, so undo takes it back before reopening the innings
}
/** Penalty runs awarded to a side. Runs for the fielding side go on its previous innings, else its next one. */
export interface Penalty { t: "penalty"; side: Side; runs: number; reason: string }
export type Ev = Ball | Swap | Retire | Lost | RulesChange | Penalty;

/** One correction of a past ball. `ball` is the event's index in that innings. */
export interface Change { at: number; innings: number; ball: number; from: { runs: number; extra?: Extra }; to: { runs: number; extra?: Extra } }

export interface Innings {
  bat: Side;
  overs: number;
  wicketLimit: number;
  superOver: boolean;
  striker: string;
  nonStriker: string | null;
  solo?: boolean;           // one batter at a time, so every player bats
  bowler: string;           // bowler for the next ball
  bowlerSetAt: number;      // legal-ball count when the bowler was last picked
  events: Ev[];
  closed: boolean;          // ended by hand
  declared?: true;          // Test: closed by a declaration
  followOn?: true;          // Test: 3rd innings by the side that batted second
  balls?: number;           // legal balls in the innings when inningsBalls set it, instead of overs
  pairs?: [string, string | null][];   // Pairs: batting pairs in order; they rotate every pairOvers overs
  given?: { runs: number; wickets: number };   // a score carried in, like a first innings played elsewhere
}

export type Status = "setup" | "live" | "break" | "done";

export interface Match {
  id: string;
  createdAt: number;
  // Solo: both teams hold every player in batting order, so all are common players. Innings k is turn k,
  // always batted by side 0. Code that reads teams keeps working and no side ever wins.
  teams: [Team, Team];
  rules: Rules;
  toss: { winner: Side; choice: "bat" | "bowl" } | null;
  innings: Innings[];
  status: Status;
  cup?: { id: string; fixtureId: string };
  series?: { id: string };   // side 0 is the series' team a
  live?: string;   // share code while viewers can follow this match
  liveKey?: JsonWebKey;   // scorer-only signing key; stripped before broadcast
  liveFp?: string;   // fingerprint of that key, put in the share link
  scorer?: string;   // the one phone allowed to score while the match is shared
  handover?: string;   // one-time token in a move link that hasn't been opened yet
  editedAt?: number;   // last change; orders updates when two phones score the same match
  stopped?: true;   // Test called off before a result: a draw
  revisedTarget?: number;   // rain: runs the chasing side now needs to win, replacing first innings + 1
  stoppedLead?: true;   // limited overs called off early: the side ahead on runs per ball wins
  rulesLockedAt?: number;   // when the first innings started; later rule changes go through changeRules
  changes?: Change[];   // corrections of earlier balls
  left?: string[];   // players who went home: they can't bat or bowl again
  prevId?: string;   // the match this one is a rematch of
}

export interface BallInput {
  runs: number; extra?: Extra; wicket?: Wicket; stay?: true;
  touched?: true; missed?: true; overthrow?: number; wall?: Surface; zone?: number;
}
