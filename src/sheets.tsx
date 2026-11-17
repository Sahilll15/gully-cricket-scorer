import { useState } from "react";
import * as E from "./engine/engine";
import type { Ball, Extra, Match, Player, Wicket, WicketKind } from "./engine/types";
import { Badge, cx, Pill, PrimaryButton, Segmented, Sheet, Stepper } from "./ui";
import { BLOCK_TEXT, wicketCost } from "./liveKit";

const addPlayer = E.addPlayer;

export function PlayerPick({ players, value, set, disabled, note }: {
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

export function AddName({ onAdd, label }: { onAdd: (name: string) => void; label: string }) {
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
  const [followOn, setFollowOn] = useState(false);
  const bat = E.nextBattingSide(m, followOn), field = E.otherSide(bat);
  const batters = m.teams[bat].players, bowlers = m.teams[field].players;
  const [s, setS] = useState<string | null>(batters[0]?.id ?? null);
  const [ns, setNs] = useState<string | null>(batters[1]?.id ?? null);
  const [alone, setAlone] = useState(batters.length === 1);
  const [bw, setBw] = useState<string | null>(bowlers.find((p) => p.id !== s && p.id !== ns)?.id ?? null);
  const test = E.isTest(m), superOver = !test && m.innings.length >= 2;
  const atCrease = (id: string) => id === s || (!alone && id === ns);
  const ok = s && bw && !atCrease(bw) && (alone || (ns && s !== ns));
  // Following on swaps who bats, so the picks start over for the new side.
  function chooseFollowOn(f: boolean) {
    const b = E.nextBattingSide(m, f), bt = m.teams[b].players, bl = m.teams[E.otherSide(b)].players;
    setFollowOn(f); setS(bt[0]?.id ?? null); setNs(bt[1]?.id ?? null); setAlone(bt.length === 1); setBw(bl[0]?.id ?? null);
  }
  const first = m.innings[0] ? m.teams[m.innings[0].bat].name : "", second = m.innings[1] ? m.teams[m.innings[1].bat].name : "";
  const title = superOver ? "Super over" : !m.innings.length ? "Openers"
    : test ? `${["", "2nd", "3rd", "4th"][m.innings.length]} innings${followOn ? ", follow-on" : ""}` : "Second innings";
  return (
    <Sheet title={title} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onClick={() => onStart(E.startInnings(m, s!, alone ? null : ns, bw!, { followOn }))}>Start innings</PrimaryButton>}>
      {E.canFollowOn(m) && (
        <div className="mb-5 rounded-2xl bg-sun-soft p-3">
          <p className="mb-2 text-sm text-fg"><b>{E.testStatus(m)}.</b> {first} can bat again, or make {second} follow on and bat again now.</p>
          <Segmented value={followOn ? "yes" : "no"} set={(v) => chooseFollowOn(v === "yes")}
            items={[{ v: "no", label: `${first} bat` }, { v: "yes", label: `${second} follow on` }]} />
        </div>
      )}
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
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">{m.teams[field].name}: {test ? "bowling" : "bowling first"}</p>
      <PlayerPick players={bowlers} value={bw} set={setBw} disabled={atCrease} />
      <AddName label={`Add a bowler to ${m.teams[field].name}`} onAdd={(name) => { const r = addPlayer(m, field, name); setM(r.match); setBw(r.id); }} />
    </Sheet>
  );
}

export function BowlerSheet({ match, onPick, onClose, onEnd, endLabel = "End innings instead" }: { match: Match; onPick: (m: Match) => void; onClose?: () => void; onEnd?: () => void; endLabel?: string }) {
  const idx = match.innings.length - 1, field = E.otherSide(match.innings[idx].bat), solo = E.isSolo(match);
  const st = E.replay(match, idx), opts = E.bowlerOptions(match), opt = (id: string) => opts.find((o) => o.id === id);
  const fig = (id: string) => {
    const o = opt(id), b = st.bowl.get(id);
    if (o?.blocked) return BLOCK_TEXT[o.blocked];
    const f = b ? `${E.oversText(b.legal, st.bpo)}-${b.maidens}-${b.runs}-${b.wickets}` : "Yet to bowl";
    return o?.oversLeft != null ? `${f}, ${o.oversLeft} over${o.oversLeft === 1 ? "" : "s"} left` : f;
  };
  const yet = solo ? [] : E.notBowledYet(match, field).filter((p) => !opt(p.id)?.blocked);
  return (
    <Sheet title={`Over ${Math.floor(st.legal / st.bpo) + 1}: who bowls?`} onClose={onClose}>
      <PlayerPick players={opts.map((o) => ({ id: o.id, name: o.name }))} value={null} note={fig}
        disabled={(id) => !!opt(id)?.blocked} set={(id) => onPick(E.setBowler(match, id))} />
      {!solo && <AddName label="New bowler's name" onAdd={(name) => { const r = addPlayer(match, field, name); onPick(E.setBowler(r.match, r.id)); }} />}
      {yet.length > 0 && st.bowlOrder.length > 0 && <p className="mt-3 rounded-2xl bg-sun-soft p-3 text-sm text-fg">Yet to bowl: {yet.map((p) => p.name).join(", ")}. Give them a go?</p>}
      {onEnd && <button onClick={onEnd} className="press mt-4 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-out">{endLabel}</button>}
    </Sheet>
  );
}

export function WicketSheet({ match, extra, preset, onDone, onClose }: {
  match: Match; extra: Extra | null; preset?: WicketKind | null; onDone: (m: Match, input: { runs: number; extra?: Extra; wicket: Wicket }) => void; onClose: () => void;
}) {
  const [m, setM] = useState(match);
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const kinds = E.wicketKinds(m.rules, extra, st.freeHit);

  const [kind, setKind] = useState<WicketKind | null>(preset && kinds.includes(preset) ? preset : kinds.length === 1 ? kinds[0] : null);
  const [out, setOut] = useState<"s" | "ns">("s");
  const [runs, setRuns] = useState(0);
  const { fresh, back } = E.afterWicket(m, idx);
  const outId = (kind === "run out" && out === "ns" ? st.nonStriker : st.striker) ?? null;
  const pairs = E.isPairs(m), cost = wicketCost(m, st, outId);
  // A protected player's first dismissal costs runs, and they bat on.
  const stays = !E.isSolo(m) && !pairs && !!outId && !E.needsNewBatter(m, outId);
  const lastWicket = !pairs && !stays && st.wickets + 1 >= inn.wicketLimit;
  // Retired batters may have gone home, so with only them left nobody has to come in.
  const needNew = fresh.length > 0 && !lastWicket && !stays;
  const offer = needNew ? [...fresh, ...back] : stays ? [] : back;
  const [newId, setNewId] = useState<string | null>(null);
  const alone = m.rules.lastManStands && !!st.nonStriker;
  const [fielder, setFielder] = useState<string | null>(null);
  const fieldSide = E.otherSide(inn.bat), solo = E.isSolo(m);
  // Solo: a new name would join the batting order mid-match, so fielders come from the players only.
  const fielders = solo ? m.teams[0].players.filter((p) => p.id !== st.striker) : m.teams[fieldSide].players;
  const livesAfter = inn.wicketLimit - st.wickets - 1;
  const byLabel = kind === "caught" || kind === "one-tip catch" ? "Caught by" : kind === "stumped" ? "Stumped by" : kind === "run out" ? "Run out by" : null;
  const ready = kind && (!needNew || newId);
  const name = (id: string | null) => E.playerName(m, id);

  return (
    <Sheet title={st.freeHit ? "Free hit: only a run out" : extra === "nb" ? "No ball: only a run out" : extra === "wd" ? "Out on a wide" : extra ? "Out on a bye: only a run out" : "How out?"} onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!ready}
        onClick={() => onDone(m, { runs: kind === "run out" ? runs : 0, extra: extra ?? undefined, wicket: { kind: kind!, out: kind === "run out" ? out : "s", outId: (kind === "run out" && out === "ns" ? st.nonStriker : st.striker) ?? undefined, newId: offer.some((p) => p.id === newId) ? newId : null, ...(byLabel && fielder && { fielderId: fielder }) } })}>
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
      {byLabel && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">{byLabel} <span className="font-normal text-mute">(optional)</span></p>
          <PlayerPick players={fielders} value={fielder} set={(id) => setFielder((f) => (f === id ? null : id))} />
          {!solo && <AddName label="Fielder's name" onAdd={(n) => { const r = addPlayer(m, fieldSide, n); setM(r.match); setFielder(r.id); }} />}
        </>
      )}
      {needNew ? (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">New batter</p>
          <PlayerPick players={offer} value={newId} set={setNewId} note={(id) => (fresh.some((p) => p.id === id) ? "Yet to bat" : "Retired, comes back")} />
          <AddName label="New batter's name" onAdd={(n) => { const r = addPlayer(m, inn.bat, n); setM(r.match); setNewId(r.id); }} />
        </>
      ) : (
        <>
          {offer.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-sm font-semibold text-teal">Retired batter coming back? <span className="font-normal text-mute">(optional)</span></p>
              <PlayerPick players={offer} value={newId} set={(id) => setNewId((v) => (v === id ? null : id))} />
            </>
          )}
          {!newId && (
            <p className="mt-5 rounded-2xl bg-sun-soft p-3 text-sm font-medium text-fg">
              {stays ? `${name(outId)} is protected: stays in, and it costs ${cost} run${cost === 1 ? "" : "s"}.`
                : pairs ? `${name(outId)} bats on.${cost ? ` It costs ${cost} run${cost === 1 ? "" : "s"}.` : ""}`
                : solo ? (lastWicket ? `That's ${name(st.striker)}'s last life. The turn ends.`
                : `${name(st.striker)} loses a life and bats on, ${livesAfter} ${livesAfter === 1 ? "life" : "lives"} left.`)
                : lastWicket ? "That's the last wicket. The innings ends."
                : alone ? "Last man stands: the other batter carries on alone."
                : "Nobody left to bat. That's all out, the innings ends."}
            </p>
          )}
        </>
      )}
      {cost > 0 && !stays && !pairs && <p className="mt-3 text-sm text-mute">This dismissal costs {cost} run{cost === 1 ? "" : "s"}.</p>}
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

