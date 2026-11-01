import { useState } from "react";
import * as E from "./engine/engine";
import type { Ball, Extra, Match, Player, Side, Wicket, WicketKind } from "./engine/types";
import { Badge, cx, Pill, PrimaryButton, Sheet, Stepper } from "./ui";

export function addPlayer(m: Match, side: Side, name: string): { match: Match; id: string } {
  const n: Match = JSON.parse(JSON.stringify(m)), id = E.uid();
  n.teams[side].players.push({ id, name: name.trim() });
  n.innings.forEach((inn) => { if (inn.bat === side) inn.wicketLimit = inn.superOver ? inn.wicketLimit : E.wicketLimit(n.teams[side], n.rules, inn.solo); });
  return { match: n, id };
}

function PlayerPick({ players, value, set, disabled, note }: {
  players: Player[]; value: string | null; set: (id: string) => void; disabled?: (id: string) => boolean; note?: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <button key={p.id} onClick={() => set(p.id)} disabled={disabled?.(p.id)}
          className={cx("press flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 text-left disabled:opacity-35",
            value === p.id ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>
          <Badge name={p.name} size={36} />
          <span className="leading-tight"><span className="block text-sm font-semibold">{p.name}</span>
            {note && <span className={cx("block text-[11px]", value === p.id ? "text-white/80" : "text-mute")}>{note(p.id)}</span>}</span>
        </button>
      ))}
    </div>
  );
}

function AddName({ onAdd, label }: { onAdd: (name: string) => void; label: string }) {
  const [v, setV] = useState("");
  return (
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v); setV(""); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={label} maxLength={20}
        className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 font-medium outline-none focus:border-sun" />
      <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
    </form>
  );
}

/** Pick openers and the first bowler. Pre-filled so one tap starts the innings. */
export function OpenersSheet({ match, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const [m, setM] = useState(match);
  const bat = E.nextBattingSide(m), field = E.otherSide(bat);
  const batters = m.teams[bat].players, bowlers = m.teams[field].players;
  const [s, setS] = useState<string | null>(batters[0]?.id ?? null);
  const [ns, setNs] = useState<string | null>(batters[1]?.id ?? null);
  const [alone, setAlone] = useState(batters.length === 1);
  const [bw, setBw] = useState<string | null>(bowlers.find((p) => p.id !== s && p.id !== ns)?.id ?? null);
  const superOver = m.innings.length >= 2;
  const atCrease = (id: string) => id === s || (!alone && id === ns);
  const ok = s && bw && !atCrease(bw) && (alone || (ns && s !== ns));
  return (
    <Sheet title={superOver ? "Super over" : m.innings.length ? "Second innings" : "Openers"} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onClick={() => onStart(E.startInnings(m, s!, alone ? null : ns, bw!))}>Start innings</PrimaryButton>}>
      <p className="mb-2 text-sm font-semibold text-teal">{m.teams[bat].name}: on strike</p>
      <PlayerPick players={batters} value={s} set={(id) => { if (id === ns) setNs(s); setS(id); }} />
      <div className="mb-2 mt-5 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-teal">Non-striker</p>
        {batters.length > 1 && (
          <div className="flex rounded-full bg-key p-1 text-sm font-semibold">
            {[false, true].map((v) => (
              <button key={String(v)} onClick={() => setAlone(v)}
                className={cx("press min-h-9 rounded-full px-3", alone === v ? "bg-sun text-ink" : "text-mute")}>{v ? "Bat alone" : "Two batters"}</button>
            ))}
          </div>
        )}
      </div>
      {alone
        ? <p className="rounded-2xl bg-sun-soft p-3 text-sm text-fg">One batter at a time. When they're out the next one walks in, and every player gets to bat.</p>
        : <PlayerPick players={batters} value={ns} set={(id) => { if (id === s) setS(ns); setNs(id); }} />}
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">{m.teams[field].name}: bowling first</p>
      <PlayerPick players={bowlers} value={bw} set={setBw} disabled={atCrease} />
      <AddName label={`Add a bowler to ${m.teams[field].name}`} onAdd={(name) => { const r = addPlayer(m, field, name); setM(r.match); setBw(r.id); }} />
    </Sheet>
  );
}

