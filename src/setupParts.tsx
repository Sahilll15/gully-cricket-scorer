import { useState, type ReactNode } from "react";
import * as E from "./engine/engine";
import type { Match, Player, Rules, Side, Surface } from "./engine/types";
import { PRESETS, type PresetId } from "./presets";
import {
  PRESET_EMOJI, SURFACES, pairsOf, presetMatches, setWallChoice, shows, shuffled, wallChoice, type Mode, type Opt, type WallChoice,
} from "./setupOptions";
import { Badge, Card, cx, Pill, PrimaryButton, Segmented, Sheet, Stepper, Toggle } from "./ui";

/** Preset cards in a row at the top of setup. A card stays lit while the rules are still what it set. */
export function PresetRow({ rules, mode, test, onPick }: { rules: Rules; mode: Mode; test: boolean; onPick: (id: PresetId) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-mute">Start from a format</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PRESETS.map((p) => {
          const on = presetMatches(p.id, rules, mode, test);
          return (
            <button key={p.id} onClick={() => onPick(p.id)} aria-pressed={on}
              className={cx("press flex w-40 shrink-0 flex-col rounded-2xl border p-3 text-left", on ? "border-sun bg-sun-soft" : "border-line bg-panel")}>
              <span className="text-xl leading-none" aria-hidden>{PRESET_EMOJI[p.id]}</span>
              <span className={cx("mt-2 text-sm font-semibold", on ? "text-sun" : "text-fg")}>{p.name}</span>
              <span className="mt-0.5 text-xs leading-snug text-mute">{p.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const OVERS = [3, 4, 5, 6, 10];
const TURN_BALLS = [6, 12, 18, null];
const INNINGS_BALLS = [60, 100, 120];
const BPO = [3, 4, 5, 6, 7, 8];

const Label = ({ children, className }: { children: ReactNode; className?: string }) =>
  <p className={cx("mb-2 text-sm font-semibold text-teal", className)}>{children}</p>;

/** Overs and balls: how long an innings (or a solo turn) lasts in this format. */
export function OversCard({ rules, setRules, mode, test, pairsCount }: {
  rules: Rules; setRules: (r: Rules) => void; mode: Mode; test: boolean; pairsCount: number;
}) {
  const [picked, setCustom] = useState(false), custom = picked || !OVERS.includes(rules.overs);
  const r = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setRules({ ...rules, [k]: v });
  const has = (o: Opt) => shows(o, mode, test), bpo = E.ballsPerOver(rules), pairOvers = E.pairOversOf(rules);
  const turnBalls = rules.ballsPerTurn === undefined ? 12 : rules.ballsPerTurn, lives = rules.lives ?? 1, rounds = rules.rounds ?? 1;
  const [turnPicked, setTurnPicked] = useState(false), customTurn = turnBalls !== null && (turnPicked || !TURN_BALLS.includes(turnBalls));
  const pairTotal = pairsCount * pairOvers;
  return (
    <Card>
      <p className="mb-3 font-semibold text-fg">Overs and balls</p>
      {test && <>
        <p className="text-sm text-mute">Each team bats twice, with no over limit. An innings ends when the team is all out or declares. If the team batting first is ahead after both first innings, they can make the other team follow on.</p>
        <div className="mt-1 border-t border-line">
          <Toggle on={!!rules.matchOvers} set={(v) => r("matchOvers")(v ? 30 : null)} label="Stop after a set number of overs"
            hint="Counts every innings. If nobody has won by then, it's a draw" />
          {!!rules.matchOvers && <Stepper value={rules.matchOvers} set={r("matchOvers")} max={200} />}
        </div>
      </>}
      {has("overs") && !rules.inningsBalls && <>
        <Label>{mode === "pairs" ? "Overs an innings, all pairs together" : "Overs an innings"}</Label>
        <div className="grid grid-cols-6 gap-2">
          {OVERS.map((o) => <Pill key={o} active={!custom && rules.overs === o} onClick={() => { setCustom(false); r("overs")(o); }}>{o}</Pill>)}
          <Pill active={custom} onClick={() => setCustom(true)}>…</Pill>
        </div>
        {custom && <div className="mt-2"><Stepper value={rules.overs} set={r("overs")} max={50} /></div>}
      </>}
      {has("pairOvers") && <div className="mt-4">
        <Label>Overs each pair bats</Label>
        <Stepper value={pairOvers} set={r("pairOvers")} max={10} />
        <p className="mt-2 text-xs text-mute">{pairsCount} pair{pairsCount === 1 ? "" : "s"} a side, {pairOvers} over{pairOvers === 1 ? "" : "s"} each: {pairTotal} overs.</p>
        {pairTotal > 0 && rules.overs !== pairTotal &&
          <button onClick={() => r("overs")(pairTotal)} className="press mt-1 min-h-10 text-sm font-semibold text-sun">Set overs to {pairTotal}</button>}
      </div>}
      {has("turn") && <>
        <Label>Turn ends after</Label>
        <div className="grid grid-cols-5 gap-2">
          {TURN_BALLS.map((n) => <Pill key={String(n)} active={turnBalls === n && !customTurn} onClick={() => { setTurnPicked(false); r("ballsPerTurn")(n); }}>{n === null ? "No cap" : `${n} balls`}</Pill>)}
          <Pill active={customTurn} onClick={() => { setTurnPicked(!customTurn); r("ballsPerTurn")(customTurn ? 12 : 5 * bpo); }}>Overs</Pill>
        </div>
        {customTurn && <div className="mt-2"><Stepper value={Math.max(1, Math.round((turnBalls ?? 0) / bpo))} set={(o) => r("ballsPerTurn")(o * bpo)} max={50} />
          <p className="mt-1 text-xs text-mute">overs a turn</p></div>}
      </>}
      {has("lives") && <>
        <Label className={has("turn") ? "mt-4" : ""}>Lives</Label>
        <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((n) => <Pill key={n} active={lives === n} onClick={() => r("lives")(n)}>{n}</Pill>)}</div>
      </>}
      {has("turn") && <>
        <Label className="mt-4">Rounds</Label>
        <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((n) => <Pill key={n} active={rounds === n} onClick={() => r("rounds")(n)}>{n}</Pill>)}</div>
        <p className="mt-3 text-xs text-mute">
          {rounds === 1 ? "Everyone bats once" : `Everyone bats ${rounds} times`}. A turn ends {turnBalls === null ? "" : `after ${turnBalls} balls or `}when
          {lives === 1 ? " they're out" : ` they've been out ${lives} times`}. Everyone else bowls.</p>
      </>}
      {mode === "french" && <p className="mt-3 text-xs text-mute">No overs. You bat until you're caught or hit on the legs{lives > 1 ? ` ${lives} times` : ""}, and whoever got you out bats next.</p>}
      {has("ballsPerOver") && <div className="mt-4">
        <Label>Balls an over</Label>
        <Segmented value={bpo} set={(v) => r("ballsPerOver")(v === 6 ? undefined : v)} items={BPO.map((n) => ({ v: n, label: String(n) }))} />
      </div>}
      {has("inningsBalls") && <div className="mt-2 border-t border-line">
        <Toggle on={!!rules.inningsBalls} set={(v) => r("inningsBalls")(v ? 100 : undefined)} label="Fixed balls an innings"
          hint="Like the 100-ball format: the innings is a set number of balls, not overs" />
        {!!rules.inningsBalls && <>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {INNINGS_BALLS.map((n) => <Pill key={n} active={rules.inningsBalls === n} onClick={() => r("inningsBalls")(n)}>{n}</Pill>)}
          </div>
          <Stepper value={rules.inningsBalls} set={r("inningsBalls")} min={6} max={300} />
        </>}
      </div>}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-4">
      <p className="text-xs font-semibold text-mute">{title}</p>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

/** A toggle that opens a stepper underneath when it is on. */
function ToggleStep({ on, set, label, hint, value, setValue, min, max, unit }: {
  on: boolean; set: (v: boolean) => void; label: string; hint?: string; value: number; setValue: (n: number) => void; min?: number; max: number; unit?: string;
}) {
  return (
    <div className="py-1">
      <Toggle on={on} set={set} label={label} hint={hint} />
      {on && <div className="pb-2">{unit && <p className="mb-1 text-xs text-mute">{unit}</p>}<Stepper value={value} set={setValue} min={min} max={max} /></div>}
    </div>
  );
}

/** Every gully rule, grouped, showing only what makes sense in this format. */
export function RulesEditor({ rules, setRules, mode, test, common, setCommon, names, prot, setProt }: {
  rules: Rules; setRules: (r: Rules) => void; mode: Mode; test: boolean; common: string; setCommon: (s: string) => void;
  names: string[]; prot: string[]; setProt: (n: string[]) => void;
}) {
  const r = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setRules({ ...rules, [k]: v });
  const has = (o: Opt) => shows(o, mode, test);
  const bpo = E.ballsPerOver(rules), overs = Math.max(1, rules.inningsBalls ? Math.ceil(rules.inningsBalls / bpo) : rules.overs);
  const pen = E.wicketPenaltyOf(rules), wc = wallChoice(rules);
  const setWall = (k: Surface, v: number) => setRules({ ...rules, walls: { ...rules.walls, [k]: v } });
  const isProt = (n: string) => prot.some((x) => x.toLowerCase() === n.toLowerCase());
  const flipProt = (n: string) => setProt(isProt(n) ? prot.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...prot, n]);
  const running = has("mustRun") || has("noRunning") || has("lastManRunsTwo");
  const fun = has("goldenBall") || has("powerBall") || has("jokerOver");
  return (
    <div className="px-4 pb-4">
      {running && <Section title="Running">
        {has("mustRun") && <div className="py-3">
          <p className="font-semibold text-fg">Must run</p>
          <p className="mb-2 text-xs text-mute">Not running when you have to is out</p>
          <Segmented value={E.mustRunMode(rules)} set={(v) => setRules({ ...rules, mustRun: v, tipAndRun: false })}
            items={[{ v: "off", label: "Off" }, { v: "touch", label: "Bat touch" }, { v: "every-hit", label: "Every ball" }]} />
        </div>}
        {has("noRunning") && <Toggle on={!!rules.noRunning} set={r("noRunning")} label="No running" hint="Runs by running count 0 and the batters never cross" />}
        {has("lastManRunsTwo") && <Toggle on={!!rules.lastManRunsTwo} set={r("lastManRunsTwo")} label="Last man runs two" hint="Batting alone, every two runs run count as one" />}
      </Section>}
      {has("walls") && <Section title="Boundaries and walls">
        {has("onlyBoundaries") && <Toggle on={!!rules.onlyBoundaries} set={r("onlyBoundaries")} label="Only 4s and 6s count" hint="Running scores nothing, walls still do" />}
        <div className="py-3">
          <p className="mb-2 font-semibold text-fg">Ball hits the wall or roof</p>
          <Segmented<WallChoice> value={wc} set={(v) => setRules(setWallChoice(rules, v))}
            items={[{ v: "none", label: "Normal" }, { v: "four", label: "4" }, { v: "six", label: "6" }, { v: "out", label: "Out" }, { v: "box", label: "Box" }]} />
          {wc === "box" && <div className="mt-3 space-y-2">
            <p className="text-xs text-mute">Runs for hitting each wall. Full means the back wall without a bounce.</p>
            {SURFACES.map((s) => (
              <div key={s.k} className="flex items-center gap-3">
                <span className="w-28 text-sm font-semibold text-fg">{s.label}</span>
                <div className="flex-1"><Stepper value={rules.walls?.[s.k] ?? 0} set={(v) => setWall(s.k, v)} min={0} max={6} /></div>
              </div>
            ))}
          </div>}
        </div>
        {has("sixOut") && <Toggle on={!!rules.sixOut} set={r("sixOut")} label="Hit out of the ground is out" hint="Over the wall or into a house, the ball is lost" />}
      </Section>}
      <Section title="Wickets">
        {has("wicketPenalty") && <ToggleStep on={pen > 0} set={(v) => r("wicketPenalty")(v ? 5 : 0)} label="A wicket costs runs"
          hint={mode === "pairs" ? "Pairs bat on when out, the side loses runs instead" : "Taken off the batting side's score"}
          value={pen || 5} setValue={r("wicketPenalty")} max={20} unit="Runs a wicket" />}
        {has("dotOut") && <Toggle on={!!rules.dotOut} set={r("dotOut")} label="A dot ball is out" />}
        {has("dotBallsOut") && !rules.dotOut && <ToggleStep on={!!rules.dotBallsOut} set={(v) => r("dotBallsOut")(v ? 3 : 0)} label="Dot balls in a row are out"
          value={rules.dotBallsOut || 3} setValue={r("dotBallsOut")} min={2} max={6} unit="Dots in a row" />}
        {has("missesOut") && <ToggleStep on={!!rules.missesOut} set={(v) => r("missesOut")(v ? 3 : 0)} label="Out after play and misses"
          value={rules.missesOut || 3} setValue={r("missesOut")} max={6} unit="Misses in a turn" />}
        {has("noLbw") && <Toggle on={!!rules.noLbw} set={r("noLbw")} label="No LBW" />}
        {has("oneTipCatch") && <Toggle on={rules.oneTipCatch} set={r("oneTipCatch")} label="One-tip one-hand catch is out" />}
        {has("protected") && <div className="py-3">
          <p className="font-semibold text-fg">Protected players</p>
          <p className="text-xs text-mute">Little ones or beginners: their first time out each innings costs {pen || 5} runs instead.</p>
          {names.length ? <div className="mt-2 flex flex-wrap gap-2">
            {names.map((n) => (
              <button key={n} onClick={() => flipProt(n)} aria-pressed={isProt(n)}
                className={cx("press min-h-10 rounded-full border px-3 text-sm font-semibold", isProt(n) ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>
                {isProt(n) ? "✓ " : ""}{n}</button>
            ))}
          </div> : <p className="mt-2 text-xs text-mute">Name the players first, then pick them here.</p>}
        </div>}
      </Section>
      {has("extras") && <Section title="Extras">
        <Toggle on={rules.extraRun} set={r("extraRun")} label="Wide and no-ball give 1 run" />
        <Toggle on={rules.rebowl} set={r("rebowl")} label="Wide and no-ball bowled again" />
        {has("freeHit") && <Toggle on={rules.freeHit} set={r("freeHit")} label="Free hit after a no-ball" hint="Only run out on the next ball" />}
      </Section>}
      {(has("lastManStands") || has("common") || has("maxOversPerBowler")) && <Section title="Players">
        {has("lastManStands") && <Toggle on={rules.lastManStands} set={r("lastManStands")} label="Last man stands" hint="The last batter bats alone" />}
        {has("common") && <div className="py-3">
          <p className="font-semibold text-fg">Common player</p>
          <p className="mt-0.5 text-xs text-mute">Odd number of players? One person plays for both teams. They bat in both innings and can bowl for either side, but not while batting.</p>
          <input value={common} onChange={(e) => setCommon(e.target.value)} placeholder="Name (optional)" maxLength={20}
            className="mt-2 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-base outline-none focus:border-sun" />
          {common.trim() && <Toggle on={!!rules.commonCantBowl} set={r("commonCantBowl")} label="Common player can't bowl" hint="Bats for both sides, never bowls" />}
        </div>}
        {has("retireAt") && <ToggleStep on={!!rules.retireAt} set={(v) => r("retireAt")(v ? 25 : null)} label="Retire at a score"
          hint="So everyone gets a bat. They can come back later" value={rules.retireAt || 25} setValue={r("retireAt")} max={200} />}
        {has("maxOversPerBowler") && <ToggleStep on={rules.maxOversPerBowler !== null} set={(v) => r("maxOversPerBowler")(v ? Math.max(1, Math.ceil(overs / 5)) : null)}
          label="Limit overs per bowler" value={rules.maxOversPerBowler ?? 1} setValue={r("maxOversPerBowler")} max={overs} />}
      </Section>}
      {fun && <Section title="Fun">
        {has("goldenBall") && <div className="py-1">
          <Toggle on={!!rules.goldenBall} set={(v) => r("goldenBall")(v ? { over: overs, ball: bpo } : null)} label="Golden ball"
            hint="Runs on it count double, a wicket on it costs 6" />
          {rules.goldenBall && <div className="grid grid-cols-2 gap-2 pb-2">
            <div><p className="mb-1 text-xs text-mute">Over</p><Stepper value={rules.goldenBall.over} set={(v) => r("goldenBall")({ ...rules.goldenBall!, over: v })} max={overs} /></div>
            <div><p className="mb-1 text-xs text-mute">Ball</p><Stepper value={rules.goldenBall.ball} set={(v) => r("goldenBall")({ ...rules.goldenBall!, ball: v })} max={bpo} /></div>
          </div>}
        </div>}
        {has("powerBall") && <ToggleStep on={!!rules.powerBall} set={(v) => r("powerBall")(v ? bpo : null)} label="Power ball"
          hint="This ball of every over scores double" value={rules.powerBall || bpo} setValue={r("powerBall")} max={bpo} unit="Ball of the over" />}
        {has("jokerOver") && <ToggleStep on={!!rules.jokerOver} set={(v) => r("jokerOver")(v ? overs : null)} label="Joker over"
          hint="Every run in this over counts double" value={rules.jokerOver || overs} setValue={r("jokerOver")} max={overs} unit="Over" />}
      </Section>}
      {has("rotateUmpire") && <Section title="Fair play">
        <Toggle on={!!rules.rotateUmpire} set={r("rotateUmpire")} label="Rotate the umpire" hint="The fielding side takes turns to umpire, one over each" />
      </Section>}
    </div>
  );
}

/** Pairs: a side's batting order read two by two. Move a player up or auto-build random pairs. */
export function PairsCard({ team, names, common, setNames }: { team: string; names: string[]; common: string; setNames: (n: string[]) => void }) {
  const list = common.trim() ? [...names, common.trim()] : names;
  const pairs = pairsOf(list.map((n, i) => ({ n, i })));
  const up = (i: number) => { const l = [...names]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setNames(l); };
  const movable = (i: number) => i > 0 && i < names.length;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-teal">{team}: batting pairs</p>
        <button onClick={() => setNames(shuffled(names))} disabled={names.length < 2}
          className="press min-h-10 rounded-full border border-line bg-key px-3 text-sm font-semibold text-fg disabled:opacity-40">🔀 Auto pairs</button>
      </div>
      {pairs.length ? <ol className="mt-2 divide-y divide-line">
        {pairs.map(([x, y], k) => (
          <li key={k} className="flex min-h-12 items-center gap-3 py-1.5">
            <span className="w-14 text-xs font-bold text-mute">Pair {k + 1}</span>
            <span className="flex flex-1 flex-wrap items-center gap-2">
              {[x, y].map((p, j) => p && (
                <span key={j} className="flex items-center gap-1">
                  <span className={cx("font-semibold", j === 1 && y && y.i < x.i ? "text-mute" : "text-fg")}>{p.n}</span>
                  {j === 1 && y && y.i < x.i ? <span className="text-xs text-mute">again</span> : movable(p.i) &&
                    <button onClick={() => up(p.i)} aria-label={`Move ${p.n} up`} className="press grid h-9 w-9 place-items-center rounded-xl bg-key text-fg">↑</button>}
                </span>
              ))}
              {!y && <span className="text-xs text-mute">bats alone</span>}
            </span>
          </li>
        ))}
      </ol> : <p className="mt-2 text-sm text-mute">Add players and they pair up here, two by two.</p>}
    </Card>
  );
}

/** French cricket: who takes the bat first. */
export function FrenchFirst({ names, first, setFirst }: { names: string[]; first: string | null; setFirst: (n: string) => void }) {
  return (
    <Card>
      <Label>Who bats first</Label>
      {names.length ? <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <button key={n} onClick={() => setFirst(n)} aria-pressed={n === first}
            className={cx("press min-h-11 rounded-full border px-4 text-sm font-semibold", n === first ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>{n}</button>
        ))}
      </div> : <p className="text-sm text-mute">Add players, then pick who bats first.</p>}
      <p className="mt-3 text-xs text-mute">The first other player in the list bowls first. After that, whoever gets the batter out bats next.</p>
    </Card>
  );
}

/** The split fairTeams gave: each side's rating total and a reshuffle for the next fair split. */
export function FairStrip({ a, b, ratingA, ratingB, onReshuffle }: { a: string; b: string; ratingA: number; ratingB: number; onReshuffle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-sun-soft px-4 py-2 text-sm text-fg">
      <span className="flex-1">Fair teams: {a} <b className="tabular-nums">{ratingA}</b> · {b} <b className="tabular-nums">{ratingB}</b></span>
      <button onClick={onReshuffle} className="press min-h-10 shrink-0 font-semibold text-sun">Reshuffle</button>
    </div>
  );
}

/** Start in the second innings: one side already batted and set a target. */
export function ChaseCard({ on, setOn, side, setSide, target, setTarget, down, setDown, a, b, maxDown }: {
  on: boolean; setOn: (v: boolean) => void; side: Side; setSide: (s: Side) => void; target: string; setTarget: (s: string) => void;
  down: number; setDown: (n: number) => void; a: string; b: string; maxDown: number;
}) {
  return (
    <Card className="!py-1">
      <Toggle on={on} set={setOn} label="Chasing a target" hint="The first innings was played already. Start straight at the chase" />
      {on && <div className="space-y-3 border-t border-line pb-3 pt-3">
        <div>
          <Label>Who's chasing</Label>
          <Segmented<Side> value={side} set={setSide} items={[{ v: 0, label: a || "Team A" }, { v: 1, label: b || "Team B" }]} />
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-teal">Target</span>
          <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Runs to win"
            className="min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-lg font-bold tabular-nums outline-none focus:border-sun" />
        </label>
        <div>
          <Label>Wickets the first side lost</Label>
          <Stepper value={down} set={setDown} min={0} max={Math.max(0, maxDown)} />
        </div>
      </div>}
    </Card>
  );
}

/** The rules both captains agree to, as rulesCard words them. They lock once the first innings starts. */
export function RulesCardView({ lines, extra }: { lines: string[]; extra?: string | null }) {
  return (
    <Card>
      <p className="font-semibold text-fg">Rules card</p>
      <p className="text-xs text-mute">Both captains agree to these. They lock when the first innings starts.</p>
      <ul className="mt-2 space-y-1.5 text-sm text-fg">
        {extra && <li className="flex gap-2"><span className="text-sun">•</span>{extra}</li>}
        {lines.map((l) => <li key={l} className="flex gap-2"><span className="text-sun">•</span>{l}</li>)}
      </ul>
    </Card>
  );
}

function Pick({ players, value, set, disabled }: { players: Player[]; value: string | null; set: (id: string) => void; disabled?: (id: string) => boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <button key={p.id} onClick={() => set(p.id)} disabled={disabled?.(p.id)}
          className={cx("press flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 text-left disabled:opacity-35",
            value === p.id ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>
          <Badge name={p.name} size={36} /><span className="text-sm font-semibold">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Pairs: the batting side's pairs as set up, plus the first bowler. The pairs go to startInnings as they are. */
export function PairsStartSheet({ match: m, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const bat = E.nextBattingSide(m), field = E.otherSide(bat);
  const pairs = pairsOf(m.teams[bat].players.map((p) => p.id));
  const crease = new Set(pairs[0] ?? []);
  const bowlers = m.teams[field].players;
  const [bw, setBw] = useState<string | null>(bowlers.find((p) => !crease.has(p.id))?.id ?? null);
  const ok = pairs.length > 0 && bw && !crease.has(bw);
  return (
    <Sheet title={m.innings.length ? "The chase" : "Openers"} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onClick={() => onStart(E.startInnings(m, pairs[0][0], pairs[0][1], bw!, { pairs }))}>Start innings</PrimaryButton>}>
      <Label>{m.teams[bat].name}: batting pairs</Label>
      <ol className="mb-5 divide-y divide-line rounded-2xl bg-key px-3">
        {pairs.map(([x, y], k) => (
          <li key={k} className="flex min-h-11 items-center gap-3 text-sm">
            <span className="w-14 text-xs font-bold text-mute">Pair {k + 1}</span>
            <span className="font-semibold text-fg">{E.playerName(m, x)}{y ? ` & ${E.playerName(m, y)}` : ", alone"}</span>
          </li>
        ))}
      </ol>
      <Label>{m.teams[field].name}: bowling first</Label>
      <Pick players={bowlers} value={bw} set={setBw} disabled={(id) => crease.has(id)} />
    </Sheet>
  );
}
