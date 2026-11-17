import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Match } from "@shared/engine/types";

let id = "this-device";
const uuid = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// Kept outside the synced store, so a restored backup never makes two phones think they are the same one.
export async function initDevice() {
  try {
    const d = await AsyncStorage.getItem("gully-device");
    id = d ?? uuid();
    if (!d) await AsyncStorage.setItem("gully-device", id);
  } catch { /* storage unavailable: stay on the fallback id */ }
}
export const deviceId = () => id;

/** Only one phone holds the pen; while a move link is waiting to be opened, nobody does. */
export const canScore = (m: Match, me = id) => !m.handover && (!m.scorer || m.scorer === me);
export const movedAway = (m: Match, me = id) => !!m.scorer && m.scorer !== me;
