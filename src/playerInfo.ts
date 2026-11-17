/** What a player does, set by hand on their page. Keyed by lower-case name, like their stats. */
export interface PlayerInfo {
  role?: "bat" | "bowl" | "all" | "wk";
  hand?: "R" | "L";            // batting hand
  arm?: "R" | "L";             // bowling arm
  bowl?: "pace" | "spin";
  style?: string;              // optional sub-type, e.g. "Off-spin"
  upi?: string;                // UPI ID for the kitty QR; the app never moves money
}

export const ROLES = [["bat", "Batter"], ["bowl", "Bowler"], ["all", "All-rounder"], ["wk", "Wicketkeeper"]] as const;
export const STYLES = { pace: ["Fast", "Fast-medium", "Medium"], spin: ["Off-spin", "Leg-spin", "Left-arm spin"] } as const;

/** "All-rounder · Left-hand bat · Right-arm Off-spin", or "" with nothing set. */
export function infoLine(i: PlayerInfo | undefined): string {
  if (!i) return "";
  const role = ROLES.find(([v]) => v === i.role)?.[1];
  const bat = i.hand && `${i.hand === "L" ? "Left" : "Right"}-hand bat`;
  const kind = i.style ?? (i.bowl === "pace" ? "pace" : i.bowl === "spin" ? "spin" : "");
  const bowl = (i.arm || kind) && [i.arm && `${i.arm === "L" ? "Left" : "Right"}-arm`, kind].filter(Boolean).join(" ");
  return [role, bat, bowl].filter(Boolean).join(" · ");
}
