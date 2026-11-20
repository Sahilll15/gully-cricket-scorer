import { useEffect, useRef, useState, type ReactNode } from "react";
import * as E from "./engine/engine";
import type { BallInput, Match, Rules, Side } from "./engine/types";
import * as K from "./liveKit";
import { AddName, PlayerPick } from "./sheets";
import { cx, Pill, PrimaryButton, Segmented, Sheet, Stepper } from "./ui";

/** Small on/off chip for the controls that sit above the extras row. */
export function Chip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={!!on}
      className={cx("press min-h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold", on ? "border-sun bg-sun text-ink" : "border-line bg-panel text-teal")}>{children}</button>
  );
}

const Note = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx("rounded-2xl bg-sun-soft p-3 text-sm text-fg", className)}>{children}</p>
);
const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx("mb-2 text-sm font-semibold text-teal", className)}>{children}</p>
);
const Ghost = ({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={cx("press min-h-12 w-full rounded-2xl border-2 border-line font-semibold", danger ? "text-out" : "text-fg")}>{children}</button>
);

/** Must run: a 0 the bat touched (or any 0 with compulsory run). Yes scores the runs, no is out. */
export function DidRunSheet({ match: m, input, onRan, onOut, onClose }: { match: Match; input: BallInput; onRan: (runs: number) => void; onOut: () => void; onClose: () => void }) {
  const every = E.mustRunMode(m.rules) === "every-hit";
  return (
    <Sheet title="Did they run?" onClose={onClose}>
      <p className="mb-3 text-sm text-mute">{every ? "Compulsory run: they have to run on every ball." : "The bat touched it, so they had to run."}{input.extra === "nb" ? " No ball." : ""}</p>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((r) => <Pill key={r} onClick={() => onRan(r)}>Ran {r}</Pill>)}</div>
      <div className="mt-3"><Ghost danger onClick={onOut}>No, out: didn't run</Ghost></div>
    </Sheet>
  );
}

export function OverthrowSheet({ value, onPick, onClose }: { value: number; onPick: (n: number) => void; onClose: () => void }) {
  return (
    <Sheet title="Overthrow" onClose={onClose}>
      <p className="mb-3 text-sm text-mute">Runs from the overthrow, on top of what they ran. Then tap the runs they ran.</p>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5, 6].map((r) => <Pill key={r} active={value === r} onClick={() => onPick(r)}>+{r}</Pill>)}</div>
      {value > 0 && <div className="mt-3"><Ghost onClick={() => onPick(0)}>No overthrow</Ghost></div>}
    </Sheet>
  );
}

/** Wagon wheel: one tap on where the shot went, or skip. */
export function WagonSheet({ box, onPick, onSkip }: { box: boolean; onPick: (zone: number) => void; onSkip: () => void }) {
  return (
    <Sheet title="Where did it go?" onClose={onSkip}>
      <svg viewBox="0 0 240 240" className="mx-auto block w-full max-w-[260px]" role="group" aria-label="Field">
        {box ? <>
          {[{ z: 9, x: 20, y: 10, w: 200, h: 60 }, { z: 11, x: 10, y: 80, w: 60, h: 150 }, { z: 10, x: 170, y: 80, w: 60, h: 150 }].map((b) => (
            <g key={b.z} onClick={() => onPick(b.z)} className="cursor-pointer">
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} className="fill-key stroke-line hover:fill-sun-soft" strokeWidth={2} />
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" className="fill-fg text-[12px] font-semibold">{K.zoneName(b.z)}</text>
            </g>
          ))}
          <rect x={112} y={150} width={16} height={60} rx={4} className="fill-raised" />
        </> : <>
          {K.FIELD_ZONES.map((label, i) => {
            const z = i + 1, from = K.zoneFrom(z), at = K.labelAt(120, 120, 78, z);
            return (
              <g key={z} onClick={() => onPick(z)} className="cursor-pointer">
                <path d={K.wedgePath(120, 120, 112, from, from + 45)} className="fill-key stroke-cream hover:fill-sun-soft" strokeWidth={2} />
                <text x={at.x} y={at.y + 4} textAnchor="middle" className="pointer-events-none fill-fg text-[11px] font-semibold">{label}</text>
              </g>
            );
          })}
          <rect x={113} y={92} width={14} height={56} rx={3} className="pointer-events-none fill-raised" />
        </>}
      </svg>
      <p className="mt-2 text-center text-xs text-mute">{box ? "Batting end at the bottom." : "Bowler's end at the top, off side on the right."}</p>
      <div className="mt-3"><Ghost onClick={onSkip}>Skip</Ghost></div>
    </Sheet>
  );
}

