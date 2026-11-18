import { useState, type ReactNode } from "react";
import { ScrollView, TextInput, View, type TextInputProps } from "react-native";
import {
  ArrowUp, Building2, CalendarDays, Check, CircleDot, Flame, Footprints, Gauge, Handshake, PersonStanding, Rocket, Shuffle,
  Timer, User, Users, Box, type LucideIcon,
} from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { Match, Player, Rules, Side, Surface } from "@shared/engine/types";
import { PRESETS, type PresetId } from "@shared/presets";
import {
  SURFACES, pairsOf, presetMatches, setWallChoice, shows, shuffled, wallChoice, type Mode, type Opt, type WallChoice,
} from "@shared/setupOptions";
import { Badge, C, Card, Num, Press, PrimaryButton, SectionTitle, Segmented, Sheet, Stepper, Toggle, Txt, tw } from "@/ui/ui";

/** Quiet outlined text field; the border turns lime on focus. */
export function Field({ style, ...p }: TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput placeholderTextColor={C.mute} selectionColor={C.sun} {...p}
      onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
      style={[tw`min-h-12 rounded-2xl border ${focus ? "border-sun" : "border-line"} bg-cream px-4 text-[15px] text-fg`, { fontFamily: "Inter_400Regular" }, style]} />
  );
}

const ICON: Record<PresetId, LucideIcon> = {
  gully: Flame, "tip-and-run": Footprints, "compulsory-run": Timer, box: Box, "box-pairs": Users, "double-wicket": Handshake,
  "sixes-only": Rocket, "tape-ball": CircleDot, office: Building2, hundred: Gauge, french: PersonStanding, solo: User, test: CalendarDays,
};

