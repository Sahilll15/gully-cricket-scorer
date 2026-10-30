import { useState } from "react";
import * as E from "../engine/engine";
import { cleanCode, liveSupported } from "../live";
import { InstallCard } from "../install";
import type { Match } from "../engine/types";
import { useStore } from "../store";
import { leaders } from "../stats";
import { Badge, BottomNav, Card, LivePill, PrimaryButton, Sheet } from "../ui";

export function MatchCard({ m }: { m: Match }) {
  const { go } = useStore();
  const res = E.result(m), live = m.status === "live" || m.status === "break";
  const line = (side: 0 | 1) => {
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return "Yet to bat";
    const st = E.replay(m, i);
    return `${st.runs}/${st.wickets} (${E.oversText(st.legal)})`;
  };
  return (
    <button onClick={() => go(live ? "live" : m.status === "done" ? "result" : "home", m.id)} className="press block w-full text-left">
      <Card>
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-mute">
          <span>{new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {m.rules.overs} overs</span>
          {live ? <LivePill /> : <span className="rounded-full bg-sun-soft px-2.5 py-1 font-semibold text-fg">Completed</span>}
        </div>
        {([0, 1] as const).map((s) => (
          <div key={s} className="flex items-center gap-3 py-1">
            <Badge name={m.teams[s].name} size={34} />
            <span className="flex-1 truncate font-semibold text-teal">{m.teams[s].name}</span>
            <span className="font-bold text-fg tabular-nums">{line(s)}</span>
          </div>
        ))}
        <p className="mt-2 text-sm font-medium text-fg">{res ? res.text : live ? "Tap to keep scoring" : ""}</p>
      </Card>
    </button>
  );
}

export default function Home() {
  const { matches, go, watchMatch } = useStore();
  const [ask, setAsk] = useState(false);
  const [code, setCode] = useState("");
  const live = matches.filter((m) => m.status === "live" || m.status === "break");
  const done = matches.filter((m) => m.status === "done").slice(0, 3);
  const all = leaders(matches);
  const total = (k: "runs" | "sixes" | "wickets") => all.reduce((s, r) => s + r[k], 0);

  return (
    <div className="min-h-screen pb-28">
      <header className="header-glow rounded-b-[36px] border-b border-line px-5 pb-7 pt-[max(22px,env(safe-area-inset-top))]">
        <p className="text-sm font-semibold text-sun">GULLY SCORER</p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.05] text-fg">Score every ball.<br /><span className="text-sun">No login.</span></h1>
        <p className="mt-2 text-sm text-fg/75">Tap or just say it: "four", "wide", "out".</p>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[["Matches", matches.length], ["Runs", total("runs")], ["Sixes", total("sixes")], ["Wickets", total("wickets")]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-key px-2 py-2.5 text-center">
              <p className="text-xl font-extrabold text-fg tabular-nums">{v}</p>
              <p className="text-[11px] font-medium text-mute">{k}</p>
            </div>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-5">
        <PrimaryButton onClick={() => go("setup")}>+ Start new match</PrimaryButton>
        {liveSupported && <button onClick={() => setAsk(true)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">📡 Watch a live match</button>}
        <InstallCard />
        {live.length > 0 && <h2 className="pt-3 font-bold text-fg">Live now</h2>}
        {live.map((m) => <MatchCard key={m.id} m={m} />)}
        {done.length > 0 && <h2 className="pt-3 font-bold text-fg">Recent matches</h2>}
        {done.map((m) => <MatchCard key={m.id} m={m} />)}
        {!matches.length && (
          <Card className="text-center">
            <p className="text-4xl">🏏</p>
            <p className="mt-2 font-semibold text-fg">No matches yet</p>
            <p className="text-sm text-mute">Set one up in under 30 seconds. Everything stays on this phone.</p>
          </Card>
        )}
      </main>
      {ask && (
        <Sheet title="Watch a live match" onClose={() => setAsk(false)}>
          <p className="text-sm text-mute">Ask the scorer for the 6-letter code on their screen.</p>
          <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) { setAsk(false); watchMatch(code); } }}>
            <input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="ABC123" autoFocus autoCapitalize="characters"
              className="min-h-14 w-full rounded-2xl border-2 border-line bg-panel px-4 text-center text-2xl font-extrabold tracking-[0.3em] text-fg outline-none focus:border-sun" />
            <PrimaryButton disabled={code.length !== 6}>Watch</PrimaryButton>
          </form>
        </Sheet>
      )}
      <BottomNav />
    </div>
  );
}
