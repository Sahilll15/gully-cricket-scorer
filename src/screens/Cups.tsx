import { useEffect, useState } from "react";
import * as E from "../engine/engine";
import { advance, champion, fixtureCount, newTournament, stageLabel, standings, type CupFormat, type Fixture, type Tournament } from "../engine/tournament";
import { SeriesList } from "./Series";
import type { Match, Rules } from "../engine/types";
import { useStore } from "../store";
import { leaders, strikeRate } from "../stats";
import { Badge, BottomNav, Card, ConfirmSheet, cx, Header, PrimaryButton, Segmented, Stepper } from "../ui";

export const CUP_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

export const FORMATS: { v: CupFormat; label: string; hint: string; min: number }[] = [
  { v: "league-final", label: "Top 2 play the final", hint: "League, then 1st v 2nd", min: 3 },
  { v: "ipl", label: "IPL style, top 4", hint: "Qualifier 1 (1v2), Eliminator (3v4), Qualifier 2, Final", min: 4 },
  { v: "semis", label: "Semi-finals", hint: "League, then 1v4 and 2v3, winners in the final", min: 4 },
  { v: "knockout", label: "Knockout", hint: "No league. Lose once and you're out", min: 2 },
  { v: "league", label: "League only", hint: "Top of the table wins", min: 2 },
];
const formatLabel = (f: CupFormat) => FORMATS.find((x) => x.v === f)?.label ?? f;