/** Preset cards in a row at the top of setup. A card stays lit while the rules are still what it set. */
export function PresetRow({ rules, mode, test, onPick }: { rules: Rules; mode: Mode; test: boolean; onPick: (id: PresetId) => void }) {
  return (
    <View>
      <SectionTitle>Start from a format</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`-mx-4`} contentContainerStyle={tw`gap-2 px-4 pb-1`}>
        {PRESETS.map((p) => {
          const on = presetMatches(p.id, rules, mode, test), I = ICON[p.id];
          return (
            <Press key={p.id} onPress={() => onPick(p.id)} accessibilityState={{ selected: on }} accessibilityLabel={p.name}
              style={tw`w-40 rounded-[18px] border p-3 ${on ? "border-sun bg-sun-soft" : "border-line bg-panel"}`}>
              <I size={20} color={on ? C.sun : C.teal} strokeWidth={2} />
              <Txt style={tw`mt-2 text-[14px] font-semibold ${on ? "text-sun" : "text-fg"}`}>{p.name}</Txt>
              <Txt style={tw`mt-0.5 text-[12px] leading-4 text-mute`}>{p.description}</Txt>
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A choice pill whose label is a number when it can be, words otherwise. */
export function ChoicePill({ active, onPress, label }: { active: boolean; onPress: () => void; label: string | number }) {
  return (
    <View style={tw`flex-1`}>
      <Press onPress={onPress} accessibilityState={{ selected: active }}
        style={tw`min-h-11 rounded-full border px-1 items-center justify-center ${active ? "border-sun bg-sun-soft" : "border-line bg-panel"}`}>
        {typeof label === "number"
          ? <Num style={tw`text-[16px] ${active ? "text-sun" : "text-fg"}`}>{label}</Num>
          : <Txt style={tw`text-[13px] font-medium ${active ? "text-sun" : "text-fg"}`} numberOfLines={1}>{label}</Txt>}
      </Press>
    </View>
  );
}

const OVERS = [3, 4, 5, 6, 10];
const TURN_BALLS = [6, 12, 18, null];
const INNINGS_BALLS = [60, 100, 120];
const BPO = [3, 4, 5, 6, 7, 8];

const Label = ({ children, top }: { children: string; top?: boolean }) =>
  <Txt style={tw`${top ? "mt-4 " : ""}mb-2 text-[13px] font-medium text-teal`}>{children}</Txt>;
const Hint = ({ children }: { children: ReactNode }) => <Txt style={tw`mt-2 text-[12px] leading-4 text-mute`}>{children}</Txt>;

/** Overs and balls: how long an innings (or a solo turn) lasts in this format. */
export function OversCard({ rules, setRules, mode, test, pairsCount }: {
  rules: Rules; setRules: (r: Rules) => void; mode: Mode; test: boolean; pairsCount: number;
}) {
  const [picked, setCustom] = useState(false), custom = picked || !OVERS.includes(rules.overs);
  const r = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setRules({ ...rules, [k]: v });
  const has = (o: Opt) => shows(o, mode, test), bpo = E.ballsPerOver(rules), pairOvers = E.pairOversOf(rules);
  const turnBalls = rules.ballsPerTurn === undefined ? 12 : rules.ballsPerTurn, lives = rules.lives ?? 1, rounds = rules.rounds ?? 1;
  const pairTotal = pairsCount * pairOvers;
  return (
    <View>
      <SectionTitle>Overs and balls</SectionTitle>
      <Card>
        {test && <>
          <Txt style={tw`text-[13px] leading-5 text-mute`}>Each team bats twice, with no over limit. An innings ends when the team is all out or declares. If the team batting first is ahead after both first innings, they can make the other team follow on.</Txt>
          <View style={tw`mt-1 border-t border-line`}>
            <Toggle on={!!rules.matchOvers} set={(v) => r("matchOvers")(v ? 30 : null)} label="Stop after a set number of overs"
              hint="Counts every innings. If nobody has won by then, it's a draw" />
            {!!rules.matchOvers && <Stepper value={rules.matchOvers} set={r("matchOvers")} max={200} />}
          </View>
        </>}
        {has("overs") && !rules.inningsBalls && <>
          <Label>{mode === "pairs" ? "Overs an innings, all pairs together" : "Overs an innings"}</Label>
          <View style={tw`flex-row gap-2`}>
            {OVERS.map((o) => <ChoicePill key={o} active={!custom && rules.overs === o} onPress={() => { setCustom(false); r("overs")(o); }} label={o} />)}
            <ChoicePill active={custom} onPress={() => setCustom(true)} label="…" />
          </View>
          {custom && <View style={tw`mt-2`}><Stepper value={rules.overs} set={r("overs")} max={50} /></View>}
        </>}
        {has("pairOvers") && <View style={tw`mt-4`}>
          <Label>Overs each pair bats</Label>
          <Stepper value={pairOvers} set={r("pairOvers")} max={10} />
          <Hint><Num style={tw`text-[12px] text-mute`}>{pairsCount}</Num> pair{pairsCount === 1 ? "" : "s"} a side, <Num style={tw`text-[12px] text-mute`}>{pairOvers}</Num> over{pairOvers === 1 ? "" : "s"} each: <Num style={tw`text-[12px] text-mute`}>{pairTotal}</Num> overs.</Hint>
          {pairTotal > 0 && rules.overs !== pairTotal && (
            <Press onPress={() => r("overs")(pairTotal)} style={tw`mt-1 min-h-10 justify-center self-start`}>
              <Txt style={tw`text-[13px] font-semibold text-sun`}>Set overs to {pairTotal}</Txt>
            </Press>
          )}
        </View>}
        {has("turn") && <>
          <Label>Turn ends after</Label>
          <View style={tw`flex-row gap-2`}>
            {TURN_BALLS.map((n) => <ChoicePill key={String(n)} active={turnBalls === n} onPress={() => r("ballsPerTurn")(n)} label={n === null ? "No cap" : n} />)}
          </View>
          <Txt style={tw`mt-1.5 text-[12px] text-mute`}>balls a turn</Txt>
        </>}
        {(has("lives") || has("turn")) && <View style={tw`flex-row gap-4 ${has("turn") ? "mt-2" : ""}`}>
          {has("lives") && <View style={tw`flex-1`}>
            <Label top={has("turn")}>Lives</Label>
            <View style={tw`flex-row gap-2`}>{[1, 2, 3].map((n) => <ChoicePill key={n} active={lives === n} onPress={() => r("lives")(n)} label={n} />)}</View>
          </View>}
          {has("turn") && <View style={tw`flex-1`}>
            <Label top>Rounds</Label>
            <View style={tw`flex-row gap-2`}>{[1, 2, 3].map((n) => <ChoicePill key={n} active={rounds === n} onPress={() => r("rounds")(n)} label={n} />)}</View>
          </View>}
        </View>}
        {has("turn") && <Txt style={tw`mt-3 text-[13px] leading-5 text-teal`}>
          {rounds === 1 ? "Everyone bats once" : `Everyone bats ${rounds} times`}. A turn ends {turnBalls === null ? "" : `after ${turnBalls} balls or `}when
          {lives === 1 ? " they're out" : ` they've been out ${lives} times`}. Everyone else bowls.
        </Txt>}
        {mode === "french" && <Hint>No overs. You bat until you're caught or hit on the legs{lives > 1 ? ` ${lives} times` : ""}, and whoever got you out bats next.</Hint>}
        {has("ballsPerOver") && <View style={tw`mt-4`}>
          <Label>Balls an over</Label>
          <Segmented value={bpo} set={(v) => r("ballsPerOver")(v === 6 ? undefined : v)} items={BPO.map((n) => ({ v: n, label: String(n) }))} />
        </View>}
        {has("inningsBalls") && <View style={tw`mt-2 border-t border-line`}>
          <Toggle on={!!rules.inningsBalls} set={(v) => r("inningsBalls")(v ? 100 : undefined)} label="Fixed balls an innings"
            hint="Like the 100-ball format: the innings is a set number of balls, not overs" />
          {!!rules.inningsBalls && <>
            <View style={tw`mb-2 flex-row gap-2`}>
              {INNINGS_BALLS.map((n) => <ChoicePill key={n} active={rules.inningsBalls === n} onPress={() => r("inningsBalls")(n)} label={n} />)}
            </View>
            <Stepper value={rules.inningsBalls} set={r("inningsBalls")} min={6} max={300} />
          </>}
        </View>}
      </Card>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode[] }) {
  const rows = children.filter(Boolean);
  return (
    <View style={tw`pt-4`}>
      <Txt style={[tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }]}>{title}</Txt>
      {rows.map((row, i) => <View key={i} style={i ? tw`border-t border-line` : undefined}>{row}</View>)}
    </View>
  );
}

/** A toggle that opens a stepper underneath when it is on. */
function ToggleStep({ on, set, label, hint, value, setValue, min, max, unit }: {
  on: boolean; set: (v: boolean) => void; label: string; hint?: string; value: number; setValue: (n: number) => void; min?: number; max: number; unit?: string;
}) {
  return (
    <View style={tw`py-1`}>
      <Toggle on={on} set={set} label={label} hint={hint} />
      {on && <View style={tw`pb-2`}>
        {unit && <Txt style={tw`mb-1 text-[12px] text-mute`}>{unit}</Txt>}
        <Stepper value={value} set={setValue} min={min} max={max} />
      </View>}
    </View>
  );
}

/** Pill chip for picking names: lime outline with a tick when on. */
function NameChip({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={tw`min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5 ${on ? "border-sun bg-sun-soft" : "border-line bg-key"}`}>
      {on && <Check size={15} color={C.sun} strokeWidth={2.4} />}
      <Txt style={tw`text-[13px] font-medium ${on ? "text-sun" : "text-fg"}`}>{children}</Txt>
    </Press>
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
    <View style={tw`px-4 pb-4`}>
      {running && <Section title="Running">{[
        has("mustRun") && <View key="must" style={tw`py-3`}>
          <Txt style={tw`text-[15px] font-medium text-fg`}>Must run</Txt>
          <Txt style={tw`mb-2 text-xs text-mute`}>Not running when you have to is out</Txt>
          <Segmented value={E.mustRunMode(rules)} set={(v) => setRules({ ...rules, mustRun: v, tipAndRun: false })}
            items={[{ v: "off", label: "Off" }, { v: "touch", label: "Bat touch" }, { v: "every-hit", label: "Every ball" }]} />
        </View>,
        has("noRunning") && <Toggle key="norun" on={!!rules.noRunning} set={r("noRunning")} label="No running" hint="Runs by running count 0 and the batters never cross" />,
        has("lastManRunsTwo") && <Toggle key="lmr2" on={!!rules.lastManRunsTwo} set={r("lastManRunsTwo")} label="Last man runs two" hint="Batting alone, every two runs run count as one" />,
      ]}</Section>}
      {has("walls") && <Section title="Boundaries and walls">{[
        has("onlyBoundaries") && <Toggle key="only" on={!!rules.onlyBoundaries} set={r("onlyBoundaries")} label="Only 4s and 6s count" hint="Running scores nothing, walls still do" />,
        <View key="wall" style={tw`py-3`}>
          <Txt style={tw`mb-2 text-[15px] font-medium text-fg`}>Ball hits the wall or roof</Txt>
          <Segmented<WallChoice> value={wc} set={(v) => setRules(setWallChoice(rules, v))}
            items={[{ v: "none", label: "Normal" }, { v: "four", label: "4" }, { v: "six", label: "6" }, { v: "out", label: "Out" }, { v: "box", label: "Box" }]} />
          {wc === "box" && <View style={tw`mt-3 gap-2`}>
            <Txt style={tw`text-xs text-mute`}>Runs for hitting each wall. Full means the back wall without a bounce.</Txt>
            {SURFACES.map((s) => (
              <View key={s.k} style={tw`flex-row items-center gap-3`}>
                <Txt style={tw`w-28 text-[14px] font-medium text-fg`}>{s.label}</Txt>
                <View style={tw`flex-1`}><Stepper value={rules.walls?.[s.k] ?? 0} set={(v) => setWall(s.k, v)} min={0} max={6} /></View>
              </View>
            ))}
          </View>}
        </View>,
        has("sixOut") && <Toggle key="sixout" on={!!rules.sixOut} set={r("sixOut")} label="Hit out of the ground is out" hint="Over the wall or into a house, the ball is lost" />,
      ]}</Section>}
      <Section title="Wickets">{[
        has("wicketPenalty") && <ToggleStep key="pen" on={pen > 0} set={(v) => r("wicketPenalty")(v ? 5 : 0)} label="A wicket costs runs"
          hint={mode === "pairs" ? "Pairs bat on when out, the side loses runs instead" : "Taken off the batting side's score"}
          value={pen || 5} setValue={r("wicketPenalty")} max={20} unit="Runs a wicket" />,
        has("dotOut") && <Toggle key="dot" on={!!rules.dotOut} set={r("dotOut")} label="A dot ball is out" />,
        has("dotBallsOut") && !rules.dotOut && <ToggleStep key="dots" on={!!rules.dotBallsOut} set={(v) => r("dotBallsOut")(v ? 3 : 0)} label="Dot balls in a row are out"
          value={rules.dotBallsOut || 3} setValue={r("dotBallsOut")} min={2} max={6} unit="Dots in a row" />,
        has("missesOut") && <ToggleStep key="miss" on={!!rules.missesOut} set={(v) => r("missesOut")(v ? 3 : 0)} label="Out after play and misses"
          value={rules.missesOut || 3} setValue={r("missesOut")} max={6} unit="Misses in a turn" />,
        has("noLbw") && <Toggle key="nolbw" on={!!rules.noLbw} set={r("noLbw")} label="No LBW" />,
        has("oneTipCatch") && <Toggle key="tip" on={rules.oneTipCatch} set={r("oneTipCatch")} label="One-tip one-hand catch is out" />,
        has("protected") && <View key="prot" style={tw`py-3`}>
          <Txt style={tw`text-[15px] font-medium text-fg`}>Protected players</Txt>
          <Txt style={tw`mt-0.5 text-xs leading-4 text-mute`}>Little ones or beginners: their first time out each innings costs {pen || 5} runs instead.</Txt>
          {names.length
            ? <View style={tw`mt-2 flex-row flex-wrap gap-2`}>{names.map((n) => <NameChip key={n} on={isProt(n)} onPress={() => flipProt(n)}>{n}</NameChip>)}</View>
            : <Txt style={tw`mt-2 text-xs text-mute`}>Name the players first, then pick them here.</Txt>}
        </View>,
      ]}</Section>
      {has("extras") && <Section title="Extras">{[
        <Toggle key="extra" on={rules.extraRun} set={r("extraRun")} label="Wide and no-ball give 1 run" />,
        <Toggle key="rebowl" on={rules.rebowl} set={r("rebowl")} label="Wide and no-ball bowled again" />,
        has("freeHit") && <Toggle key="free" on={rules.freeHit} set={r("freeHit")} label="Free hit after a no-ball" hint="Only run out on the next ball" />,
      ]}</Section>}
      {(has("lastManStands") || has("common") || has("maxOversPerBowler")) && <Section title="Players">{[
        has("lastManStands") && <Toggle key="lms" on={rules.lastManStands} set={r("lastManStands")} label="Last man stands" hint="The last batter bats alone" />,
        has("common") && <View key="common" style={tw`py-3`}>
          <Txt style={tw`text-[15px] font-medium text-fg`}>Common player</Txt>
          <Txt style={tw`mt-0.5 text-xs leading-4 text-mute`}>Odd number of players? One person plays for both teams. They bat in both innings and can bowl for either side, but not while batting.</Txt>
          <Field value={common} onChangeText={setCommon} placeholder="Name (optional)" maxLength={20} accessibilityLabel="Common player" style={tw`mt-2 w-full`} />
          {common.trim() !== "" && <Toggle on={!!rules.commonCantBowl} set={r("commonCantBowl")} label="Common player can't bowl" hint="Bats for both sides, never bowls" />}
        </View>,
        has("retireAt") && <ToggleStep key="retire" on={!!rules.retireAt} set={(v) => r("retireAt")(v ? 25 : null)} label="Retire at a score"
          hint="So everyone gets a bat. They can come back later" value={rules.retireAt || 25} setValue={r("retireAt")} max={200} />,
        has("maxOversPerBowler") && <ToggleStep key="bowler" on={rules.maxOversPerBowler !== null} set={(v) => r("maxOversPerBowler")(v ? Math.max(1, Math.ceil(overs / 5)) : null)}
          label="Limit overs per bowler" value={rules.maxOversPerBowler ?? 1} setValue={r("maxOversPerBowler")} max={overs} />,
      ]}</Section>}
      {fun && <Section title="Fun">{[
        has("goldenBall") && <View key="golden" style={tw`py-1`}>
          <Toggle on={!!rules.goldenBall} set={(v) => r("goldenBall")(v ? { over: overs, ball: bpo } : null)} label="Golden ball"
            hint="Runs on it count double, a wicket on it costs 6" />
          {rules.goldenBall && <View style={tw`flex-row gap-2 pb-2`}>
            <View style={tw`flex-1`}><Txt style={tw`mb-1 text-[12px] text-mute`}>Over</Txt>
              <Stepper value={rules.goldenBall.over} set={(v) => r("goldenBall")({ ...rules.goldenBall!, over: v })} max={overs} /></View>
            <View style={tw`flex-1`}><Txt style={tw`mb-1 text-[12px] text-mute`}>Ball</Txt>
              <Stepper value={rules.goldenBall.ball} set={(v) => r("goldenBall")({ ...rules.goldenBall!, ball: v })} max={bpo} /></View>
          </View>}
        </View>,
        has("powerBall") && <ToggleStep key="power" on={!!rules.powerBall} set={(v) => r("powerBall")(v ? bpo : null)} label="Power ball"
          hint="This ball of every over scores double" value={rules.powerBall || bpo} setValue={r("powerBall")} max={bpo} unit="Ball of the over" />,
        has("jokerOver") && <ToggleStep key="joker" on={!!rules.jokerOver} set={(v) => r("jokerOver")(v ? overs : null)} label="Joker over"
          hint="Every run in this over counts double" value={rules.jokerOver || overs} setValue={r("jokerOver")} max={overs} unit="Over" />,
      ]}</Section>}
      {has("rotateUmpire") && <Section title="Fair play">{[
        <Toggle key="ump" on={!!rules.rotateUmpire} set={r("rotateUmpire")} label="Rotate the umpire" hint="The fielding side takes turns to umpire, one over each" />,
      ]}</Section>}
    </View>
  );
}

const ShuffleButton = ({ onPress, disabled, children }: { onPress: () => void; disabled?: boolean; children: string }) => (
  <Press onPress={onPress} disabled={disabled} style={tw`min-h-9 flex-row items-center gap-1.5 rounded-full border border-line bg-panel px-3`}>
    <Shuffle size={14} color={C.teal} strokeWidth={2} />
    <Txt style={tw`text-[13px] font-medium text-fg`}>{children}</Txt>
  </Press>
);

/** Pairs: a side's batting order read two by two. Move a player up or auto-build random pairs. */
export function PairsCard({ team, names, common, setNames }: { team: string; names: string[]; common: string; setNames: (n: string[]) => void }) {
  const list = common.trim() ? [...names, common.trim()] : names;
  const pairs = pairsOf(list.map((n, i) => ({ n, i })));
  const up = (i: number) => { const l = [...names]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setNames(l); };
  const movable = (i: number) => i > 0 && i < names.length;
  return (
    <View>
      <SectionTitle action={<ShuffleButton onPress={() => setNames(shuffled(names))} disabled={names.length < 2}>Auto pairs</ShuffleButton>}>{`${team}: batting pairs`}</SectionTitle>
      <Card style={tw`px-4 py-1`}>
        {pairs.length ? pairs.map(([x, y], k) => (
          <View key={k} style={tw`min-h-12 flex-row items-center gap-3 py-1.5 ${k ? "border-t border-line" : ""}`}>
            <Txt style={tw`w-14 text-[12px] font-medium text-mute`}>Pair <Num style={tw`text-[12px] text-mute`}>{k + 1}</Num></Txt>
            <View style={tw`flex-1 flex-row flex-wrap items-center gap-2`}>
              {[x, y].map((p, j) => {
                if (!p) return null;
                const again = j === 1 && y !== null && y.i < x.i;
                return (
                  <View key={j} style={tw`flex-row items-center gap-1`}>
                    <Txt style={tw`text-[15px] ${again ? "text-mute" : "font-semibold text-fg"}`}>{p.n}</Txt>
                    {again ? <Txt style={tw`text-[12px] text-mute`}>again</Txt> : movable(p.i) && (
                      <Press onPress={() => up(p.i)} accessibilityLabel={`Move ${p.n} up`} style={tw`h-9 w-9 rounded-full border border-line bg-key items-center justify-center`}>
                        <ArrowUp size={16} color={C.teal} strokeWidth={2} />
                      </Press>
                    )}
                  </View>
                );
              })}
              {!y && <Txt style={tw`text-[12px] text-mute`}>bats alone</Txt>}
            </View>
          </View>
        )) : <Txt style={tw`py-3 text-[13px] text-mute`}>Add players and they pair up here, two by two.</Txt>}
      </Card>
    </View>
  );
}

/** French cricket: who takes the bat first. */
export function FrenchFirst({ names, first, setFirst }: { names: string[]; first: string | null; setFirst: (n: string) => void }) {
  return (
    <View>
      <SectionTitle>Who bats first</SectionTitle>
      <Card>
        {names.length
          ? <View style={tw`flex-row flex-wrap gap-2`}>{names.map((n) => <NameChip key={n} on={n === first} onPress={() => setFirst(n)}>{n}</NameChip>)}</View>
          : <Txt style={tw`text-[13px] text-mute`}>Add players, then pick who bats first.</Txt>}
        <Hint>The first other player in the list bowls first. After that, whoever gets the batter out bats next.</Hint>
      </Card>
    </View>
  );
}

/** The split fairTeams gave: each side's rating total and a reshuffle for the next fair split. */
export function FairStrip({ a, b, ratingA, ratingB, onReshuffle }: { a: string; b: string; ratingA: number; ratingB: number; onReshuffle: () => void }) {
  return (
    <View style={tw`flex-row items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-1.5`}>
      <Txt style={tw`flex-1 text-[13px] text-teal`}>Fair teams: {a} <Num style={tw`text-[13px] text-fg`}>{ratingA}</Num> · {b} <Num style={tw`text-[13px] text-fg`}>{ratingB}</Num></Txt>
      <Press onPress={onReshuffle} style={tw`min-h-10 justify-center`}><Txt style={tw`text-[13px] font-semibold text-sun`}>Reshuffle</Txt></Press>
    </View>
  );
}

/** Start in the second innings: one side already batted and set a target. */
export function ChaseCard({ on, setOn, side, setSide, target, setTarget, down, setDown, a, b, maxDown }: {
  on: boolean; setOn: (v: boolean) => void; side: Side; setSide: (s: Side) => void; target: string; setTarget: (s: string) => void;
  down: number; setDown: (n: number) => void; a: string; b: string; maxDown: number;
}) {
  return (
    <Card style={tw`py-1`}>
      <Toggle on={on} set={setOn} label="Chasing a target" hint="The first innings was played already. Start straight at the chase" />
      {on && <View style={tw`gap-3 border-t border-line pb-3 pt-3`}>
        <View>
          <Label>Who's chasing</Label>
          <Segmented<Side> value={side} set={setSide} items={[{ v: 0, label: a || "Team A" }, { v: 1, label: b || "Team B" }]} />
        </View>
        <View>
          <Label>Target</Label>
          <Field value={target} onChangeText={(v) => setTarget(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="Runs to win"
            accessibilityLabel="Target" style={[tw`text-[18px]`, { fontFamily: "Poppins_700Bold" }]} />
        </View>
        <View>
          <Label>Wickets the first side lost</Label>
          <Stepper value={down} set={setDown} min={0} max={Math.max(0, maxDown)} />
        </View>
      </View>}
    </Card>
  );
}

/** The rules both captains agree to, as rulesCard words them. They lock once the first innings starts. */
export function RulesCardView({ lines, extra }: { lines: string[]; extra?: string | null }) {
  const all = extra ? [extra, ...lines] : lines;
  return (
    <View>
      <SectionTitle>Rules card</SectionTitle>
      <Card>
        <Txt style={tw`text-[12px] leading-4 text-mute`}>Both captains agree to these. They lock when the first innings starts.</Txt>
        <View style={tw`mt-2 gap-1.5`}>
          {all.map((l) => (
            <View key={l} style={tw`flex-row gap-2`}>
              <View style={tw`mt-2 h-1.5 w-1.5 rounded-full bg-sun`} />
              <Txt style={tw`flex-1 text-[14px] leading-5 text-fg`}>{l}</Txt>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function Pick({ players, value, set, disabled }: { players: Player[]; value: string | null; set: (id: string) => void; disabled?: (id: string) => boolean }) {
  return (
    <View style={tw`flex-row flex-wrap gap-2`}>
      {players.map((p) => {
        const on = value === p.id;
        return (
          <Press key={p.id} onPress={() => set(p.id)} disabled={disabled?.(p.id)} accessibilityState={{ selected: on }}
            style={tw`min-h-12 flex-row items-center gap-2 rounded-full border py-1 pl-1 pr-4 ${on ? "border-sun bg-sun-soft" : "border-line bg-panel"}`}>
            <Badge name={p.name} size={36} />
            <Txt style={tw`text-[14px] font-medium ${on ? "text-sun" : "text-fg"}`}>{p.name}</Txt>
          </Press>
        );
      })}
    </View>
  );
}

/** Pairs: the batting side's pairs as set up, plus the first bowler. The pairs go to startInnings as they are. */
export function PairsStartSheet({ match: m, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const bat = E.nextBattingSide(m), field = E.otherSide(bat);
  const pairs = pairsOf(m.teams[bat].players.map((p) => p.id));
  const crease = new Set(pairs[0] ?? []);
  const bowlers = m.teams[field].players;
  const [bw, setBw] = useState<string | null>(bowlers.find((p) => !crease.has(p.id))?.id ?? null);
  const ok = pairs.length > 0 && !!bw && !crease.has(bw);
  return (
    <Sheet title={m.innings.length ? "The chase" : "Openers"} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onPress={() => onStart(E.startInnings(m, pairs[0][0], pairs[0][1], bw!, { pairs }))}>Start innings</PrimaryButton>}>
      <SectionTitle>{`${m.teams[bat].name}: batting pairs`}</SectionTitle>
      <Card style={tw`mb-5 px-4 py-1`}>
        {pairs.map(([x, y], k) => (
          <View key={k} style={tw`min-h-11 flex-row items-center gap-3 ${k ? "border-t border-line" : ""}`}>
            <Txt style={tw`w-14 text-[12px] font-medium text-mute`}>Pair <Num style={tw`text-[12px] text-mute`}>{k + 1}</Num></Txt>
            <Txt style={tw`flex-1 text-[14px] font-medium text-fg`}>{E.playerName(m, x)}{y ? ` & ${E.playerName(m, y)}` : ", alone"}</Txt>
          </View>
        ))}
      </Card>
      <SectionTitle>{`${m.teams[field].name}: bowling first`}</SectionTitle>
      <Pick players={bowlers} value={bw} set={setBw} disabled={(id) => crease.has(id)} />
    </Sheet>
  );
}
