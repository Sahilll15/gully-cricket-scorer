import { useState } from "react";
import { endBody, endSeries, newSeries, rulesLabel, seriesMatches, seriesScore, seriesSub, type Series } from "../engine/series";
import type { Match, Rules } from "../engine/types";
import { useStore } from "../store";
import { track } from "../track";
import { EV } from "../events";
import { Badge, Card, ConfirmSheet, cx, Header, PrimaryButton, Segmented, Stepper } from "../ui";
import { MatchCard } from "./Home";

const SERIES_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

const teamName = (id: string) => useStore.getState().teams.find((t) => t.id === id)?.name ?? "?";
export const seriesNames = (s: Series): [string, string] => [teamName(s.a), teamName(s.b)];

/** One-tap button for the next match of a series, or to carry on the one under way. */
export function SeriesNext({ s, matches, label = "Play next match" }: { s: Series; matches: Match[]; label?: string }) {
  const { playSeries, go } = useStore();
  const sc = seriesScore(s, matches);
  if (sc.current) return <PrimaryButton onClick={() => go("live", sc.current)}>Carry on match {sc.played + 1}</PrimaryButton>;
  if (sc.next === null) return null;
  return <PrimaryButton onClick={() => playSeries(s.id)}>{label}</PrimaryButton>;
}

/** Ends the series after a confirm, unless it is already over. */
export function EndSeries({ s, matches }: { s: Series; matches: Match[] }) {
  const { putSeries } = useStore();
  const [ask, setAsk] = useState(false);
  if (seriesScore(s, matches).done) return null;
  return (<>
    <button onClick={() => setAsk(true)} className="press min-h-12 w-full rounded-2xl bg-key font-semibold text-teal">End series</button>
    {ask && <ConfirmSheet title="End the series?" body={endBody(s, matches, seriesNames(s))} yes="End series"
      onYes={() => { putSeries(endSeries(s)); setAsk(false); }} onClose={() => setAsk(false)} />}
  </>);
}

function ScoreBoard({ s, matches }: { s: Series; matches: Match[] }) {
  const sc = seriesScore(s, matches), names = seriesNames(s);
  return (
    <div className="mt-3 rounded-2xl bg-key px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-3">
        <span className="flex-1 truncate text-right font-bold text-fg">{names[0]}</span>
        <span className="text-3xl font-extrabold text-sun tabular-nums">{sc.a}-{sc.b}</span>
        <span className="flex-1 truncate text-left font-bold text-fg">{names[1]}</span>
      </div>
      <p className="mt-1 text-sm text-fg/80">{sc.text(names)}{sc.drawn ? ` · ${sc.drawn} drawn` : ""}</p>
    </div>
  );
}

export function SeriesList() {
  const { series, matches, go } = useStore();
  return (<>
    <PrimaryButton onClick={() => go("newseries")}>+ Create series</PrimaryButton>
    {series.map((s) => {
      const sc = seriesScore(s, matches), names = seriesNames(s);
      return (
        <button key={s.id} onClick={() => { useStore.setState({ seriesId: s.id }); go("series"); }} className="press block w-full text-left">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-lg font-bold text-fg">{s.name}</p>
              <span className="shrink-0 rounded-full bg-sun-soft px-3 py-1 text-sm font-extrabold text-fg tabular-nums">{sc.a}-{sc.b}</span>
            </div>
            <p className="mt-1 text-sm text-mute">{names[0]} v {names[1]} · {seriesSub(s, sc)}</p>
            <p className="mt-1 text-sm font-medium text-fg">{sc.text(names)}</p>
          </Card>
        </button>
      );
    })}
    {!series.length && (
      <Card className="text-center">
        <p className="text-4xl">🔁</p>
        <p className="mt-2 font-semibold text-fg">No series yet</p>
        <p className="text-sm text-mute">Same two teams, as many matches as you like. The team that wins the most matches wins the series. Every next match starts filled in.</p>
      </Card>
    )}
  </>);
}

