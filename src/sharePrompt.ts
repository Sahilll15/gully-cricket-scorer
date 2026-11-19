import type { Match } from "./engine/types";

const asked = new Set<string>();
const FRESH = 10 * 60 * 1000;

/** True once per match, only right after it finished, so reopening an old result never nags. */
export function shouldPrompt(m: Match, now = Date.now()): boolean {
  if (m.status !== "done" || asked.has(m.id) || now - (m.editedAt ?? m.createdAt) > FRESH) return false;
  asked.add(m.id);
  return true;
}
