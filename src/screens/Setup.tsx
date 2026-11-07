import { useEffect, useState } from "react";
import * as E from "../engine/engine";
import type { Match, Player, Rules, Side, Team } from "../engine/types";
import { useStore } from "../store";
import { playerPool } from "../stats";
import { track } from "../track";
import { OpenersSheet } from "../sheets";
import { Badge, Card, cx, Header, Pill, PrimaryButton, Segmented, Sheet, Stepper, Toggle } from "../ui";

const DEFAULT_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

/** Splits "Rahul, Amit\nSam" into names, so a squad can be pasted in one go. */
const splitNames = (v: string) => v.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);

function TeamCard({ label, name, setName, names, setNames, size, setSize, locked, other, known }: {
  label: string; name: string; setName: (s: string) => void; names: string[]; setNames: (n: string[]) => void;
  size: number; setSize: (n: number) => void; locked?: boolean; other: string; known: string[];
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={label} maxLength={18} readOnly={locked} aria-label={`${label} name`}
          className="min-h-12 flex-1 rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none placeholder:text-mute focus:ring-2 focus:ring-sun" />
        {!locked && <span className="text-mute" aria-hidden>✎</span>}
      </label>
      {!locked && saved.length > 0 && (
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

/** Tick who turned up today from everyone saved, then split them into two teams at random. */
function PickPlayers({ names, chosen, onClose, onSplit }: { names: string[]; chosen: string[]; onClose: () => void; onSplit: (names: string[]) => void }) {
  const [on, setOn] = useState(() => new Set(chosen.map((n) => n.toLowerCase())));
  const picked = names.filter((n) => on.has(n.toLowerCase()));
  const flip = (n: string) => { const next = new Set(on), k = n.toLowerCase(); if (!next.delete(k)) next.add(k); setOn(next); };
  return (
    <Sheet title="Who's playing today?" onClose={onClose}
      footer={<PrimaryButton disabled={picked.length < 2} onClick={() => onSplit(picked)}>Split {picked.length} into 2 teams</PrimaryButton>}>
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

const roster = (named: string[], size: number): Player[] => {
  const list = named.map((name) => ({ id: E.uid(), name }));
  for (let i = list.length; i < size; i++) list.push({ id: E.uid(), name: `Player ${i + 1}` });
  return list;
};

const OVERS = [3, 4, 5, 6, 10];

export default function Setup() {
  const { go, add, put, fixture, cups, teams, matches, saveTeam, lastSetup } = useStore();
  const cup = fixture ? cups.find((c) => c.id === fixture.cupId) : undefined;
  const fx = cup?.fixtures.find((f) => f.id === fixture?.fixtureId);
  const last = cup ? null : lastSetup;
  const [a, setA] = useState(last?.a ?? "Team A"), [b, setB] = useState(last?.b ?? "Team B");
  const [na, setNa] = useState<string[]>(last?.na ?? []), [nb, setNb] = useState<string[]>(last?.nb ?? []);
  const [sa, setSa] = useState(last?.sa ?? last?.size ?? 6), [sb, setSb] = useState(last?.sb ?? last?.size ?? 6);
  const [common, setCommon] = useState(last?.common ?? "");
  const [rules, setRules] = useState<Rules>(last ? { ...DEFAULT_RULES, ...last.rules } : DEFAULT_RULES);
  const [custom, setCustom] = useState(!OVERS.includes(last?.rules.overs ?? DEFAULT_RULES.overs));
  const clear = () => {
    setA("Team A"); setB("Team B"); setNa([]); setNb([]); setSa(6); setSb(6); setCommon(""); setRules(DEFAULT_RULES); setCustom(false);
    useStore.setState({ lastSetup: null });
  };
  const [toss, setToss] = useState<{ winner: Side; face: string } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [pending, setPending] = useState<Match | null>(null);
  const [tossOpen, setTossOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const r = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setRules({ ...rules, [k]: v });
  useEffect(() => {
    if (!cup || !fx) return;
    const ta = teams.find((t) => t.id === fx.a), tb = teams.find((t) => t.id === fx.b);
    if (ta) { setA(ta.name); setNa(ta.players.map((p) => p.name)); }
    if (tb) { setB(tb.name); setNb(tb.players.map((p) => p.name)); }
    setRules(cup.rules);
  }, [cup, fx, teams]);

  // Naming players sets that team's size, so nobody gets "Player 5" padding they didn't ask for.
  useEffect(() => { if (na.length) setSa(na.length); }, [na.length]);
  useEffect(() => { if (nb.length) setSb(nb.length); }, [nb.length]);
  const taken = new Set([...na, ...nb, common.trim()].map((n) => n.toLowerCase()));
  const pool = playerPool(matches, teams).filter((n) => n.toLowerCase() !== common.trim().toLowerCase());
  const known = pool.filter((n) => !taken.has(n.toLowerCase())).slice(0, 30);
  const [picking, setPicking] = useState(false);
  function shuffle(names = [...na, ...nb]) {
    const list = [...names];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const half = Math.ceil(list.length / 2);
    setNa(list.slice(0, half)); setNb(list.slice(half)); setSa(Math.max(1, half)); setSb(Math.max(1, list.length - half));
  }

  function flip() {
    setFlipping(true); setToss(null);
    setTimeout(() => { setToss({ winner: Math.random() < 0.5 ? 0 : 1, face: Math.random() < 0.5 ? "HEADS" : "TAILS" }); setFlipping(false); }, 1300);
  }
  function begin(t: Match["toss"]) {
    const c = common.trim() ? { id: E.uid(), name: common.trim() } : null;
    const others = (names: string[]) => names.filter((n) => n.toLowerCase() !== c?.name.toLowerCase());
    const side = (names: string[], size: number) => [...roster(others(names), Math.max(size, others(names).length)), ...(c ? [c] : [])];
    const pair: [Team, Team] = [
      { name: a.trim() || "Team A", players: side(na, sa) },
      { name: b.trim() || "Team B", players: side(nb, sb) },
    ];
    const m = E.newMatch(pair, rules);
    m.toss = t;
    if (cup && fx) m.cup = { id: cup.id, fixtureId: fx.id };
    for (const t of pair) if (!/^team [ab]$/i.test(t.name)) saveTeam(t.name, t.players.filter((p) => p.id !== c?.id));
    track("match_start", { overs: rules.overs, players: Math.max(sa, sb), cup: cup ? 1 : 0, common: c ? 1 : 0 });
    setTossOpen(false);
    setPending(m);
  }

  const on = [rules.extraRun && "Wide +1", rules.rebowl && "Re-bowl", rules.freeHit && "Free hit", rules.lastManStands && "Last man stands",
    rules.oneTipCatch && "One-tip catch", rules.wall !== "none" && `Wall ${rules.wall}`, rules.maxOversPerBowler && `${rules.maxOversPerBowler} overs a bowler`,
    common.trim() && `${common.trim()} plays both sides`].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen pb-36">
      <Header title={cup ? cup.name : "New Match"} back={() => { useStore.setState({ fixture: null }); go(cup ? "cup" : "home"); }} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        {last && <div className="flex items-center justify-between gap-3 rounded-2xl bg-sun-soft px-4 py-2 text-sm text-fg">
          <span>Filled in from your last match</span>
          <button onClick={clear} className="press min-h-10 shrink-0 font-semibold text-sun">Start fresh</button>
        </div>}
        <TeamCard label="Team A" name={a} setName={setA} names={na} setNames={setNa} size={sa} setSize={setSa} locked={!!cup} other={b} known={known} />
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs font-extrabold tracking-[0.3em] text-mute">VS</span>
          {!cup && na.length + nb.length >= 2 && <button onClick={() => shuffle()} className="press min-h-10 rounded-full border border-line bg-key px-3 text-sm font-semibold text-fg">🔀 Shuffle teams</button>}
        </div>
        {!cup && pool.length >= 2 && <button onClick={() => setPicking(true)} className="press min-h-12 w-full rounded-2xl border-2 border-dashed border-sun bg-sun-soft font-semibold text-fg">
          Pick today's players from {pool.length} saved</button>}
        <TeamCard label="Team B" name={b} setName={setB} names={nb} setNames={setNb} size={sb} setSize={setSb} locked={!!cup} other={a} known={known} />

        <Card>
          <p className="mb-2 text-sm font-semibold text-teal">Overs an innings</p>
          <div className="grid grid-cols-6 gap-2">
            {OVERS.map((o) => <Pill key={o} active={!custom && rules.overs === o} onClick={() => { setCustom(false); r("overs")(o); }}>{o}</Pill>)}
            <Pill active={custom} onClick={() => setCustom(true)}>…</Pill>
          </div>
          {custom && <div className="mt-2"><Stepper value={rules.overs} set={r("overs")} max={50} /></div>}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <button onClick={() => setShowRules(!showRules)} className="press flex w-full items-center gap-3 px-4 py-4 text-left">
            <span className="flex-1"><span className="block font-semibold text-fg">Gully rules</span>
              <span className="block text-xs text-mute">{on || "Standard cricket"}</span></span>
            <span className={cx("text-mute transition-transform", showRules && "rotate-180")}>⌄</span>
          </button>
          {showRules && <div className="divide-y divide-line border-t border-line px-4">
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
              <Toggle on={rules.maxOversPerBowler !== null} set={(v) => r("maxOversPerBowler")(v ? Math.max(1, Math.ceil(rules.overs / 5)) : null)} label="Limit overs per bowler" />
              {rules.maxOversPerBowler !== null && <Stepper value={rules.maxOversPerBowler} set={r("maxOversPerBowler")} max={rules.overs} />}
            </div>
            <div className="py-3">
              <p className="font-semibold text-fg">Common player</p>
              <p className="mt-0.5 text-xs text-mute">Odd number of players? One person plays for both teams. They bat in both innings and can bowl for either side, but not while batting.</p>
              <input value={common} onChange={(e) => setCommon(e.target.value)} placeholder="Name (optional)" maxLength={20}
                className="mt-2 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
            </div>
          </div>}
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] bg-gradient-to-t from-cream from-60% to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-8">
        <PrimaryButton onClick={() => setTossOpen(true)}>Next: toss →</PrimaryButton>
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
        onSplit={(list) => { shuffle(list); setPicking(false); }} />}
      {pending && <OpenersSheet match={pending} onClose={() => setPending(null)}
        onStart={(m) => {
          if (!m.cup) useStore.setState({ lastSetup: { a, b, na, nb, size: Math.max(sa, sb), sa, sb, rules, common } });
          add(m); put(m); go("live", m.id);
        }} />}
    </div>
  );
}
