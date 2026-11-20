import { router, type useNavigationContainerRef } from "expo-router";
import type { Screen } from "./store";

type NavRef = ReturnType<typeof useNavigationContainerRef>;
let ref: NavRef | null = null;
export const setNavRef = (r: typeof ref) => { ref = r; };

const ROUTE: Record<Screen, string> = {
  home: "index", setup: "setup", live: "live", scorecard: "scorecard", result: "result", stats: "stats", history: "history",
  cups: "cups", newcup: "newcup", cup: "cup", teams: "teams", player: "player", watch: "watch", join: "join", series: "series", newseries: "newseries", book: "book", kitty: "kitty",
};
export const TABS: Screen[] = ["home", "cups", "teams", "stats"];
export const screenOf = (route: string): Screen => (Object.keys(ROUTE) as Screen[]).find((s) => ROUTE[s] === route) ?? "home";
const href = (s: Screen) => (s === "home" ? "/" : `/${ROUTE[s]}`);

type NavState = { index?: number; routes: { name: string; state?: NavState }[] };

/** expo-router nests the real stack under a hidden root route, so walk down to the deepest navigator. */
export function stackNames(state: NavState | undefined): string[] {
  let st = state;
  while (st) {
    const r = st.routes[st.index ?? st.routes.length - 1];
    if (!r?.state) return st.routes.map((x) => x.name);
    st = r.state;
  }
  return [];
}

// Forms and hand-offs are replaced by what they lead to, so Back never returns to a stale form.
const FORMS: Screen[] = ["setup", "newcup", "newseries", "join"];

/** Go back to the screen if it is already open below, swap between bottom tabs, otherwise push it. */
export function navigate(to: Screen) {
  const names = stackNames(ref?.getRootState() as NavState | undefined);
  const cur = screenOf(names[names.length - 1] ?? "index");
  if (cur === to && names.length) return;
  if (names.slice(0, -1).includes(ROUTE[to])) router.dismissTo(href(to) as never);
  else if (FORMS.includes(cur) || (cur === "watch" && to === "live") || (cur === "live" && to === "result")) router.replace(href(to) as never);
  // Tabs sit one deep on top of Home, so Back from any tab goes Home and then out.
  else if (TABS.includes(to) && TABS.includes(cur) && cur !== "home") router.replace(href(to) as never);
  else router.push(href(to) as never);
}
