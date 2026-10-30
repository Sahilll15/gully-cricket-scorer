import { useState } from "react";
import { useStore } from "../store";
import { economy, leaders, strikeRate } from "../stats";
import { Badge, BottomNav, Card, Header, Segmented } from "../ui";
import { MatchCard } from "./Home";

export function History() {
  const { matches, remove } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "live" | "done">("all");
  const list = matches.filter((m) =>
    (f === "all" || (f === "done" ? m.status === "done" : m.status !== "done")) &&
    m.teams.some((t) => t.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="min-h-screen pb-28">
      <Header title="Match History">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a team"
          className="mt-3 min-h-12 w-full rounded-2xl bg-panel px-4 font-medium outline-none placeholder:text-mute" />
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={f} set={setF} items={[{ v: "all", label: "All" }, { v: "live", label: "Live" }, { v: "done", label: "Completed" }]} />
        {list.map((m) => (
          <div key={m.id} className="relative">
            <MatchCard m={m} />
            <button onClick={() => confirm(`Delete ${m.teams[0].name} vs ${m.teams[1].name}?`) && remove(m.id)}
              className="press absolute bottom-3 right-3 min-h-10 rounded-full px-3 text-xs font-semibold text-out" aria-label="Delete match">Delete</button>
          </div>
        ))}
        {!list.length && <p className="pt-8 text-center text-mute">No matches here yet.</p>}
      </main>
      <BottomNav />
    </div>
  );
}

type Board = "runs" | "wickets" | "sr" | "sixes";

export function Stats() {
  const { matches, openPlayer } = useStore();
  const [b, setB] = useState<Board>("runs");
  const all = leaders(matches);
  const rows = {
    runs: [...all].filter((r) => r.runs).sort((x, y) => y.runs - x.runs).map((r) => [r, `${r.runs}`, `${r.balls} balls · ${r.matches} matches`] as const),
    wickets: [...all].filter((r) => r.wickets).sort((x, y) => y.wickets - x.wickets || x.conceded - y.conceded).map((r) => [r, `${r.wickets}`, `econ ${economy(r.conceded, r.legal).toFixed(1)}`] as const),
    sr: [...all].filter((r) => r.balls >= 10).sort((x, y) => strikeRate(y.runs, y.balls) - strikeRate(x.runs, x.balls)).map((r) => [r, strikeRate(r.runs, r.balls).toFixed(0), `${r.runs} off ${r.balls}`] as const),
    sixes: [...all].filter((r) => r.sixes).sort((x, y) => y.sixes - x.sixes).map((r) => [r, `${r.sixes}`, `${r.fours} fours too`] as const),
  }[b];
  return (
    <div className="min-h-screen pb-28">
      <Header title="Leaderboard" />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={b} set={setB} items={[{ v: "runs", label: "Runs" }, { v: "wickets", label: "Wickets" }, { v: "sr", label: "Strike rate" }, { v: "sixes", label: "Sixes" }]} />
        {b === "sr" && <p className="text-center text-xs text-mute">Players with at least 10 balls faced</p>}
        <Card className="!p-0 overflow-hidden">
          {rows.map(([r, big, sub], i) => (
            <button key={r.name} onClick={() => openPlayer(r.name)} className="press flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0">
              <span className={i === 0 ? "w-6 text-lg font-extrabold text-sun" : "w-6 font-bold text-mute"}>{i + 1}</span>
              <Badge name={r.name} size={38} />
              <span className="flex-1"><span className="block font-semibold text-fg">{r.name}</span><span className="text-xs text-mute">{sub}</span></span>
              <span className="text-2xl font-extrabold text-fg tabular-nums">{big}</span>
            </button>
          ))}
          {!rows.length && <p className="p-6 text-center text-sm text-mute">Name your players when setting up a match and they show up here.</p>}
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
