import type { Match } from "./engine/types";

// Kept outside the synced store, so a restored backup never makes two phones think they are the same one.
export const deviceId: string = (() => {
  try {
    let d = localStorage.getItem("gully-device");
    if (!d) { d = crypto.randomUUID(); localStorage.setItem("gully-device", d); }
    return d;
  } catch { return "this-device"; }
})();

/** Only one phone holds the pen; while a move link is waiting to be opened, nobody does. */
export const canScore = (m: Match, me = deviceId) => !m.handover && (!m.scorer || m.scorer === me);
export const movedAway = (m: Match, me = deviceId) => !!m.scorer && m.scorer !== me;
