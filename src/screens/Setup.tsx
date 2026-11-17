import { useEffect, useMemo, useState } from "react";
import * as E from "../engine/engine";
import type { Match, Player, Rules, Side, Team } from "../engine/types";
import { useStore } from "../store";
import { playerPool } from "../stats";
import { seriesScore } from "../engine/series";
import { track } from "../track";
import { EV } from "../events";
import { flag, matchStartParams, presetIdOf } from "../matchEvents";
import { OpenersSheet, SoloTurnSheet } from "../sheets";
import { Badge, Card, cx, Header, PrimaryButton, Segmented, Sheet } from "../ui";
import { fairTeams, ratingsFor, type FairSplit } from "../records";
import { applyPreset, type PresetId } from "../presets";
import {
  DEFAULT_RULES, buildTeams, draftMatch, forMatch, modeOf, pairsOf, protectIds, roster, ruleSummary, shows, shuffled, soloSettings, withMode, type Mode,
} from "../setupOptions";
import { ChaseCard, FairStrip, FrenchFirst, OversCard, PairsCard, PairsStartSheet, PresetRow, RulesCardView, RulesEditor } from "../setupParts";

/** Splits "Rahul, Amit\nSam" into names, so a squad can be pasted in one go. */
const splitNames = (v: string) => v.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);

function TeamCard({ label, name, setName, names, setNames, size, setSize, locked, lockName, other, known }: {
  label: string; name: string; setName: (s: string) => void; names: string[]; setNames: (n: string[]) => void;
  size: number; setSize: (n: number) => void; locked?: boolean; lockName?: boolean; other: string; known: string[];
}) {
  const saved = useStore((s) => s.teams).filter((t) => t.name !== other);
  const [v, setV] = useState("");
  const add = (list: string[]) => {
    const have = new Set(names.map((n) => n.toLowerCase()));
    const fresh = list.filter((n) => !have.has(n.toLowerCase()) && have.add(n.toLowerCase()));
    if (fresh.length) setNames([...names, ...fresh]);
  };
  const unnamed = Math.max(0, size - names.length);
  return (
    <Card>
      <label className="flex items-center gap-3">
        <Badge name={name || label} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={label} maxLength={18} readOnly={locked || lockName} aria-label={`${label} name`}
          className="min-h-12 flex-1 rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none placeholder:text-mute focus:ring-2 focus:ring-sun" />
        {!locked && !lockName && <span className="text-mute" aria-hidden>✎</span>}
      </label>
      {!locked && !lockName && saved.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-mute">Your teams</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.map((t) => (
              <button key={t.id} onClick={() => { setName(t.name); setNames(t.players.map((p) => p.name)); }}
                className={cx("press shrink-0 rounded-full border px-3 py-2 text-sm font-semibold", t.name === name ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>
                {t.name} <span className="opacity-60">· {t.players.length}</span></button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((n) => (
          <span key={n} className="flex min-h-10 items-center rounded-full bg-sun-soft pl-3 text-sm font-semibold text-fg">
            {n}
            {!locked && <button onClick={() => setNames(names.filter((x) => x !== n))} aria-label={`Remove ${n}`} className="press grid h-10 w-9 place-items-center text-mute">✕</button>}
          </span>
        ))}
        {Array.from({ length: unnamed }, (_, i) => (
          <span key={i} className="flex min-h-10 items-center rounded-full border border-dashed border-line px-3 text-sm text-mute">Player {names.length + i + 1}</span>
        ))}
      </div>
      {!locked && <>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(splitNames(v)); setV(""); }}>
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Type names, comma between" maxLength={300} enterKeyHint="done"
            className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
          <button className="press min-h-12 rounded-2xl bg-raised px-4 font-semibold text-white disabled:opacity-40" disabled={!v.trim()}>Add</button>
        </form>
        {known.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-mute">Played before, tap to add</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {known.map((n) => <button key={n} onClick={() => add([n])} className="press shrink-0 rounded-full border border-line bg-key px-3 py-2 text-sm font-semibold text-fg">+ {n}</button>)}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <span className="flex-1"><span className="block text-sm font-semibold text-fg">{size} player{size === 1 ? "" : "s"}</span>
            <span className="block text-xs text-mute">{unnamed ? `${unnamed} without a name yet` : "Everyone's named"}</span></span>
          <button onClick={() => setSize(Math.max(1, names.length, size - 1))} disabled={size <= Math.max(1, names.length)} aria-label="One fewer player"
            className="press h-11 w-11 rounded-xl bg-key text-xl font-bold text-fg disabled:opacity-30">−</button>
          <button onClick={() => setSize(Math.min(15, size + 1))} aria-label="One more player" className="press h-11 w-11 rounded-xl bg-key text-xl font-bold text-fg">+</button>
        </div>
      </>}
    </Card>
  );
}

/** Tick who turned up today from everyone saved, then split them into two fair teams or at random. */
function PickPlayers({ names, chosen, onClose, onSplit, onFair }: {
  names: string[]; chosen: string[]; onClose: () => void; onSplit: (names: string[]) => void; onFair: (names: string[]) => void;
}) {
  const [on, setOn] = useState(() => new Set(chosen.map((n) => n.toLowerCase())));
  const picked = names.filter((n) => on.has(n.toLowerCase()));
  const flip = (n: string) => { const next = new Set(on), k = n.toLowerCase(); if (!next.delete(k)) next.add(k); setOn(next); };
  return (
    <Sheet title="Who's playing today?" onClose={onClose}
      footer={<div className="grid grid-cols-2 gap-2">
        <PrimaryButton disabled={picked.length < 2} onClick={() => onFair(picked)}>Fair teams</PrimaryButton>
        <PrimaryButton tone="navy" disabled={picked.length < 2} onClick={() => onSplit(picked)}>Split {picked.length} at random</PrimaryButton>
      </div>}>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-mute">{picked.length} picked</span>
        <button onClick={() => setOn(new Set(picked.length === names.length ? [] : names.map((n) => n.toLowerCase())))} className="press min-h-10 font-semibold text-sun">
          {picked.length === names.length ? "Clear all" : "Pick all"}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <button key={n} onClick={() => flip(n)} aria-pressed={on.has(n.toLowerCase())}
            className={cx("press min-h-11 rounded-full border px-4 text-sm font-semibold", on.has(n.toLowerCase()) ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>
            {on.has(n.toLowerCase()) ? "✓ " : ""}{n}</button>
        ))}
      </div>
    </Sheet>
  );
}

