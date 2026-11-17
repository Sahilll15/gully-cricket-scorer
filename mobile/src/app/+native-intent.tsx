import { applyLink } from "@/lib/links";

/** Share links carry their meaning in ?watch= / ?score= and #k=, not in a route, so turn them into one here. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const to = applyLink(path);
  if (to) return to;
  return path.startsWith("/score") || path.includes("ai.sahilchalke.com") ? "/" : path;
}
