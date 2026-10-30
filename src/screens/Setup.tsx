import { useEffect, useState } from "react";
import * as E from "../engine/engine";
import type { Match, Player, Rules, Side, Team } from "../engine/types";
import { useStore } from "../store";
import { track } from "../track";
import { OpenersSheet } from "../sheets";
import { Badge, Card, cx, Header, Pill, PrimaryButton, Segmented, Stepper, Toggle } from "../ui";

const DEFAULT_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

function TeamCard({ label, name, setName, names, setNames, size, locked }: {
  label: string; name: string; setName: (s: string) => void; names: string[]; setNames: (n: string[]) => void; size: number; locked?: boolean;
}) {
  const saved = useStore((s) => s.teams);
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (t && !names.includes(t)) setNames([...names, t]); setV(""); };
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Badge name={name || label} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={label} maxLength={18} readOnly={locked}
          className="min-h-12 flex-1 rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none placeholder:text-mute" />
      </div>
      {!locked && saved.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {saved.map((t) => (
            <button key={t.id} onClick={() => { setName(t.name); setNames(t.players.map((p) => p.name)); }}
              className="press shrink-0 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-fg">{t.name}</button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((n) => (
          <button key={n} onClick={() => setNames(names.filter((x) => x !== n))}
            className="press flex min-h-10 items-center gap-1.5 rounded-full bg-sun-soft px-3 text-sm font-semibold text-fg">{n}<span className="text-mute">✕</span></button>
        ))}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a player" maxLength={20}
          className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
        <button className="press min-h-12 rounded-2xl bg-raised px-4 font-semibold text-white">Add</button>
      </form>
      <p className="mt-2 text-xs text-mute">{names.length >= size ? `${names.length} players` : `${names.length} named, ${size - names.length} more as Player N`}</p>
    </Card>
  );
}

const roster = (named: string[], size: number): Player[] => {
  const list = named.map((name) => ({ id: E.uid(), name }));
  for (let i = list.length; i < size; i++) list.push({ id: E.uid(), name: `Player ${i + 1}` });
  return list;
};

export default function Setup() {
  const { go, add, put, fixture, cups, teams, saveTeam } = useStore();
  const cup = fixture ? cups.find((c) => c.id === fixture.cupId) : undefined;
  const fx = cup?.fixtures.find((f) => f.id === fixture?.fixtureId);
  const [a, setA] = useState("Team A"), [b, setB] = useState("Team B");
  const [na, setNa] = useState<string[]>([]), [nb, setNb] = useState<string[]>([]);
  const [size, setSize] = useState(6);
  const [common, setCommon] = useState("");
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [custom, setCustom] = useState(false);
  const [toss, setToss] = useState<{ winner: Side; face: string } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [pending, setPending] = useState<Match | null>(null);
  const r = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setRules({ ...rules, [k]: v });
  useEffect(() => {
    if (!cup || !fx) return;
    const ta = teams.find((t) => t.id === fx.a), tb = teams.find((t) => t.id === fx.b);
    if (ta) { setA(ta.name); setNa(ta.players.map((p) => p.name)); }
    if (tb) { setB(tb.name); setNb(tb.players.map((p) => p.name)); }
    setRules(cup.rules);
  }, [cup, fx, teams]);

  function flip() {
    setFlipping(true); setToss(null);
    setTimeout(() => { setToss({ winner: Math.random() < 0.5 ? 0 : 1, face: Math.random() < 0.5 ? "HEADS" : "TAILS" }); setFlipping(false); }, 1300);
  }
  function begin(t: Match["toss"]) {
    const c = common.trim() ? { id: E.uid(), name: common.trim() } : null;
    const others = (names: string[]) => names.filter((n) => n.toLowerCase() !== c?.name.toLowerCase());
    const side = (names: string[]) => [...roster(others(names), Math.max(size, others(names).length)), ...(c ? [c] : [])];
    const pair: [Team, Team] = [
      { name: a.trim() || "Team A", players: side(na) },
      { name: b.trim() || "Team B", players: side(nb) },
    ];
    const m = E.newMatch(pair, rules);
    m.toss = t;
    if (cup && fx) m.cup = { id: cup.id, fixtureId: fx.id };
    for (const t of pair) if (!/^team [ab]$/i.test(t.name)) saveTeam(t.name, t.players.filter((p) => p.id !== c?.id));
    track("match_start", { overs: rules.overs, players: Math.max(size, na.length, nb.length), cup: cup ? 1 : 0, common: c ? 1 : 0 });
    setPending(m);
  }

  return (
    <div className="min-h-screen pb-10">
      <Header title={cup ? cup.name : "New Match"} back={() => { useStore.setState({ fixture: null }); go(cup ? "cup" : "home"); }} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <TeamCard label="Team A" name={a} setName={setA} names={na} setNames={setNa} size={size} locked={!!cup} />
        <TeamCard label="Team B" name={b} setName={setB} names={nb} setNames={setNb} size={size} locked={!!cup} />

        <Card>
          <p className="text-sm font-semibold text-teal">Common player</p>
          <p className="mt-1 text-xs text-mute">Odd number of players? One person can play for both teams. They bat in both innings and can bowl for either side, but not while batting.</p>
          <input value={common} onChange={(e) => setCommon(e.target.value)} placeholder="Name (optional)" maxLength={20}
            className="mt-3 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Players a side</p>
          <Stepper value={size} set={setSize} min={2} max={15} />
          <p className="mb-2 mt-4 text-sm font-semibold text-teal">Overs an innings</p>
          <div className="grid grid-cols-5 gap-2">
            {[3, 5, 6, 10].map((o) => <Pill key={o} active={!custom && rules.overs === o} onClick={() => { setCustom(false); r("overs")(o); }}>{o}</Pill>)}
            <Pill active={custom} onClick={() => setCustom(true)}>…</Pill>
          </div>
          {custom && <div className="mt-2"><Stepper value={rules.overs} set={r("overs")} max={50} /></div>}
        </Card>

        <Card>
          <p className="text-sm font-semibold text-teal">Gully rules</p>
          <div className="divide-y divide-line">
            <Toggle on={rules.extraRun} set={r("extraRun")} label="Wide and no-ball give 1 run" />
            <Toggle on={rules.rebowl} set={r("rebowl")} label="Wide and no-ball bowled again" />
            <Toggle on={rules.freeHit} set={r("freeHit")} label="Free hit after a no-ball" hint="Only run out on the next ball" />
            <Toggle on={rules.lastManStands} set={r("lastManStands")} label="Last man stands" hint="The last batter bats alone" />
            <Toggle on={rules.oneTipCatch} set={r("oneTipCatch")} label="One-tip one-hand catch is out" />
            <Toggle on={rules.tipAndRun} set={r("tipAndRun")} label="Tip and run" hint="A reminder for everyone, scoring is the same" />
            <div className="py-3">
              <p className="mb-2 font-semibold text-fg">Ball hits the wall or roof</p>
              <Segmented value={rules.wall} set={r("wall")} items={[{ v: "none", label: "Normal" }, { v: "four", label: "4" }, { v: "six", label: "6" }, { v: "out", label: "Out" }]} />
            </div>
            <div className="py-3">
              <Toggle on={rules.maxOversPerBowler !== null} set={(on) => r("maxOversPerBowler")(on ? Math.max(1, Math.ceil(rules.overs / 5)) : null)} label="Limit overs per bowler" />
              {rules.maxOversPerBowler !== null && <Stepper value={rules.maxOversPerBowler} set={r("maxOversPerBowler")} max={rules.overs} />}
            </div>
          </div>
        </Card>

        <Card className="text-center">
          <p className="text-sm font-semibold text-teal">Toss</p>
          <div className={cx("mx-auto my-4 grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffd2b0,#ff8a3d_55%,#c25a1c)] text-lg font-extrabold text-fg shadow-[0_10px_30px_-8px_rgba(255,138,61,.6)]", flipping && "coin-flip")}>
            {flipping ? "" : toss?.face ?? "TOSS"}
          </div>
          {toss ? (
            <>
              <p className="mb-3 text-lg font-bold text-fg">{(toss.winner === 0 ? a : b) || "Team"} won the toss</p>
              <div className="grid grid-cols-2 gap-2">
                <PrimaryButton onClick={() => begin({ winner: toss.winner, choice: "bat" })}>Bat first</PrimaryButton>
                <PrimaryButton tone="navy" onClick={() => begin({ winner: toss.winner, choice: "bowl" })}>Bowl first</PrimaryButton>
              </div>
            </>
          ) : <PrimaryButton disabled={flipping} onClick={flip}>Flip the coin</PrimaryButton>}
          <button onClick={() => begin(null)} className="press mt-3 min-h-12 w-full rounded-2xl font-semibold text-mute">Skip toss, {a || "Team A"} bats first</button>
        </Card>
      </main>
      {pending && <OpenersSheet match={pending} onClose={() => setPending(null)}
        onStart={(m) => { add(m); put(m); go("live", m.id); }} />}
    </div>
  );
}
