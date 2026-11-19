import { useStore } from "./store";
import { decodeGroup } from "@shared/groups";
import { cleanCode, parseMoveToken, parseScoreKey } from "./live";

let handled = false;
/** True once a share link decided the first screen, so the app does not also resume the last one. */
export const linkOpened = () => handled;

/** Reads a watch or take-over-scoring link into the store. Returns the route to show, or null if it isn't one. */
export function applyLink(url: string): string | null {
  const q = url.split("#")[0].split("?")[1] ?? "", hash = url.includes("#") ? `#${url.split("#")[1]}` : "";
  const p = new URLSearchParams(q);
  const inv = decodeGroup(p.get("group") ?? "");
  if (inv) { useStore.getState().setGroupInvite(inv); handled = true; return "/teams"; }
  const watch = cleanCode(p.get("watch") ?? "");
  if (watch.length === 6) { useStore.setState({ watchCode: watch, watchKey: p.get("k") }); handled = true; return "/watch"; }
  const score = cleanCode(p.get("score") ?? ""), key = parseScoreKey(hash);
  if (score.length === 6 && key) { useStore.setState({ joinCode: score, joinKey: key, joinToken: parseMoveToken(hash) }); handled = true; return "/join"; }
  return null;
}