/** Pairs: what the pair in now has made, how long they have left, and the best pairs so far. */
export function PairsStrip({ match: m, idx }: { match: Match; idx: number }) {
  const p = K.pairNow(m, idx);
  if (!p) return null;
  return (
    <div className="mt-3 rounded-3xl border border-line bg-panel p-3">
      <p className="text-sm text-mute">This pair: <b className="font-semibold text-fg tabular-nums">{p.runs}</b> run{p.runs === 1 ? "" : "s"}, <b className="font-semibold text-fg tabular-nums">{p.outs}</b> out · <span className="tabular-nums">{p.ballsLeft}</span> ball{p.ballsLeft === 1 ? "" : "s"} left for them</p>
      {p.standings.length > 1 && (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
          {p.standings.slice(0, 3).map((r, i) => (
            <span key={r.names} className="flex shrink-0 items-center gap-1.5 rounded-full bg-key px-3 py-1.5 text-sm text-fg">
              <span className="text-xs font-bold text-mute tabular-nums">{i + 1}</span><span className="max-w-[140px] truncate">{r.names}</span><b className="tabular-nums">{r.runs}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The rules in force as short sentences, and the way to change one by agreement. */
export function RulesSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [changing, setChanging] = useState(false);
  if (changing) return <ChangeRules match={m} onSave={onSave} onClose={() => setChanging(false)} />;
  return (
    <Sheet title="Rules" onClose={onClose}>
      <ul className="grid gap-2 text-[15px] text-fg">{E.rulesCard(m).map((l) => <li key={l} className="border-b border-line pb-2">{l}</li>)}</ul>
      {m.status === "live" && <div className="mt-5"><PrimaryButton tone="navy" onClick={() => setChanging(true)}>Change a rule</PrimaryButton></div>}
    </Sheet>
  );
}

function NumRow({ value, set, min, max, step, off }: { value: number; set: (n: number) => void; min: number; max: number; step: number; off?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button className="press h-10 w-10 rounded-xl bg-key text-xl font-bold text-fg" onClick={() => set(Math.max(min, value - step))} aria-label="Less">−</button>
      <span className="min-w-16 text-center font-bold text-fg tabular-nums">{value === 0 && off ? off : value}</span>
      <button className="press h-10 w-10 rounded-xl bg-key text-xl font-bold text-fg" onClick={() => set(Math.min(max, value + step))} aria-label="More">+</button>
    </div>
  );
}

function ChangeRules({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Rules>>({});
  const [who, setWho] = useState<string[]>([]);
  const fields = K.ruleFields(m), next = E.changeRules(m, draft, who), changed = next !== m;
  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const sides: Side[] = E.isSolo(m) ? [0] : [0, 1];
  return (
    <Sheet title="Change a rule" onClose={onClose}
      footer={<PrimaryButton disabled={!changed || !K.agreed(m, who)} onClick={() => { onSave(next); onClose(); }}>Both sides agree, change it</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">It applies from the next ball. Undo takes it back.</p>
      <div className="divide-y divide-line">
        {fields.map((f) => {
          const v = K.fieldValue(m, f, draft), set = (x: boolean | number | string) => setDraft((d) => K.setField(d, f, x));
          return (
            <div key={f.key} className="py-2.5">
              {f.kind === "toggle" ? (
                <button onClick={() => set(!v)} className="flex w-full items-center gap-3 text-left">
                  <span className="flex-1 font-semibold text-fg">{f.label}</span>
                  <span className={cx("relative h-7 w-12 shrink-0 rounded-full", v ? "bg-sun" : "bg-line")}>
                    <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-panel", v ? "left-6" : "left-1")} />
                  </span>
                </button>
              ) : f.kind === "number" ? (
                <div className="flex items-center gap-3"><span className="flex-1 font-semibold text-fg">{f.label}</span>
                  <NumRow value={v as number} set={set} min={f.min} max={f.max} step={f.step} off={f.off} /></div>
              ) : (
                <><p className="mb-2 font-semibold text-fg">{f.label}</p>
                  <Segmented value={v as string} set={set} items={f.options.map((o) => ({ v: o.v, label: o.label }))} /></>
              )}
            </div>
          );
        })}
      </div>
      <Label className="mt-5">{E.isSolo(m) ? "Who agreed? Pick at least two players" : "Who agreed? A captain from each side"}</Label>
      {sides.map((s) => (
        <div key={s} className="mb-3">
          {!E.isSolo(m) && <p className="mb-1.5 text-xs font-semibold text-mute">{m.teams[s].name}</p>}
          <div className="flex flex-wrap gap-2">
            {m.teams[s].players.filter((p) => !E.hasLeft(m, p.id)).map((p) => <Chip key={p.id} on={who.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</Chip>)}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

/** Corrections of earlier balls and agreed rule changes, oldest first. */
export function ChangeLogSheet({ match: m, onClose }: { match: Match; onClose: () => void }) {
  const edits = E.changeLog(m), rules = E.ruleChanges(m);
  const names = (ids: string[]) => ids.map((id) => E.playerName(m, id)).join(" and ");
  return (
    <Sheet title="Change log" onClose={onClose}>
      {!edits.length && !rules.length && <p className="text-sm text-mute">Nothing has been changed yet.</p>}
      {edits.length > 0 && <><Label>Balls corrected</Label>
        <ul className="mb-4 grid gap-2 text-sm text-fg">{edits.map((c, i) => <li key={i} className="border-b border-line pb-2">{c.text}<span className="block text-xs text-mute">{new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></li>)}</ul></>}
      {rules.length > 0 && <><Label>Rules changed</Label>
        <ul className="grid gap-2 text-sm text-fg">{rules.map((c, i) => <li key={i} className="border-b border-line pb-2">{Object.keys(c.to).map((k) => K.ruleLabel(m, k)).join(", ")}<span className="block text-xs text-mute">Agreed by {names(c.agreedBy)}, {new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></li>)}</ul></>}
    </Sheet>
  );
}

export function BallLostSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [reason, setReason] = useState(K.LOST_REASONS[0]);
  return (
    <Sheet title="Ball lost" onClose={onClose} footer={<PrimaryButton onClick={() => { onSave(E.ballLost(m, reason)); onClose(); }}>Ball lost</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">A dead ball: nothing counts and the over carries on.</p>
      <div className="flex flex-wrap gap-2">{K.LOST_REASONS.map((r) => <Pill key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Pill>)}</div>
      <input aria-label="Reason" value={K.LOST_REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value || K.LOST_REASONS[0])} placeholder="Or say what happened" maxLength={40}
        className="mt-3 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 font-medium outline-none focus:border-sun" />
    </Sheet>
  );
}

export function PenaltySheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const inn = m.innings[m.innings.length - 1];
  const [side, setSide] = useState<Side>(inn.bat);
  const [runs, setRuns] = useState(5);
  const [reason, setReason] = useState("");
  return (
    <Sheet title="Penalty runs" onClose={onClose}
      footer={<PrimaryButton onClick={() => { onSave(E.addPenalty(m, side, runs, reason || "Penalty")); onClose(); }}>Give {runs} run{runs === 1 ? "" : "s"} to {m.teams[side].name}</PrimaryButton>}>
      <Label>To which side?</Label>
      <Segmented value={side} set={setSide} items={[0, 1].map((s) => ({ v: s as Side, label: `${m.teams[s].name}${s === inn.bat ? " (batting)" : ""}` }))} />
      <Label className="mt-5">Runs</Label>
      <Stepper value={runs} set={setRuns} min={1} max={20} />
      <input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? Ball hit the helmet, say" maxLength={40}
        className="mt-4 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 font-medium outline-none focus:border-sun" />
      {side !== inn.bat && <p className="mt-3 text-xs text-mute">The fielding side gets them on its own innings.</p>}
    </Sheet>
  );
}

export function AddPlayerSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const solo = E.isSolo(m), inn = m.innings[m.innings.length - 1];
  const [side, setSide] = useState<Side>(inn ? E.otherSide(inn.bat) : 0);
  return (
    <Sheet title="Add a player" onClose={onClose}>
      {solo ? <p className="mb-1 text-sm text-mute">They join the end of the batting order.</p> : <>
        <Label>Joins</Label>
        <Segmented value={side} set={setSide} items={[0, 1].map((s) => ({ v: s as Side, label: m.teams[s].name }))} />
      </>}
      <AddName label="Player's name" onAdd={(name) => { onSave(E.addPlayer(m, solo ? 0 : side, name).match); onClose(); }} />
    </Sheet>
  );
}

export function PlayerLeftSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match, id: string) => void; onClose: () => void }) {
  const [id, setId] = useState<string | null>(null);
  const idx = m.innings.length - 1, st = E.replay(m, idx), solo = E.isSolo(m);
  const atCrease = !!id && (id === st.striker || id === st.nonStriker);
  const sides: Side[] = solo ? [0] : [0, 1];
  return (
    <Sheet title="Player left" onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!id} onClick={() => { onSave(K.leaveMatch(m, id!), id!); onClose(); }}>{id ? `${E.playerName(m, id)} went home` : "Pick who left"}</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">They can't bat or bowl again. What they did so far stays on the card.</p>
      {sides.map((s) => (
        <div key={s} className="mb-4">
          {!solo && <Label>{m.teams[s].name}</Label>}
          <PlayerPick players={m.teams[s].players.filter((p) => !E.hasLeft(m, p.id))} value={id} set={setId} />
        </div>
      ))}
      {atCrease && <Note>{E.playerName(m, id)} is batting, so they retire{solo ? " and the turn ends" : ""}.</Note>}
    </Sheet>
  );
}

/** Booked-time countdown for the turf. */
export function TurfSheet({ end, onSet, onClose }: { end: number | null; onSet: (end: number | null) => void; onClose: () => void }) {
  const [mins, setMins] = useState(60);
  return (
    <Sheet title="Turf timer" onClose={onClose}
      footer={<PrimaryButton onClick={() => { onSet(Date.now() + mins * 60000); onClose(); }}>Start {mins} minutes</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">How long is the booking? The phone buzzes 10 and 5 minutes before the end.</p>
      <div className="mb-3 flex flex-wrap gap-2">{K.TURF_PRESETS.map((p) => <Pill key={p} active={mins === p} onClick={() => setMins(p)}>{p} min</Pill>)}</div>
      <NumRow value={mins} set={setMins} min={5} max={300} step={5} />
      {end && <div className="mt-4"><Ghost danger onClick={() => { onSet(null); onClose(); }}>Clear the timer</Ghost></div>}
    </Sheet>
  );
}

/** Header chip counting down to the end of the booking; calls out the 10 and 5 minute marks once each. */
export function TurfChip({ end, onClick, onAlert }: { end: number; onClick: () => void; onAlert: (text: string) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef(end - Date.now());
  const alert = useRef(onAlert);
  alert.current = onAlert;
  useEffect(() => {
    prev.current = end - Date.now();
    const t = setInterval(() => {
      const t2 = Date.now(), left = end - t2, a = K.turfAlert(prev.current, left);
      prev.current = left; setNow(t2);
      if (a) alert.current(a);
    }, 1000);
    return () => clearInterval(t);
  }, [end]);
  const left = end - now;
  return (
    <button onClick={onClick} aria-label="Turf timer"
      className={cx("press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
        left <= 5 * 60000 ? "bg-out text-white" : left <= 10 * 60000 ? "bg-sun text-ink" : "bg-white/15 text-white")}>
      ⏱ {left > 0 ? `${K.clock(left)} left` : "Time's up"}
    </button>
  );
}