/** Solo: one list of everyone playing, in batting order. Saved teams and past names add in one tap. */
function SoloPlayers({ names, setNames, known }: { names: string[]; setNames: (n: string[]) => void; known: string[] }) {
  const saved = useStore((s) => s.teams);
  const [v, setV] = useState("");
  const add = (list: string[]) => {
    const have = new Set(names.map((n) => n.toLowerCase()));
    const fresh = list.filter((n) => !have.has(n.toLowerCase()) && have.add(n.toLowerCase()));
    if (fresh.length) setNames([...names, ...fresh]);
  };
  return (
    <Card>
      <p className="font-semibold text-fg">Who's playing?</p>
      <p className="text-xs text-mute">Everyone bats on their own. Most runs wins.</p>
      {saved.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-mute">Your teams, tap to add everyone</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.map((t) => (
              <button key={t.id} onClick={() => add(t.players.map((p) => p.name))} className="press shrink-0 rounded-full border border-line bg-key px-3 py-2 text-sm font-semibold text-fg">
                {t.name} <span className="opacity-60">· {t.players.length}</span></button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((n) => (
          <span key={n} className="flex min-h-10 items-center rounded-full bg-sun-soft pl-3 text-sm font-semibold text-fg">
            {n}
            <button onClick={() => setNames(names.filter((x) => x !== n))} aria-label={`Remove ${n}`} className="press grid h-10 w-9 place-items-center text-mute">✕</button>
          </span>
        ))}
        {names.length < 2 && Array.from({ length: 2 - names.length }, (_, i) => (
          <span key={i} className="flex min-h-10 items-center rounded-full border border-dashed border-line px-3 text-sm text-mute">Player {names.length + i + 1}</span>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(splitNames(v)); setV(""); }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Type names, comma between" maxLength={300} enterKeyHint="done" aria-label="Add players"
          className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
        <button className="press min-h-12 rounded-2xl bg-raised px-4 font-semibold text-white disabled:opacity-40" disabled={!v.trim()}>Add</button>
      </form>
      {known.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-mute">Played before, tap to add</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {known.map((n) => <button key={n} onClick={() => add([n])} className="press shrink-0 rounded-full border border-line bg-key px-3 py-2 text-sm font-semibold text-fg">+ {n}</button>)}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Solo: the batting order, with a shuffle and a nudge up for each name. */
function BattingOrder({ names, setNames }: { names: string[]; setNames: (n: string[]) => void }) {
  const up = (i: number) => { const l = [...names]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setNames(l); };
  function shuffle() {
    const l = [...names];
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    setNames(l);
  }
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-teal">Who bats first</p>
        <button onClick={shuffle} disabled={names.length < 2} className="press min-h-10 rounded-full border border-line bg-key px-3 text-sm font-semibold text-fg disabled:opacity-40">🔀 Shuffle</button>
      </div>
      {names.length ? (
        <ol className="mt-2 divide-y divide-line">
          {names.map((n, i) => (
            <li key={n} className="flex min-h-12 items-center gap-3">
              <span className="w-6 text-sm font-bold text-mute tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate font-semibold text-fg">{n}</span>
              {i > 0 && <button onClick={() => up(i)} aria-label={`Move ${n} up`} className="press grid h-10 w-10 place-items-center rounded-xl bg-key text-fg">↑</button>}
            </li>
          ))}
        </ol>
      ) : <p className="mt-2 text-sm text-mute">Add players and they line up here in batting order.</p>}
    </Card>
  );
}

const sameList = (x: string[], y: string[]) => x.length === y.length && x.every((n, i) => n.toLowerCase() === y[i].toLowerCase());

/** Named players plus the "Player n" placeholders the team will be padded with, in batting order. */
const padded = (names: string[], size: number) => [...names, ...Array.from({ length: Math.max(0, size - names.length) }, (_, i) => `Player ${names.length + i + 1}`)];

interface Fair { pool: string[]; common: string | null; seed: number; split: FairSplit }

export default function Setup() {
  const { go, add, put, fixture, cups, teams, matches, saveTeam, lastSetup, seriesPlay, series: allSeries } = useStore();
  const cup = fixture ? cups.find((c) => c.id === fixture.cupId) : undefined;
  const fx = cup?.fixtures.find((f) => f.id === fixture?.fixtureId);
  const series = !cup && seriesPlay ? allSeries.find((x) => x.id === seriesPlay) : undefined;
  const last = cup || series ? null : lastSetup;
  const lastSolo = last && (last.rules.format === "solo" || last.rules.format === "french") ? last : null, lastTeams = lastSolo ? null : last;
  const [rules, setRules] = useState<Rules>(last ? { ...DEFAULT_RULES, ...last.rules, protectedPlayers: undefined } : DEFAULT_RULES);
  const mode: Mode = cup || series ? "teams" : modeOf(rules);
  const solo = mode === "solo" || mode === "french", test = !cup && rules.format === "test";
  const [a, setA] = useState(lastTeams?.a ?? "Team A"), [b, setB] = useState(lastTeams?.b ?? "Team B");
  const [na, setNa] = useState<string[]>(lastTeams?.na ?? []), [nb, setNb] = useState<string[]>(lastTeams?.nb ?? []);
  const [sa, setSa] = useState(lastTeams?.sa ?? lastTeams?.size ?? 6), [sb, setSb] = useState(lastTeams?.sb ?? lastTeams?.size ?? 6);
  const [common, setCommon] = useState(lastTeams?.common ?? "");
  const [soloNames, setSoloNames] = useState<string[]>(lastSolo?.na ?? (lastTeams ? [...lastTeams.na, ...lastTeams.nb] : []));
  const [frenchFirst, setFrenchFirst] = useState<string | null>(null);
  const [prot, setProt] = useState<string[]>([]);
  const [fair, setFair] = useState<Fair | null>(null);
  const [chaseOn, setChaseOn] = useState(false), [chaseSide, setChaseSide] = useState<Side>(1);
  const [target, setTarget] = useState(""), [down, setDown] = useState(0);
  const [soloPending, setSoloPending] = useState<Match | null>(null);
  const clear = () => {
    setA("Team A"); setB("Team B"); setNa([]); setNb([]); setSa(6); setSb(6); setCommon(""); setRules(DEFAULT_RULES);
    setSoloNames([]); setFrenchFirst(null); setProt([]); setFair(null); setChaseOn(false);
    useStore.setState({ lastSetup: null });
  };
  const [toss, setToss] = useState<{ winner: Side; face: string } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [pending, setPending] = useState<Match | null>(null);
  const [tossOpen, setTossOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    if (!cup || !fx) return;
    const ta = teams.find((t) => t.id === fx.a), tb = teams.find((t) => t.id === fx.b);
    if (ta) { setA(ta.name); setNa(ta.players.map((p) => p.name)); }
    if (tb) { setB(tb.name); setNb(tb.players.map((p) => p.name)); }
    setRules(cup.rules);
  }, [cup, fx, teams]);
  useEffect(() => {
    if (!series) return;
    const ta = teams.find((t) => t.id === series.a), tb = teams.find((t) => t.id === series.b);
    if (ta) { setA(ta.name); setNa(ta.players.map((p) => p.name)); }
    if (tb) { setB(tb.name); setNb(tb.players.map((p) => p.name)); }
    setRules(series.rules);
    // Only when the series changes: later edits to the players here are kept.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id]);
  const seriesNo = series ? seriesScore(series, matches) : null;

  // Naming players sets that team's size, so nobody gets "Player 5" padding they didn't ask for.
  useEffect(() => { if (na.length) setSa(na.length); }, [na.length]);
  useEffect(() => { if (nb.length) setSb(nb.length); }, [nb.length]);
  const taken = new Set((solo ? soloNames : [...na, ...nb, common.trim()]).map((n) => n.toLowerCase()));
  const pool = playerPool(matches, teams).filter((n) => n.toLowerCase() !== common.trim().toLowerCase());
  const known = pool.filter((n) => !taken.has(n.toLowerCase())).slice(0, 30);
  const [picking, setPicking] = useState(false);
  const first = soloNames.find((n) => n === frenchFirst) ?? soloNames[0] ?? null;
  function shuffle(names = [...na, ...nb]) {
    const list = shuffled(names), half = Math.ceil(list.length / 2);
    setNa(list.slice(0, half)); setNb(list.slice(half)); setSa(Math.max(1, half)); setSb(Math.max(1, list.length - half));
  }
  function fairSplit(names: string[], given: string | null, seed: number) {
    track(EV.fair_teams, { reshuffle: flag(seed > 0) });
    const split = fairTeams(names, ratingsFor(matches, names, test ? "test" : "limited"), { common: given, seed });
    setNa(split.a); setNb(split.b); setSa(Math.max(1, split.a.length)); setSb(Math.max(1, split.b.length));
    if (split.common) setCommon(split.common);
    setFair({ pool: names, common: given, seed, split });
  }
  const fairShown = fair && sameList(na, fair.split.a) && sameList(nb, fair.split.b) ? fair : null;
  const pick = (id: PresetId) => { track(EV.preset_pick, { id }); setRules(applyPreset(id, rules)); };

  const built = useMemo(() => buildTeams(a, b, na, nb, sa, sb, common), [a, b, na, nb, sa, sb, common]);
  const soloPlayers = useMemo(() => soloNames.map((name) => ({ id: E.uid(), name })), [soloNames]);
  const matchRules = (teams: Team[]): Rules => {
    const out = forMatch(cup ? { ...rules, format: undefined } : rules, mode, test), ids = protectIds(teams, prot);
    if (ids.length && shows("protected", mode, test)) out.protectedPlayers = ids; else delete out.protectedPlayers;
    return out;
  };
  const card = useMemo(() => {
    const m = draftMatch(rules, mode, test, built.teams, soloPlayers);
    if (!solo) m.rules = matchRules(built.teams);
    return E.rulesCard(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, mode, test, built, soloPlayers, prot]);
  const chasing = chaseOn && !cup && !series && !test && !solo;
  const targetRuns = Number(target) || 0;
  const chaseLine = chasing && targetRuns > 0
    ? `${(chaseSide === 0 ? a : b) || "Team"} need ${targetRuns} to win. ${chaseSide === 0 ? b || "Team B" : a || "Team A"} lost ${down} wicket${down === 1 ? "" : "s"}.` : null;

  function flip() {
    setFlipping(true); setToss(null);
    setTimeout(() => { setToss({ winner: Math.random() < 0.5 ? 0 : 1, face: Math.random() < 0.5 ? "HEADS" : "TAILS" }); setFlipping(false); }, 1300);
  }
  function saveTeams(pair: Team[], c: Player | null) {
    for (const t of pair) if (!/^team [ab]$/i.test(t.name)) saveTeam(t.name, t.players.filter((p) => p.id !== c?.id));
  }
  function begin(t: Match["toss"]) {
    const { teams: pair, common: c } = buildTeams(a, b, na, nb, sa, sb, common);
    const m = E.newMatch(pair, matchRules(pair));
    m.toss = t;
    if (cup && fx) m.cup = { id: cup.id, fixtureId: fx.id };
    if (series) m.series = { id: series.id };
    saveTeams(pair, c);
    setTossOpen(false);
    setPending(m);
  }
  function beginChase() {
    const { teams: pair, common: c } = buildTeams(a, b, na, nb, sa, sb, common);
    const ordered: [Team, Team] = chaseSide === 1 ? pair : [pair[1], pair[0]];
    saveTeams(pair, c);
    setPending(E.startChase(ordered, matchRules(ordered), targetRuns, down));
  }
  function beginSolo() {
    setSoloPending(E.newSoloMatch(soloNames.map((name) => ({ id: E.uid(), name })), soloSettings(rules, "solo")));
  }
  function launch(m: Match, quick = false) {
    const preset = quick ? presetIdOf(m.rules, modeOf(m.rules), m.rules.format === "test") : presetIdOf(rules, mode, test);
    track(EV.match_start, matchStartParams(m, preset, quick));
    add(m); put(m); go("live", m.id);
  }
  function beginFrench() {
    const players = soloNames.map((name) => ({ id: E.uid(), name })), batter = players.find((p) => p.name === first) ?? players[0];
    const m = E.startFrench(players, soloSettings(rules, "french"), batter.id);
    useStore.setState({ lastSetup: { a: "", b: "", na: soloNames, nb: [], size: soloNames.length, rules: m.rules, common: "" } });
    launch(m);
  }
  /** Placeholder teams and the last match's rules, straight to the first ball. */
  function quickMatch() {
    const r = lastSetup ? { ...DEFAULT_RULES, ...lastSetup.rules, protectedPlayers: undefined } : DEFAULT_RULES, qm = modeOf(r);
    const n = Math.max(2, lastSetup ? (qm === "solo" || qm === "french" ? lastSetup.na.length : Math.max(lastSetup.sa ?? lastSetup.size, lastSetup.sb ?? lastSetup.size)) : 6);
    if (qm === "solo" || qm === "french") {
      const players = roster([], n), settings = soloSettings(r, qm);
      return launch(qm === "french" ? E.startFrench(players, settings) : E.startSolo(players, settings), true);
    }
    const pair: [Team, Team] = [{ name: "Team A", players: roster([], n) }, { name: "Team B", players: roster([], n) }];
    const m = E.newMatch(pair, forMatch(r, qm, r.format === "test"));
    const [s, ns] = pair[0].players, ids = pair[0].players.map((p) => p.id);
    launch(E.startInnings(m, s.id, ns.id, pair[1].players[0].id, qm === "pairs" ? { pairs: pairsOf(ids) } : undefined), true);
  }

  const on = ruleSummary(rules, mode, test, common);
  const protNames = [...new Set([...na, ...nb, common.trim()].filter(Boolean))];
  const chaseReady = !chasing || targetRuns > 0;
  const PendingSheet = mode === "pairs" ? PairsStartSheet : OpenersSheet;

  return (
    <div className="min-h-screen pb-36">
      <Header title={cup ? cup.name : series ? series.name : "New Match"} back={() => { useStore.setState({ fixture: null, seriesPlay: null }); go(cup ? "cup" : series ? "series" : "home"); }} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        {!cup && !series && <button onClick={quickMatch} className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-left">
          <span className="text-xl" aria-hidden>⚡</span>
          <span className="flex-1"><span className="block font-semibold text-fg">Quick match</span>
            <span className="block text-xs text-mute">Team A vs Team B, Player 1, 2, 3... {lastSetup ? "Your last rules" : "Standard rules"}. Straight to the first ball.</span></span>
          <span className="text-mute" aria-hidden>→</span>
        </button>}
        {last && <div className="flex items-center justify-between gap-3 rounded-2xl bg-sun-soft px-4 py-2 text-sm text-fg">
          <span>Filled in from your last match</span>
          <button onClick={clear} className="press min-h-10 shrink-0 font-semibold text-sun">Start fresh</button>
        </div>}
        {series && seriesNo && <div className="rounded-2xl bg-sun-soft px-4 py-3 text-sm text-fg">
          <p className="font-bold">Match {seriesNo.played + 1} of {series.games} · {series.rules.format === "test" ? "Test" : `${series.rules.overs} overs`}</p>
          <p className="text-fg/80">{seriesNo.text([a, b])}. Teams and rules are filled in from the series.</p>
        </div>}
        {!cup && !series && <PresetRow rules={rules} mode={mode} test={test} onPick={pick} />}
        {!cup && !series && <Segmented<Mode> value={mode} set={(v) => setRules(withMode(rules, v, v === "teams" && test))}
          items={[{ v: "teams", label: "Teams" }, { v: "pairs", label: "Pairs" }, { v: "solo", label: "Solo" }, { v: "french", label: "French" }]} />}
        {solo ? <>
          <SoloPlayers names={soloNames} setNames={setSoloNames} known={known} />
        </> : <>
        <TeamCard label="Team A" name={a} setName={setA} names={na} setNames={setNa} size={sa} setSize={setSa} locked={!!cup} lockName={!!series} other={b} known={known} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-extrabold tracking-[0.3em] text-mute">VS</span>
          {!cup && !series && na.length + nb.length >= 2 && <>
            <button onClick={() => shuffle()} className="press min-h-10 rounded-full border border-line bg-key px-3 text-sm font-semibold text-fg">🔀 Shuffle teams</button>
            <button onClick={() => fairSplit([...na, ...nb], common.trim() || null, 0)} className="press min-h-10 rounded-full border border-line bg-key px-3 text-sm font-semibold text-fg">⚖️ Fair teams</button>
          </>}
        </div>
        {fairShown && <FairStrip a={a || "Team A"} b={b || "Team B"} ratingA={fairShown.split.ratingA} ratingB={fairShown.split.ratingB}
          onReshuffle={() => fairSplit(fairShown.pool, fairShown.common, fairShown.seed + 1)} />}
        {!cup && !series && pool.length >= 2 && <button onClick={() => setPicking(true)} className="press min-h-12 w-full rounded-2xl border-2 border-dashed border-sun bg-sun-soft font-semibold text-fg">
          Pick today's players from {pool.length} saved</button>}
        <TeamCard label="Team B" name={b} setName={setB} names={nb} setNames={setNb} size={sb} setSize={setSb} locked={!!cup} lockName={!!series} other={a} known={known} />
        {mode === "pairs" && <>
          <PairsCard team={a || "Team A"} names={padded(na, sa)} common={common} setNames={setNa} />
          <PairsCard team={b || "Team B"} names={padded(nb, sb)} common={common} setNames={setNb} />
        </>}
        </>}

        {!cup && !series && mode === "teams" && <Segmented value={test ? "test" : "limited"} set={(v) => setRules(withMode(rules, "teams", v === "test"))}
          items={[{ v: "limited", label: "Limited overs" }, { v: "test", label: "Test match" }]} />}

        {!series && <OversCard key={`${mode}-${test}`} rules={rules} setRules={setRules} mode={mode} test={test}
          pairsCount={Math.max(1, Math.ceil((Math.max(sa, sb) + (common.trim() ? 1 : 0)) / 2))} />}

        <Card className="!p-0 overflow-hidden">
          <button onClick={() => setShowRules(!showRules)} className="press flex w-full items-center gap-3 px-4 py-4 text-left">
            <span className="flex-1"><span className="block font-semibold text-fg">Gully rules</span>
              <span className="block text-xs text-mute">{on || "Standard cricket"}</span></span>
            <span className={cx("text-mute transition-transform", showRules && "rotate-180")}>⌄</span>
          </button>
          {showRules && <div className="border-t border-line">
            <RulesEditor rules={rules} setRules={setRules} mode={mode} test={test} common={common} setCommon={setCommon}
              names={protNames} prot={prot} setProt={setProt} />
          </div>}
        </Card>
        {mode === "solo" && <BattingOrder names={soloNames} setNames={setSoloNames} />}
        {mode === "french" && <FrenchFirst names={soloNames} first={first} setFirst={setFrenchFirst} />}
        {!cup && !series && !test && !solo && <ChaseCard on={chaseOn} setOn={setChaseOn} side={chaseSide} setSide={setChaseSide} target={target} setTarget={setTarget}
          down={down} setDown={setDown} a={a} b={b} maxDown={Math.max(0, (chaseSide === 0 ? sb : sa) - 1)} />}
        <RulesCardView lines={card} extra={chaseLine} />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] bg-gradient-to-t from-cream from-60% to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-8">
        {mode === "solo"
          ? <PrimaryButton disabled={soloNames.length < 2} onClick={beginSolo}>{soloNames.length < 2 ? "Add at least 2 players" : `Start, ${soloNames[0]} bats first`}</PrimaryButton>
          : mode === "french"
            ? <PrimaryButton disabled={soloNames.length < 2} onClick={beginFrench}>{soloNames.length < 2 ? "Add at least 2 players" : `Start, ${first} bats first`}</PrimaryButton>
            : chasing
              ? <PrimaryButton disabled={!chaseReady} onClick={beginChase}>{chaseReady ? "Agree rules, start the chase →" : "Enter the target"}</PrimaryButton>
              : <PrimaryButton onClick={() => setTossOpen(true)}>Agree rules, next: toss →</PrimaryButton>}
      </div>

      {tossOpen && (
        <Sheet title="Toss" onClose={() => { if (!flipping) { setTossOpen(false); setToss(null); } }}>
          <div className="text-center">
            <div className={cx("mx-auto my-2 grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffd2b0,#ff8a3d_55%,#c25a1c)] text-lg font-extrabold text-fg shadow-[0_10px_30px_-8px_rgba(255,138,61,.6)]", flipping && "coin-flip")}>
              {flipping ? "" : toss?.face ?? "TOSS"}
            </div>
            {toss ? (
              <>
                <p className="mb-3 mt-3 text-lg font-bold text-fg">{(toss.winner === 0 ? a : b) || "Team"} won the toss</p>
                <div className="grid grid-cols-2 gap-2">
                  <PrimaryButton onClick={() => begin({ winner: toss.winner, choice: "bat" })}>Bat first</PrimaryButton>
                  <PrimaryButton tone="navy" onClick={() => begin({ winner: toss.winner, choice: "bowl" })}>Bowl first</PrimaryButton>
                </div>
              </>
            ) : <div className="mt-4"><PrimaryButton disabled={flipping} onClick={flip}>Flip the coin</PrimaryButton></div>}
            <button onClick={() => begin(null)} className="press mt-2 min-h-12 w-full rounded-2xl font-semibold text-mute">Skip toss, {a || "Team A"} bats first</button>
          </div>
        </Sheet>
      )}
      {picking && <PickPlayers names={[...new Set([...na, ...nb, ...pool])]} chosen={[...na, ...nb]} onClose={() => setPicking(false)}
        onSplit={(list) => { shuffle(list); setPicking(false); }} onFair={(list) => { fairSplit(list, common.trim() || null, 0); setPicking(false); }} />}
      {soloPending && <SoloTurnSheet match={soloPending} onClose={() => setSoloPending(null)}
        onStart={(m) => {
          useStore.setState({ lastSetup: { a: "", b: "", na: soloNames, nb: [], size: soloNames.length, rules: m.rules, common: "" } });
          launch(m);
        }} />}
      {pending && <PendingSheet match={pending} onClose={() => setPending(null)}
        onStart={(m) => {
          if (!m.cup && !m.series) useStore.setState({ lastSetup: { a, b, na, nb, size: Math.max(sa, sb), sa, sb, rules: forMatch(rules, mode, test), common } });
          launch(m);
        }} />}
    </div>
  );
}