export function BowlerSheet({ match, onPick, onClose, onEnd }: { match: Match; onPick: (m: Match) => void; onClose?: () => void; onEnd?: () => void }) {
  const idx = match.innings.length - 1, field = E.otherSide(match.innings[idx].bat);
  const st = E.replay(match, idx);
  const fig = (id: string) => { const b = st.bowl.get(id); return b ? `${E.oversText(b.legal)}-${b.maidens}-${b.runs}-${b.wickets}` : "Yet to bowl"; };
  return (
    <Sheet title={`Over ${Math.floor(st.legal / 6) + 1}: who bowls?`} onClose={onClose}>
      <PlayerPick players={match.teams[field].players} value={null} note={fig}
        disabled={(id) => !E.canBowl(match, idx, id)} set={(id) => onPick(E.setBowler(match, id))} />
      <AddName label="New bowler's name" onAdd={(name) => { const r = addPlayer(match, field, name); onPick(E.setBowler(r.match, r.id)); }} />
      <p className="mt-3 text-xs text-mute">Faded names bowled the last over, hit the overs limit, or are batting.</p>
      {onEnd && <button onClick={onEnd} className="press mt-4 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-out">End innings instead</button>}
    </Sheet>
  );
}

const KINDS: WicketKind[] = ["bowled", "caught", "run out", "stumped", "lbw", "hit wicket"];

export function WicketSheet({ match, extra, onDone, onClose }: {
  match: Match; extra: Extra | null; onDone: (m: Match, input: { runs: number; extra?: Extra; wicket: Wicket }) => void; onClose: () => void;
}) {
  const [m, setM] = useState(match);
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const free = st.freeHit || extra === "nb";
  let kinds = [...KINDS];
  if (m.rules.oneTipCatch) kinds.push("one-tip catch");
  if (m.rules.wall === "out") kinds.push("wall out");
  if (free) kinds = ["run out"];
  else if (extra === "wd") kinds = ["stumped", "run out"];
  else if (extra === "b" || extra === "lb") kinds = ["run out"];

  const [kind, setKind] = useState<WicketKind | null>(kinds.length === 1 ? kinds[0] : null);
  const [out, setOut] = useState<"s" | "ns">("s");
  const [runs, setRuns] = useState(0);
  const remaining = E.yetToBat(m, idx);
  const lastWicket = st.wickets + 1 >= inn.wicketLimit;
  const lastManAlone = m.rules.lastManStands && remaining.length === 0;
  const needNew = !lastWicket && !lastManAlone;
  const [newId, setNewId] = useState<string | null>(null);
  const ready = kind && (!needNew || newId);
  const name = (id: string | null) => E.playerName(m, id);

  return (
    <Sheet title={st.freeHit ? "Free hit: only a run out" : extra === "nb" ? "No ball: only a run out" : extra === "wd" ? "Out on a wide" : extra ? "Out on a bye: only a run out" : "How out?"} onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!ready}
        onClick={() => onDone(m, { runs: kind === "run out" ? runs : 0, extra: extra ?? undefined, wicket: { kind: kind!, out: kind === "run out" ? out : "s", outId: (kind === "run out" && out === "ns" ? st.nonStriker : st.striker) ?? undefined, newId: needNew ? newId : null } })}>
        Confirm wicket
      </PrimaryButton>}>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map((k) => <Pill key={k} active={kind === k} onClick={() => setKind(k)}><span className="capitalize">{k}</span></Pill>)}
      </div>
      {kind === "run out" && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">Who is out?</p>
          <div className="grid grid-cols-2 gap-2">
            <Pill active={out === "s"} onClick={() => setOut("s")}>{name(st.striker)}</Pill>
            {st.nonStriker && <Pill active={out === "ns"} onClick={() => setOut("ns")}>{name(st.nonStriker)}</Pill>}
          </div>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">Runs completed before the run out{extra === "nb" ? " (plus the no-ball run)" : extra === "wd" ? " (plus the wide)" : ""}</p>
          <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((r) => <Pill key={r} active={runs === r} onClick={() => setRuns(r)}>{r}</Pill>)}</div>
        </>
      )}
      {needNew ? (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">New batter</p>
          <PlayerPick players={remaining} value={newId} set={setNewId} />
          <AddName label="New batter's name" onAdd={(n) => { const r = addPlayer(m, inn.bat, n); setM(r.match); setNewId(r.id); }} />
        </>
      ) : (
        <p className="mt-5 rounded-2xl bg-sun-soft p-3 text-sm font-medium text-fg">
          {lastWicket ? "That's the last wicket. The innings ends." : "Last man stands: the other batter carries on alone."}
        </p>
      )}
    </Sheet>
  );
}

