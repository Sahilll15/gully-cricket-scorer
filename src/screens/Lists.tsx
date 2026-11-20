import { useState } from "react";
import { useStore } from "../store";
import { economy, fmtOf, leaders, strikeRate } from "../stats";
import { overview } from "../records";
import { AdBox } from "../ad";
import { Badge, BottomNav, Card, ConfirmSheet, FmtSwitch, Header, Segmented } from "../ui";
import type { Match } from "../engine/types";
import { MatchCard } from "./Home";
import { csvName, statsCsv } from "../csv";
import { downloadCsv } from "../share";

export function History() {
  const { matches, remove, go } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "live" | "done">("all");
  const [ask, setAsk] = useState<Match | null>(null);
  const list = matches.filter((m) =>
    (f === "all" || (f === "done" ? m.status === "done" : m.status !== "done")) &&
    m.teams.some((t) => t.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="min-h-screen pb-10">
      <Header title="History" back={() => go("home")}>
        <input aria-label="Search a team" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a team"
          className="mt-3 min-h-12 w-full rounded-2xl bg-panel px-4 font-medium outline-none placeholder:text-mute" />
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={f} set={setF} items={[{ v: "all", label: "All" }, { v: "live", label: "Live" }, { v: "done", label: "Results" }]} />
        {list.map((m) => <MatchCard key={m.id} m={m} onHold={() => setAsk(m)} />)}
        {list.length > 0 && <p className="text-center text-xs text-mute">Hold a match to delete it.</p>}
        {!list.length && <p className="pt-8 text-center text-mute">No matches here yet.</p>}
      </main>
      {ask && <ConfirmSheet title="Delete this match?" body={`${ask.teams[0].name} vs ${ask.teams[1].name}. Its runs and wickets come off everyone's stats.`}
        yes="Delete" danger onYes={() => remove(ask.id)} onClose={() => setAsk(null)} />}
      <AdBox />
    </div>
  );
}

type Board = "runs" | "wickets" | "sr" | "sixes" | "field";

/** Totals for the chosen format, above the leaderboard. */
function Summary({ matches, fmt, players }: { matches: Match[]; fmt: "limited" | "test"; players: number }) {
  const o = overview(matches, fmt);
  if (!o.played) return null;
  const tiles: [string, number][] = [["Runs", o.runs], ["Wickets", o.wickets], ["Sixes", o.sixes], ["Fours", o.fours], ["Players", players]];
  return (
    <div className="stadium rounded-3xl p-5">
      <p className="text-xs font-medium text-mute">Overall · {fmt === "test" ? "Test" : "limited overs"}</p>
      <p className="mt-1 text-5xl font-extrabold leading-none text-fg tabular-nums">{o.played} <span className="text-sm font-medium text-teal">{o.played === 1 ? "match" : "matches"}</span></p>
      <div className="mt-4 grid grid-cols-5 gap-1 border-t border-white/10 pt-3 text-center">
        {tiles.map(([k, v]) => <div key={k}><p className="text-base font-extrabold text-fg tabular-nums">{v}</p><p className="text-[11px] text-mute">{k}</p></div>)}
      </div>
      {o.completed < o.played && <p className="mt-3 text-xs text-mute">Totals count the {o.completed} finished {o.completed === 1 ? "match" : "matches"}.</p>}
    </div>
  );
}

export function Stats() {
  const { matches, openPlayer, fmt } = useStore();
  const [b, setB] = useState<Board>("runs");
  const all = leaders(matches, fmt);
  const dismissals = (r: (typeof all)[number]) => r.catches + r.runOuts + r.stumpings;
  const rows = {
    runs: [...all].filter((r) => r.runs).sort((x, y) => y.runs - x.runs).map((r) => [r, `${r.runs}`, `${r.balls} balls · ${r.matches} match${r.matches === 1 ? "" : "es"}`] as const),
    wickets: [...all].filter((r) => r.wickets).sort((x, y) => y.wickets - x.wickets || x.conceded - y.conceded).map((r) => [r, `${r.wickets}`, `econ ${economy(r.conceded, r.legal).toFixed(1)}`] as const),
    sr: [...all].filter((r) => r.balls >= 10).sort((x, y) => strikeRate(y.runs, y.balls) - strikeRate(x.runs, x.balls)).map((r) => [r, strikeRate(r.runs, r.balls).toFixed(0), `${r.runs} off ${r.balls}`] as const),
    sixes: [...all].filter((r) => r.sixes).sort((x, y) => y.sixes - x.sixes).map((r) => [r, `${r.sixes}`, `${r.fours} fours too`] as const),
    field: [...all].filter(dismissals).sort((x, y) => dismissals(y) - dismissals(x) || y.catches - x.catches)
      .map((r) => [r, `${dismissals(r)}`, `${r.catches} caught · ${r.runOuts} run out · ${r.stumpings} stumped`] as const),
  }[b];
  return (
    <div className="min-h-screen pb-28">
      <Header title="Stats" />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <FmtSwitch value={fmt} set={(v) => useStore.setState({ fmt: v })} />
        <Summary matches={matches} fmt={fmt} players={all.length} />
        <Segmented value={b} set={setB} items={[{ v: "runs", label: "Runs" }, { v: "wickets", label: "Wkts" }, { v: "sr", label: "SR" }, { v: "sixes", label: "6s" }, { v: "field", label: "Field" }]} />
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
          {!rows.length && <p className="p-6 text-center text-sm text-mute">{matches.some((m) => fmtOf(m) === fmt)
            ? b === "field" ? "Name the fielder on a wicket to count it." : "Nothing here yet."
            : fmt === "test" ? "No Test matches yet. Pick Test match when you set one up." : "Name your players when setting up a match and they show up here."}</p>}
        </Card>
        {all.length > 0 && <button onClick={() => downloadCsv(statsCsv(matches, fmt), csvName(fmt))}
          className="press mx-auto block min-h-10 px-3 text-sm font-semibold text-mute">Export CSV</button>}
      </main>
      <AdBox />
      <BottomNav />
    </div>
  );
}
