import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { startAccountSync } from "./account";
import { cleanCode, liveSupported, parseMoveToken, parseScoreKey, publish } from "./live";
import { track } from "./track";
import Watch, { JoinScoring } from "./screens/Watch";
import Home from "./screens/Home";
import Setup from "./screens/Setup";
import Live from "./screens/Live";
import Scorecard from "./screens/Scorecard";
import Result from "./screens/Result";
import { History, Stats } from "./screens/Lists";
import { Cup, Cups, NewCup } from "./screens/Cups";
import { PlayerProfile, Teams } from "./screens/Teams";

// Keeps one broadcast channel open per match that is being shared, and pushes every change.
function LivePublisher() {
  const matches = useStore((s) => s.matches);
  const pubs = useRef(new Map<string, ReturnType<typeof publish>>());
  useEffect(() => {
    const want = new Map(matches.filter((m) => m.live).map((m) => [m.live!, m.id]));
    for (const [code, p] of pubs.current) if (!want.has(code)) { p.stop(); pubs.current.delete(code); }
    for (const [code, id] of want) {
      const p = pubs.current.get(code);
      if (p) p.push();
      else {
        const find = () => useStore.getState().matches.find((m) => m.id === id);
        pubs.current.set(code, publish(code, find, (remote) => {
          const cur = find();
          if (cur) useStore.getState().adopt({ ...remote, id: cur.id, cup: cur.cup, live: cur.live, liveKey: cur.liveKey, liveFp: cur.liveFp });
        }));
      }
    }
  }, [matches]);
  useEffect(() => () => { for (const p of pubs.current.values()) p.stop(); pubs.current.clear(); }, []);
  return null;
}

export default function App() {
  const screen = useStore((s) => s.screen);
  const loaded = useRef(false);
  useEffect(() => startAccountSync(), []);
  // The first view is already counted by gtag's own page_view on load.
  useEffect(() => {
    if (loaded.current) track("page_view", { page_title: `Scorer: ${screen}`, page_location: `${location.origin}${import.meta.env.BASE_URL}${screen}` });
    loaded.current = true;
  }, [screen]);
  useEffect(() => {
    const q = new URLSearchParams(location.search), code = cleanCode(q.get("watch") ?? "");
    if (code.length === 6) { useStore.getState().watchMatch(code, q.get("k")); history.replaceState(null, "", import.meta.env.BASE_URL); }
    let stash = location.hash;
    try { stash = sessionStorage.getItem("gully-handover") ?? stash; sessionStorage.removeItem("gully-handover"); } catch { /* private mode */ }
    const score = cleanCode(q.get("score") ?? ""), key = parseScoreKey(stash);
    if (score.length === 6 && key) useStore.getState().joinScoring(score, key, parseMoveToken(stash));
    if (q.has("score") || location.hash) history.replaceState(null, "", import.meta.env.BASE_URL);
  }, []);
  return (
    <div className="mx-auto max-w-[480px]">
      {screen === "home" && <Home />}
      {screen === "setup" && <Setup />}
      {screen === "live" && <Live />}
      {screen === "scorecard" && <Scorecard />}
      {screen === "result" && <Result />}
      {screen === "history" && <History />}
      {screen === "stats" && <Stats />}
      {screen === "cups" && <Cups />}
      {screen === "newcup" && <NewCup />}
      {screen === "cup" && <Cup />}
      {screen === "teams" && <Teams />}
      {screen === "player" && <PlayerProfile />}
      {screen === "watch" && <Watch />}
      {screen === "join" && <JoinScoring />}
      {liveSupported && <LivePublisher />}
    </div>
  );
}