export function NewSeries() {
  const { teams, go, putSeries, saveTeam } = useStore();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [plan, setPlan] = useState(false);
  const [games, setGames] = useState(3);
  const [newTeam, setNewTeam] = useState("");
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < 2 ? [...pick, id] : [pick[1], id]);
  const names = pick.map((id) => teams.find((t) => t.id === id)?.name ?? "");
  return (
    <div className="min-h-screen pb-10">
      <Header title="New series" back={() => go("cups")} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Two teams ({pick.length} of 2)</p>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button key={t.id} onClick={() => toggle(t.id)}
                className={cx("press flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4", pick.includes(t.id) ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>
                <Badge name={t.name} size={36} /><span className="text-sm font-semibold">{t.name}</span>
              </button>
            ))}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTeam.trim()) { track(EV.team_save); const t = saveTeam(newTeam, []); setPick((p) => [...p.filter((x) => x !== t.id), t.id].slice(-2)); setNewTeam(""); } }}>
            <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Add a team" maxLength={18}
              className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />
            <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
          </form>
          <p className="mt-2 text-xs text-mute">Players come from each saved team. You can add more at the start of any match.</p>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Name</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder={names.length === 2 ? `${names[0]} v ${names[1]}` : "Sunday series"}
            className="min-h-12 w-full rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none placeholder:text-mute" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Number of matches</p>
          <Segmented value={plan ? "set" : "open"} set={(v) => setPlan(v === "set")} items={[{ v: "open", label: "Open series" }, { v: "set", label: "Plan a number" }]} />
          {plan && <div className="mt-2"><Stepper value={games} set={setGames} max={9} /></div>}
          <p className="mt-2 text-xs text-mute">{plan ? "You can still play on or end it early." : "Play as many matches as you like and end it when you decide. Most wins takes the series."}</p>
        </Card>
        <PrimaryButton disabled={pick.length < 2} onClick={() => {
          const s = newSeries(name.trim() || `${names[0]} v ${names[1]}`, pick[0], pick[1], plan ? games : null, SERIES_RULES);
          track(EV.series_create, { matches: plan ? games : 0 });
          putSeries(s); useStore.setState({ seriesId: s.id, cupsTab: "series" }); go("series");
        }}>{pick.length < 2 ? "Pick 2 teams" : "Create series"}</PrimaryButton>
      </main>
    </div>
  );
}

export function SeriesView() {
  const { series, seriesId, matches, go, removeSeries } = useStore();
  const [askDel, setAskDel] = useState(false);
  const s = series.find((x) => x.id === seriesId);
  if (!s) return null;
  const list = seriesMatches(s, matches);
  return (
    <div className="min-h-screen pb-10">
      <Header title={s.name} back={() => { useStore.setState({ cupsTab: "series" }); go("cups"); }}>
        <ScoreBoard s={s} matches={matches} />
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <p className="text-center text-xs text-mute">{seriesSub(s, seriesScore(s, matches))}{seriesScore(s, matches).done ? " · Ended" : ""}</p>
        <SeriesNext s={s} matches={matches} />
        <EndSeries s={s} matches={matches} />
        {list.map((m, i) => (
          <div key={m.id}>
            <p className="mb-1 px-1 text-xs font-semibold text-mute">Match {i + 1} · {rulesLabel(m.rules)}</p>
            <MatchCard m={m} />
          </div>
        ))}
        {!list.length && <p className="pt-2 text-center text-sm text-mute">No matches played yet.</p>}
        <button onClick={() => setAskDel(true)} className="press min-h-12 w-full rounded-2xl font-semibold text-out">Delete series</button>
      </main>
      {askDel && <ConfirmSheet title={`Delete ${s.name}?`} body="Its matches stay in History." yes="Delete" danger
        onYes={() => { removeSeries(s.id); go("cups"); }} onClose={() => setAskDel(false)} />}
    </div>
  );
}

/** Series score and the next match, shown under a finished series match. */
export function SeriesAfterMatch({ m }: { m: Match }) {
  const { series, matches, go } = useStore();
  const s = series.find((x) => x.id === m.series?.id);
  if (!s) return null;
  const names = seriesNames(s), sc = seriesScore(s, matches);
  return (
    <Card>
      <p className="text-xs font-semibold text-mute">{s.name.toUpperCase()}</p>
      <p className="mt-1 text-lg font-bold text-fg">{sc.text(names)}</p>
      <div className="mt-3 grid gap-2">
        <SeriesNext s={s} matches={matches} label="Play the next match" />
        <EndSeries s={s} matches={matches} />
        <button onClick={() => { useStore.setState({ seriesId: s.id }); go("series"); }} className="press min-h-12 rounded-2xl bg-key font-semibold text-teal">See the series</button>
      </div>
    </Card>
  );
}
