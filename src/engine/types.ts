export type Side = 0 | 1;
export type Extra = "wd" | "nb" | "b" | "lb";
export type WicketKind =
  | "bowled" | "caught" | "run out" | "stumped" | "lbw" | "hit wicket" | "one-tip catch" | "wall out";

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
  tipAndRun: boolean;
  maxOversPerBowler: number | null;
}

export interface Wicket {
  kind: WicketKind; out: "s" | "ns"; newId: string | null;
  outId?: string;   // who is out, by id. Older balls only have \`out\`, read after the batters cross.
  fielderId?: string;   // who took the catch, made the stumping or hit the stumps
}

export interface Ball {
  t: "ball";
  runs: number;             // off the bat, or byes/leg-byes/wides run
  extra?: Extra;
  wicket?: Wicket;
  stay?: true;              // odd runs but the batters did not cross (a short run, a misfield)
  bowler: string;
}
export interface Swap { t: "swap" }
/** Batter leaves without being out (injury, has to go home). */
export interface Retire { t: "retire"; out: "s" | "ns"; newId: string | null }
export type Ev = Ball | Swap | Retire;

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
}

export type Status = "setup" | "live" | "break" | "done";

export interface Match {
  id: string;
  createdAt: number;
  teams: [Team, Team];
  rules: Rules;
  toss: { winner: Side; choice: "bat" | "bowl" } | null;
  innings: Innings[];
  status: Status;
  cup?: { id: string; fixtureId: string };
  live?: string;   // share code while viewers can follow this match
  liveKey?: JsonWebKey;   // scorer-only signing key; stripped before broadcast
  liveFp?: string;   // fingerprint of that key, put in the share link
}

export interface BallInput { runs: number; extra?: Extra; wicket?: Wicket; stay?: true }
