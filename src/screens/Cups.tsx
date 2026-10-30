import { useEffect, useState } from "react";
import * as E from "../engine/engine";
import { champion, newTournament, standings, withFinal, type Fixture, type Tournament } from "../engine/tournament";
import type { Match, Rules } from "../engine/types";
import { useStore } from "../store";
import { leaders, strikeRate } from "../stats";
import { Badge, BottomNav, Card, cx, Header, PrimaryButton, Segmented, Stepper } from "../ui";

export const CUP_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

export function Cups() {
  const { cups, go, matches, teams } = useStore();
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  return (
    <div className="min-h-screen pb-28">
      <Header title="Tournaments" />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <PrimaryButton onClick={() => go("newcup")}>+ Create tournament</PrimaryButton>
        {cups.map((c) => {
          const done = c.fixtures.filter((f) => matches.some((m) => m.id === f.matchId && m.status === "done")).length;
          const champ = champion(c, matches);
          return (
            <button key={c.id} onClick={() => { useStore.setState({ cupId: c.id }); go("cup"); }} className="press block w-full text-left">
              <Card>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-fg">{c.name}</p>
                  {champ ? <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">🏆 {name(champ)}</span>
                    : <span className="text-xs font-semibold text-mute">{done}/{c.fixtures.length} played</span>}
                </div>
                <p className="mt-1 text-sm text-mute">{c.teamIds.length} teams · {c.rules.overs} overs · {c.format === "league" ? "League" : "League + final"}</p>
              </Card>
            </button>
          );
        })}
        {!cups.length && (
          <Card className="text-center">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 font-semibold text-fg">No tournaments yet</p>
            <p className="text-sm text-mute">Pick your teams, and fixtures plus a points table with net run rate are made for you.</p>
          </Card>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export function NewCup() {
  const { teams, go, putCup, saveTeam } = useStore();
  const [name, setName] = useState("Gully Premier League");
  const [pick, setPick] = useState<string[]>([]);
  const [overs, setOvers] = useState(5);
  const [format, setFormat] = useState<Tournament["format"]>("league-final");
  const [newTeam, setNewTeam] = useState("");
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);
  const fixtures = (pick.length * (pick.length - 1)) / 2 + (format === "league-final" && pick.length >= 3 ? 1 : 0);

  return (
    <div className="min-h-screen pb-10">
      <Header title="New Tournament" back={() => go("cups")} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Name</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32}
            className="min-h-12 w-full rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Teams ({pick.length} picked)</p>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button key={t.id} onClick={() => toggle(t.id)}
                className={cx("press flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4", pick.includes(t.id) ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>
                <Badge name={t.name} size={36} /><span className="text-sm font-semibold">{t.name}</span>
              </button>
            ))}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTeam.trim()) { const t = saveTeam(newTeam, []); setPick([...pick, t.id]); setNewTeam(""); } }}>
            <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Add a team" maxLength={18}
              className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />
            <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
          </form>
          <p className="mt-2 text-xs text-mute">Add players to each team from the Teams tab, or at the toss of each match.</p>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Overs an innings</p>
          <Stepper value={overs} set={setOvers} max={50} />
          <p className="mb-2 mt-4 text-sm font-semibold text-teal">Format</p>
          <Segmented value={format} set={setFormat} items={[{ v: "league-final", label: "League + final" }, { v: "league", label: "League only" }]} />
        </Card>
        <PrimaryButton disabled={pick.length < 2 || !name.trim()} onClick={() => {
          const t = newTournament(name.trim(), pick, { ...CUP_RULES, overs }, format);
          putCup(t); useStore.setState({ cupId: t.id }); go("cup");
        }}>{pick.length < 2 ? "Pick at least 2 teams" : `Create · ${fixtures} matches`}</PrimaryButton>
      </main>
    </div>
  );
}

function FixtureRow({ f, cup, matches, name }: { f: Fixture; cup: Tournament; matches: Match[]; name: (id: string) => string }) {
  const { playFixture, go } = useStore();
  const m = matches.find((x) => x.id === f.matchId);
  const res = m && E.result(m);
  const score = (side: 0 | 1) => {
    if (!m) return "";
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return "";
    const st = E.replay(m, i);
    return `${st.runs}/${st.wickets}`;
  };
  return (
    <button onClick={() => (m ? go(m.status === "done" ? "result" : "live", m.id) : playFixture(cup.id, f.id))} className="press block w-full text-left">
      <Card className={cx(f.stage === "final" && "!border-sun")}>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-mute">
          <span>{f.stage === "final" ? "🏆 FINAL" : `Match ${cup.fixtures.indexOf(f) + 1} · Round ${f.round}`}</span>
          <span className={cx(m && m.status !== "done" ? "text-out" : res ? "text-teal" : "text-sun")}>{!m ? "Tap to play" : m.status === "done" ? "Result" : "● Live"}</span>
        </div>
        {([[f.a, 0], [f.b, 1]] as const).map(([id, s]) => (
          <div key={id} className="flex items-center gap-3 py-1">
            <Badge name={name(id)} size={30} />
            <span className={cx("flex-1 truncate font-semibold", res && res.winner === s ? "text-sun" : "text-fg")}>{name(id)}</span>
            <span className="font-bold text-fg tabular-nums">{score(s)}</span>
          </div>
        ))}
        {res && <p className="mt-1 text-sm text-mute">{res.text}</p>}
      </Card>
    </button>
  );
}