export function RetireSheet({ match, batter, hurt, onSave, onClose }: { match: Match; batter?: string | null; hurt?: boolean; onSave: (m: Match) => void; onClose: () => void }) {
  const [m, setM] = useState(match);
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const [who, setWho] = useState<"s" | "ns">(batter && batter === st.nonStriker ? "ns" : "s");
  const [newId, setNewId] = useState<string | null>(null);
  const remaining = E.yetToBat(m, idx);
  const name = (id: string | null) => E.playerName(m, id);
  return (
    <Sheet title={hurt ? "Retired hurt" : "Retire a batter"} onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!newId && !st.nonStriker}
        onClick={() => onSave(E.retire(m, who, newId, !!hurt))}>Retire {name(who === "s" ? st.striker : st.nonStriker)}</PrimaryButton>}>
      <p className="mb-3 text-sm text-mute">{hurt ? "They go off retired hurt, not out, and can come back in later."
        : batter && m.rules.retireAt
        ? `${name(batter)} has reached ${m.rules.retireAt}, so they retire. They go off not out and can bat again later.`
        : "Hurt, or has to leave? They go off not out and it isn't a wicket."}</p>
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

/** Solo: who bowls the next turn. The suggested bowler is picked already, so one tap starts it. */
export function SoloTurnSheet({ match: m, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const batter = E.nextBatter(m), suggested = E.suggestedBowler(m);
  const [bw, setBw] = useState<string | null>(suggested);
  const who = E.playerName(m, batter);
  return (
    <Sheet title={`${who} bats next`} onClose={onClose}
      footer={<PrimaryButton disabled={!bw} onClick={() => onStart(E.startTurn(m, bw!))}>Start {who}'s turn</PrimaryButton>}>
      <p className="mb-2 text-sm font-semibold text-teal">Who bowls to {who}?</p>
      <PlayerPick players={m.teams[0].players.filter((p) => p.id !== batter)} value={bw} set={setBw} note={(id) => (id === suggested ? "Next in line" : "")} />
    </Sheet>
  );
}

/** French cricket: who bats next, the one who got the last batter out by default, and who bowls to them. */
export function FrenchNextSheet({ match: m, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const here = m.teams[0].players.filter((p) => !E.hasLeft(m, p.id)), outBy = E.frenchOutBy(m);
  const prev = m.innings[m.innings.length - 1]?.striker ?? null;
  const bowlerFor = (b: string | null) => (prev && prev !== b && here.some((p) => p.id === prev) ? prev : here.find((p) => p.id !== b)?.id ?? null);
  const [bat, setBat] = useState<string | null>(outBy ?? here[0]?.id ?? null);
  const [bw, setBw] = useState<string | null>(bowlerFor(outBy ?? here[0]?.id ?? null));
  const who = E.playerName(m, bat);
  return (
    <Sheet title={`${who} bats next`} onClose={onClose}
      footer={<PrimaryButton disabled={!bat || !bw || bat === bw} onClick={() => onStart(E.frenchNext(m, bat!, bw!))}>Start {who}'s turn</PrimaryButton>}>
      <p className="mb-2 text-sm font-semibold text-teal">Who bats next?</p>
      <PlayerPick players={here} value={bat} set={(id) => { setBat(id); if (id === bw) setBw(bowlerFor(id)); }} note={(id) => (id === outBy ? "Got them out" : "")} />
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">Who bowls to {who}?</p>
      <PlayerPick players={here.filter((p) => p.id !== bat)} value={bw} set={setBw} note={(id) => (id === prev ? "Just batted" : "")} />
    </Sheet>
  );
}

/** Solo: the leaderboard. `full` adds strike rate and boundaries, for the result. */
export function SoloTable({ match: m, full, highlight }: { match: Match; full?: boolean; highlight?: string | null }) {
  const rows = E.soloStandings(m);
  const cols = full ? ["R", "B", "SR", "4s", "6s", "Out"] : ["R", "B", "Out"];
  return (
    <table className="w-full text-sm">
      <thead><tr className="bg-key text-left text-xs text-fg">
        <th className="w-8 py-2.5 pl-3 font-semibold">#</th><th className="px-1.5 py-2.5 font-semibold">Name</th>
        {cols.map((h) => <th key={h} className="px-1.5 py-2.5 text-right font-semibold last:pr-3">{h}</th>)}
      </tr></thead>
      <tbody>{rows.map((r, i) => {
        const vals = full ? [r.runs, r.balls, r.strikeRate.toFixed(0), r.fours, r.sixes, r.outs] : [r.runs, r.balls, r.outs];
        return (
          <tr key={r.id} className={cx("border-t border-line", r.id === highlight && "bg-sun-soft")}>
            <td className="py-2.5 pl-3 text-xs font-bold text-mute tabular-nums">{i + 1}</td>
            <td className="px-1.5 py-2.5 font-semibold text-fg">{r.name}{r.turns === 0 ? <span className="block text-xs font-normal text-mute">Yet to bat</span> : null}</td>
            {vals.map((v, k) => <td key={k} className={cx("px-1.5 text-right tabular-nums last:pr-3", k === 0 && "font-bold text-fg")}>{v}</td>)}
          </tr>
        );
      })}</tbody>
    </table>
  );
}