export function EditBallSheet({ ball, onSave, onClose }: { ball: Ball; onSave: (p: { runs: number; extra?: Extra }) => void; onClose: () => void }) {
  const [runs, setRuns] = useState(ball.runs);
  const [extra, setExtra] = useState<Extra | undefined>(ball.extra);
  const extras: { v?: Extra; label: string }[] = [{ label: "None" }, { v: "wd", label: "Wide" }, { v: "nb", label: "No ball" }, { v: "b", label: "Bye" }, { v: "lb", label: "Leg bye" }];
  return (
    <Sheet title="Correct this ball" onClose={onClose}>
      <p className="mb-2 text-sm font-semibold text-teal">Runs</p>
      <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3, 4, 5, 6].map((r) => <Pill key={r} active={runs === r} onClick={() => setRuns(r)}>{r}</Pill>)}</div>
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">Extra</p>
      <div className="flex flex-wrap gap-2">{extras.map((x) => <Pill key={x.label} active={extra === x.v} onClick={() => setExtra(x.v)}>{x.label}</Pill>)}</div>
      {ball.wicket && <p className="mt-4 text-xs text-mute">The wicket on this ball stays. Undo back to it to change the wicket.</p>}
      <div className="mt-6"><PrimaryButton onClick={() => onSave({ runs, extra })}>Save</PrimaryButton></div>
    </Sheet>
  );
}

export function OversSheet({ match, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const min = E.minOvers(match), inn = match.innings[match.innings.length - 1];
  const [overs, setOvers] = useState(match.status === "live" && inn && !inn.superOver ? inn.overs : match.rules.overs);
  return (
    <Sheet title="Change overs" onClose={onClose}>
      <p className="mb-3 text-sm text-mute">{match.status === "break" ? "Sets the overs for the chase." : "Running late or getting dark? Change the overs for the rest of the match."}</p>
      <Stepper value={overs} set={setOvers} min={min} max={50} />
      {match.status === "live" && min > 1 && <p className="mt-2 text-xs text-mute">Can't go below {min}, that many overs are already started.</p>}
      <div className="mt-6"><PrimaryButton onClick={() => onSave(E.setOvers(match, overs))}>Save</PrimaryButton></div>
    </Sheet>
  );
}

export function RetireSheet({ match, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [m, setM] = useState(match);
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const [who, setWho] = useState<"s" | "ns">("s");
  const [newId, setNewId] = useState<string | null>(null);
  const remaining = E.yetToBat(m, idx);
  const name = (id: string | null) => E.playerName(m, id);
  return (
    <Sheet title="Retire a batter" onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!newId && !st.nonStriker}
        onClick={() => onSave(E.retire(m, who, newId))}>Retire {name(who === "s" ? st.striker : st.nonStriker)}</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">Hurt, or has to leave? They go off not out and it isn't a wicket.</p>
      <div className="grid grid-cols-2 gap-2">
        <Pill active={who === "s"} onClick={() => setWho("s")}>{name(st.striker)}</Pill>
        {st.nonStriker && <Pill active={who === "ns"} onClick={() => setWho("ns")}>{name(st.nonStriker)}</Pill>}
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">Who comes in?</p>
      <PlayerPick players={remaining} value={newId} set={setNewId} />
      <AddName label="New batter's name" onAdd={(n) => { const r = addPlayer(m, inn.bat, n); setM(r.match); setNewId(r.id); }} />
      {st.nonStriker && <button onClick={() => setNewId(null)}
        className={cx("press mt-3 min-h-12 w-full rounded-2xl border-2 font-semibold", newId === null ? "border-sun bg-sun-soft text-fg" : "border-line text-mute")}>Nobody, the other batter carries on alone</button>}
    </Sheet>
  );
}