export function Cups() {
  const { cups, go, matches, teams, cupsTab: tab } = useStore();
  const setTab = (v: "cups" | "series") => useStore.setState({ cupsTab: v });
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  return (
    <div className="min-h-screen pb-28">
      <Header title={tab === "cups" ? "Tournaments" : "Series"} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={tab} set={setTab} items={[{ v: "cups", label: "Tournaments" }, { v: "series", label: "Series" }]} />
        {tab === "series" ? <SeriesList /> : <>
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
                <p className="mt-1 text-sm text-mute">{c.teamIds.length} teams · {c.rules.overs} overs · {formatLabel(c.format)}</p>
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
        </>}
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
  const [format, setFormat] = useState<CupFormat>("league-final");
  const [newTeam, setNewTeam] = useState("");
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);
  const min = FORMATS.find((f) => f.v === format)!.min;
  const fixtures = fixtureCount(format, pick.length);

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
          <p className="mb-2 mt-4 text-sm font-semibold text-teal">Playoffs</p>
          <div className="grid gap-2">
            {FORMATS.map((f) => (
              <button key={f.v} onClick={() => setFormat(f.v)} aria-pressed={format === f.v}
                className={cx("press flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left", format === f.v ? "border-sun bg-sun-soft" : "border-line bg-key")}>
                <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", format === f.v ? "border-sun" : "border-mute")}>{format === f.v && <i className="h-2.5 w-2.5 rounded-full bg-sun" />}</span>
                <span className="flex-1"><span className="block font-semibold text-fg">{f.label}</span><span className="block text-xs text-mute">{f.hint}{f.min > 2 ? ` · ${f.min}+ teams` : ""}</span></span>
              </button>
            ))}
          </div>
          {pick.length >= 2 && pick.length < min && <p className="mt-2 text-xs text-out">{min} teams needed for this. With {pick.length} it becomes {pick.length >= 3 ? "a top-2 final" : "a league"}.</p>}
          {format !== "league" && format !== "knockout" && <p className="mt-2 text-xs text-mute">A tied playoff sends the team higher in the table through.</p>}
          {format === "knockout" && <p className="mt-2 text-xs text-mute">Seeded in the order you picked the teams. A tie sends the higher seed through.</p>}
        </Card>
        <PrimaryButton disabled={pick.length < 2 || !name.trim()} onClick={() => {
          const t = newTournament(name.trim(), pick, { ...CUP_RULES, overs }, format);
          putCup(t); useStore.setState({ cupId: t.id }); go("cup");
        }}>{pick.length < 2 ? "Pick at least 2 teams" : `Create · ${fixtures} match${fixtures === 1 ? "" : "es"}`}</PrimaryButton>
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
      <Card className={cx(f.stage === "final" ? "!border-sun" : f.stage !== "league" && "!border-sun/50")}>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-mute">
          <span>{f.stage === "final" ? "🏆 FINAL" : f.stage === "league" ? `Match ${cup.fixtures.indexOf(f) + 1} · Round ${f.round}` : <span className="text-sun">{stageLabel(cup, f).toUpperCase()}</span>}</span>
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
  const [askDel, setAskDel] = useState(false);
  useEffect(() => {
    if (!cup) return;
    let next = cup;
    for (let i = 0; i < 4; i++) next = advance(next, matches);
    if (next !== cup) putCup(next);
  }, [cup, matches, putCup]);
  if (!cup) return null;
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const table = standings(cup, matches);
  const champ = champion(cup, matches);
  const cupMatches = matches.filter((m) => cup.fixtures.some((f) => f.matchId === m.id));
  const top = leaders(cupMatches, "limited");
  const ko = cup.format === "knockout";
  const through = cup.format === "league" ? 1 : cup.teamIds.length >= 4 && (cup.format === "ipl" || cup.format === "semis") ? 4 : 2;

  return (
    <div className="min-h-screen pb-10">
      <Header title={cup.name} back={() => go("cups")}>
        {champ && <div className="mt-3 rounded-2xl bg-sun px-4 py-3 text-center text-ink"><p className="text-xs font-bold">CHAMPIONS</p><p className="text-2xl font-extrabold">🏆 {name(champ)}</p></div>}
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <p className="text-center text-xs text-mute">{formatLabel(cup.format)} · {cup.rules.overs} overs</p>
        <Segmented value={tab} set={setTab} items={ko ? [{ v: "fix", label: "Fixtures" }, { v: "stats", label: "Stats" }] : [{ v: "fix", label: "Fixtures" }, { v: "table", label: "Points table" }, { v: "stats", label: "Stats" }]} />
        {tab === "fix" && [...cup.fixtures].sort((a, b) => a.round - b.round).map((f) => <FixtureRow key={f.id} f={f} cup={cup} matches={matches} name={name} />)}
        {tab === "table" && (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-key text-left text-xs text-fg">
                <th className="px-3 py-2.5">Team</th>{["P", "W", "L", "T", "Pts", "NRR"].map((h) => <th key={h} className="px-1.5 py-2.5 text-right last:pr-3">{h}</th>)}
              </tr></thead>
              <tbody>{table.map((r, i) => (
                <tr key={r.teamId} className="border-t border-line">
                  <td className="px-3 py-3"><span className={cx("mr-2 font-bold", i < through ? "text-sun" : "text-mute")}>{i + 1}</span><span className="font-semibold text-fg">{name(r.teamId)}</span></td>
                  {[r.p, r.w, r.l, r.t].map((v, k) => <td key={k} className="px-1.5 text-right tabular-nums">{v}</td>)}
                  <td className="px-1.5 text-right font-bold text-fg tabular-nums">{r.pts}</td>
                  <td className={cx("px-1.5 pr-3 text-right tabular-nums", r.nrr > 0 ? "text-sun" : r.nrr < 0 ? "text-mute" : "")}>{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
                </tr>))}</tbody>
            </table>
            <p className="border-t border-line px-3 py-2.5 text-xs text-mute">Win 2 points, tie 1. Net run rate: runs per over scored minus runs per over conceded.{cup.format === "league" ? "" : ` ${FORMATS.find((f) => f.v === cup.format)?.hint ?? ""}.`}</p>
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
        <button onClick={() => setAskDel(true)}
          className="press min-h-12 w-full rounded-2xl font-semibold text-out">Delete tournament</button>
      </main>
      {askDel && <ConfirmSheet title={`Delete ${cup.name}?`} body="Its matches stay in History." yes="Delete" danger
        onYes={() => { removeCup(cup.id); go("cups"); }} onClose={() => setAskDel(false)} />}
    </div>
  );
}