export function Cup() {
  const { cups, cupId, matches, teams, go, putCup, removeCup, openPlayer } = useStore();
  const cup = cups.find((c) => c.id === cupId);
  const [tab, setTab] = useState<"fix" | "table" | "stats">("fix");
  useEffect(() => {
    if (!cup) return;
    const next = withFinal(cup, matches);
    if (next !== cup) putCup(next);
  }, [cup, matches, putCup]);
  if (!cup) return null;
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const table = standings(cup, matches);
  const champ = champion(cup, matches);
  const cupMatches = matches.filter((m) => cup.fixtures.some((f) => f.matchId === m.id));
  const top = leaders(cupMatches);

  return (
    <div className="min-h-screen pb-10">
      <Header title={cup.name} back={() => go("cups")}>
        {champ && <div className="mt-3 rounded-2xl bg-sun px-4 py-3 text-center text-ink"><p className="text-xs font-bold">CHAMPIONS</p><p className="text-2xl font-extrabold">🏆 {name(champ)}</p></div>}
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={tab} set={setTab} items={[{ v: "fix", label: "Fixtures" }, { v: "table", label: "Points table" }, { v: "stats", label: "Stats" }]} />
        {tab === "fix" && [...cup.fixtures].sort((a, b) => a.round - b.round).map((f) => <FixtureRow key={f.id} f={f} cup={cup} matches={matches} name={name} />)}
        {tab === "table" && (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-key text-left text-xs text-fg">
                <th className="px-3 py-2.5">Team</th>{["P", "W", "L", "T", "Pts", "NRR"].map((h) => <th key={h} className="px-1.5 py-2.5 text-right last:pr-3">{h}</th>)}
              </tr></thead>
              <tbody>{table.map((r, i) => (
                <tr key={r.teamId} className="border-t border-line">
                  <td className="px-3 py-3"><span className={cx("mr-2 font-bold", i < 2 ? "text-sun" : "text-mute")}>{i + 1}</span><span className="font-semibold text-fg">{name(r.teamId)}</span></td>
                  {[r.p, r.w, r.l, r.t].map((v, k) => <td key={k} className="px-1.5 text-right tabular-nums">{v}</td>)}
                  <td className="px-1.5 text-right font-bold text-fg tabular-nums">{r.pts}</td>
                  <td className={cx("px-1.5 pr-3 text-right tabular-nums", r.nrr > 0 ? "text-sun" : r.nrr < 0 ? "text-mute" : "")}>{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
                </tr>))}</tbody>
            </table>
            <p className="border-t border-line px-3 py-2.5 text-xs text-mute">Win 2 points, tie 1. Net run rate: runs per over scored minus runs per over conceded.{cup.format === "league-final" ? " Top two play the final." : ""}</p>
          </Card>
        )}
        {tab === "stats" && (
          <div className="grid gap-3">
            {([["Most runs", [...top].sort((a, b) => b.runs - a.runs), (r: (typeof top)[number]) => `${r.runs}`, (r: (typeof top)[number]) => `SR ${strikeRate(r.runs, r.balls).toFixed(0)}`],
               ["Most wickets", [...top].filter((r) => r.wickets).sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded), (r: (typeof top)[number]) => `${r.wickets}`, (r: (typeof top)[number]) => `${r.conceded} runs`],
               ["Most sixes", [...top].filter((r) => r.sixes).sort((a, b) => b.sixes - a.sixes), (r: (typeof top)[number]) => `${r.sixes}`, () => ""]] as const).map(([title, rows, big, sub]) => (
              <Card key={title} className="!p-0 overflow-hidden">
                <p className="px-4 pt-3 text-sm font-semibold text-teal">{title}</p>
                {rows.slice(0, 5).map((r, i) => (
                  <button key={r.name} onClick={() => openPlayer(r.name)} className="press flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left first:border-0">
                    <span className={i ? "w-5 text-mute" : "w-5 font-bold text-sun"}>{i + 1}</span>
                    <span className="flex-1 font-semibold text-fg">{r.name}</span>
                    <span className="text-xs text-mute">{sub(r)}</span>
                    <span className="w-10 text-right text-xl font-extrabold text-fg tabular-nums">{big(r)}</span>
                  </button>
                ))}
                {!rows.length && <p className="px-4 pb-3 text-sm text-mute">Nothing yet.</p>}
              </Card>
            ))}
          </div>
        )}
        <button onClick={() => { if (confirm(`Delete ${cup.name}? Its matches stay in History.`)) { removeCup(cup.id); go("cups"); } }}
          className="press min-h-12 w-full rounded-2xl font-semibold text-out">Delete tournament</button>
      </main>
    </div>
  );
}
