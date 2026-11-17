import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import { Timer } from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { BallInput, Match, Rules, Side } from "@shared/engine/types";
import * as K from "@shared/liveKit";
import { AddName, Grid, Label, Note, PlayerPick } from "./sheets";
import { C, GhostButton, Num, Pill, Press, PrimaryButton, Segmented, Sheet, Stepper, Toggle, Txt, tw } from "@/ui/ui";

const HAIR = "#1e2321";
const OUT_BG = "#2b1311", OUT_LINE = "#4a1f1a";
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Small outlined chip for the controls that sit above the extras row; lime when on. */
export function Chip({ on, onPress, children, a11y }: { on?: boolean; onPress: () => void; children: ReactNode; a11y?: string }) {
  return (
    <Press onPress={onPress} accessibilityLabel={a11y} accessibilityState={{ selected: !!on }}
      style={{ minHeight: 32, borderRadius: 99, borderWidth: 1, borderColor: on ? C.sun : "#2a302c", backgroundColor: on ? C.sun : "transparent",
        paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 }}>
      {typeof children === "string" ? <Txt style={{ fontSize: 12, fontWeight: on ? "600" : "500", color: on ? C.ink : C.teal }} numberOfLines={1}>{children}</Txt> : children}
    </Press>
  );
}

function Input({ value, set, placeholder }: { value: string; set: (v: string) => void; placeholder: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput value={value} onChangeText={set} placeholder={placeholder} maxLength={40} placeholderTextColor={C.mute} selectionColor={C.sun}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={[tw`mt-3 min-h-12 rounded-[18px] border bg-panel px-4 text-[15px] text-fg ${focus ? "border-sun" : "border-line"}`, { fontFamily: "Inter_500Medium" }]} />
  );
}

/** Must run: a 0 the bat touched (or any 0 with compulsory run). Yes scores the runs, no is out. */
export function DidRunSheet({ match: m, input, onRan, onOut, onClose }: { match: Match; input: BallInput; onRan: (runs: number) => void; onOut: () => void; onClose: () => void }) {
  const every = E.mustRunMode(m.rules) === "every-hit";
  return (
    <Sheet title="Did they run?" onClose={onClose}>
      <Txt style={tw`mb-3 text-sm text-mute`}>{every ? "Compulsory run: they have to run on every ball." : "The bat touched it, so they had to run."}{input.extra === "nb" ? " No ball." : ""}</Txt>
      <Grid cols={3}>{[1, 2, 3].map((r) => <Pill key={r} onPress={() => onRan(r)}>{`Ran ${r}`}</Pill>)}</Grid>
      <View style={tw`mt-3`}><GhostButton danger onPress={onOut}>No, out: didn't run</GhostButton></View>
    </Sheet>
  );
}

export function OverthrowSheet({ value, onPick, onClose }: { value: number; onPick: (n: number) => void; onClose: () => void }) {
  return (
    <Sheet title="Overthrow" onClose={onClose}>
      <Txt style={tw`mb-3 text-sm text-mute`}>Runs from the overthrow, on top of what they ran. Then tap the runs they ran.</Txt>
      <Grid cols={3}>{[1, 2, 3, 4, 5, 6].map((r) => <Pill key={r} active={value === r} onPress={() => onPick(r)}>{`+${r}`}</Pill>)}</Grid>
      {value > 0 && <View style={tw`mt-3`}><GhostButton onPress={() => onPick(0)}>No overthrow</GhostButton></View>}
    </Sheet>
  );
}

const BOXES = [{ z: 9, x: 20, y: 10, w: 200, h: 60 }, { z: 11, x: 10, y: 80, w: 60, h: 150 }, { z: 10, x: 170, y: 80, w: 60, h: 150 }];

/** Wagon wheel: one tap on where the shot went, or skip. */
export function WagonSheet({ box, onPick, onSkip }: { box: boolean; onPick: (zone: number) => void; onSkip: () => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const pick = (z: number) => { setHot(z); onPick(z); };
  const font = { fontFamily: "Inter_600SemiBold" };
  return (
    <Sheet title="Where did it go?" onClose={onSkip}>
      <View style={tw`items-center`}>
        <Svg width={260} height={260} viewBox="0 0 240 240">
          {box ? (
            <>
              {BOXES.map((b) => (
                <G key={b.z} onPress={() => pick(b.z)}>
                  <Rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={hot === b.z ? C.sunSoft : C.key} stroke={hot === b.z ? C.sun : C.line} strokeWidth={1.5} />
                  <SvgText x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} fontSize={12} fill={C.fg} textAnchor="middle" {...font}>{K.zoneName(b.z)}</SvgText>
                </G>
              ))}
              <Rect x={112} y={150} width={16} height={60} rx={4} fill={C.raised} />
            </>
          ) : (
            <>
              {K.FIELD_ZONES.map((label, i) => {
                const z = i + 1, from = K.zoneFrom(z), at = K.labelAt(120, 120, 78, z);
                return (
                  <G key={z} onPress={() => pick(z)}>
                    <Path d={K.wedgePath(120, 120, 112, from, from + 45)} fill={hot === z ? C.sunSoft : C.key} stroke={hot === z ? C.sun : C.cream} strokeWidth={2} />
                    <SvgText x={at.x} y={at.y + 4} fontSize={11} fill={C.fg} textAnchor="middle" {...font}>{label}</SvgText>
                  </G>
                );
              })}
              <Rect x={113} y={92} width={14} height={56} rx={3} fill={C.raised} />
            </>
          )}
        </Svg>
      </View>
      <Txt style={tw`mt-1 text-center text-xs text-mute`}>{box ? "Batting end at the bottom." : "Bowler's end at the top, off side on the right."}</Txt>
      <View style={tw`mt-3`}><GhostButton onPress={onSkip}>Skip</GhostButton></View>
    </Sheet>
  );
}

/** Pairs: what the pair in now has made, how long they have left, and the best pairs so far. */
export function PairsStrip({ match: m, idx }: { match: Match; idx: number }) {
  const p = K.pairNow(m, idx);
  if (!p) return null;
  const n = tw`text-[13px] text-fg`;
  return (
    <View style={[tw`mt-3 rounded-[22px] border border-line bg-panel`, { paddingVertical: 4, paddingHorizontal: 14 }]}>
      <Txt style={tw`py-2.5 text-[13px] text-mute`}>
        This pair <Num style={n}>{p.runs}</Num> run{p.runs === 1 ? "" : "s"}, <Num style={n}>{p.outs}</Num> out · <Num style={tw`text-[13px] text-teal`}>{p.ballsLeft}</Num> ball{p.ballsLeft === 1 ? "" : "s"} left for them
      </Txt>
      {p.standings.length > 1 && (
        <View style={[tw`flex-row`, { borderTopWidth: 1, borderTopColor: HAIR }]}>
          {p.standings.slice(0, 3).map((r, i) => (
            <View key={r.names} style={[tw`flex-1 py-2.5`, i > 0 && { borderLeftWidth: 1, borderLeftColor: HAIR, paddingLeft: 10 }]}>
              <View style={tw`flex-row items-center gap-1.5`}>
                <Num style={[tw`text-[11px] ${i === 0 ? "text-sun" : "text-mute"}`, { fontWeight: "500" }]}>{i + 1}</Num>
                <Txt style={tw`flex-1 text-[12px] text-teal`} numberOfLines={1}>{r.names}</Txt>
              </View>
              <Num style={tw`mt-0.5 text-[16px] text-fg`}>{r.runs}</Num>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** The rules in force as short sentences, and the way to change one by agreement. */
export function RulesSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [changing, setChanging] = useState(false);
  if (changing) return <ChangeRules match={m} onSave={onSave} onClose={() => setChanging(false)} />;
  return (
    <Sheet title="Rules" onClose={onClose}>
      <View style={{ borderTopWidth: 1, borderTopColor: HAIR }}>
        {E.rulesCard(m).map((l) => <Txt key={l} style={[tw`py-2.5 text-[15px] text-fg`, { borderBottomWidth: 1, borderBottomColor: HAIR }]}>{l}</Txt>)}
      </View>
      {m.status === "live" && <View style={tw`mt-5`}><PrimaryButton tone="navy" onPress={() => setChanging(true)}>Change a rule</PrimaryButton></View>}
    </Sheet>
  );
}

function NumRow({ value, set, min, max, step, off }: { value: number; set: (n: number) => void; min: number; max: number; step: number; off?: string }) {
  const box = tw`h-10 w-10 items-center justify-center rounded-xl bg-key`;
  return (
    <View style={tw`flex-row items-center gap-2`}>
      <Press style={box} onPress={() => set(Math.max(min, value - step))} accessibilityLabel="Less"><Txt style={tw`text-xl font-bold`}>−</Txt></Press>
      {value === 0 && off ? <Txt style={[tw`text-center text-[14px] text-teal`, { minWidth: 64 }]}>{off}</Txt>
        : <Num style={[tw`text-center text-[17px]`, { minWidth: 64 }]}>{value}</Num>}
      <Press style={box} onPress={() => set(Math.min(max, value + step))} accessibilityLabel="More"><Txt style={tw`text-xl font-bold`}>+</Txt></Press>
    </View>
  );
}

function ChangeRules({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Rules>>({});
  const [who, setWho] = useState<string[]>([]);
  const fields = K.ruleFields(m), next = E.changeRules(m, draft, who), changed = next !== m, solo = E.isSolo(m);
  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const sides: Side[] = solo ? [0] : [0, 1];
  return (
    <Sheet title="Change a rule" onClose={onClose}
      footer={<PrimaryButton disabled={!changed || !K.agreed(m, who)} onPress={() => { onSave(next); onClose(); }}>Both sides agree, change it</PrimaryButton>}>
      <Txt style={tw`mb-2 text-sm text-mute`}>It applies from the next ball. Undo takes it back.</Txt>
      {fields.map((f) => {
        const v = K.fieldValue(m, f, draft), set = (x: boolean | number | string) => setDraft((d) => K.setField(d, f, x));
        return (
          <View key={f.key} style={{ borderBottomWidth: 1, borderBottomColor: HAIR }}>
            {f.kind === "toggle" ? <Toggle on={!!v} set={set} label={f.label} />
              : f.kind === "number" ? (
                <View style={tw`flex-row items-center gap-3 py-2.5`}>
                  <Txt style={tw`flex-1 text-[15px] font-medium`}>{f.label}</Txt>
                  <NumRow value={v as number} set={set} min={f.min} max={f.max} step={f.step} off={f.off} />
                </View>
              ) : (
                <View style={tw`py-2.5`}>
                  <Txt style={tw`mb-2 text-[15px] font-medium`}>{f.label}</Txt>
                  <Segmented value={v as string} set={set} items={f.options.map((o) => ({ v: o.v, label: o.label }))} />
                </View>
              )}
          </View>
        );
      })}
      <Label style="mt-5">{solo ? "Who agreed? Pick at least two players" : "Who agreed? A captain from each side"}</Label>
      {sides.map((s) => (
        <View key={s} style={tw`mb-3`}>
          {!solo && <Txt style={tw`mb-1.5 text-xs font-medium text-mute`}>{m.teams[s].name}</Txt>}
          <View style={tw`flex-row flex-wrap gap-2`}>
            {m.teams[s].players.filter((p) => !E.hasLeft(m, p.id)).map((p) => <Chip key={p.id} on={who.includes(p.id)} onPress={() => toggle(p.id)}>{p.name}</Chip>)}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

/** Corrections of earlier balls and agreed rule changes, oldest first. */
export function ChangeLogSheet({ match: m, onClose }: { match: Match; onClose: () => void }) {
  const edits = E.changeLog(m), rules = E.ruleChanges(m);
  const names = (ids: string[]) => ids.map((id) => E.playerName(m, id)).join(" and ");
  const row = { borderBottomWidth: 1, borderBottomColor: HAIR, paddingVertical: 10 };
  return (
    <Sheet title="Change log" onClose={onClose}>
      {!edits.length && !rules.length && <Txt style={tw`text-sm text-mute`}>Nothing has been changed yet.</Txt>}
      {edits.length > 0 && <>
        <Label>Balls corrected</Label>
        {edits.map((c, i) => (
          <View key={i} style={row}><Txt style={tw`text-[14px] text-fg`}>{c.text}</Txt><Txt style={tw`text-xs text-mute`}>{time(c.at)}</Txt></View>
        ))}
      </>}
      {rules.length > 0 && <>
        <Label style={edits.length ? "mt-5" : undefined}>Rules changed</Label>
        {rules.map((c, i) => (
          <View key={i} style={row}>
            <Txt style={tw`text-[14px] text-fg`}>{Object.keys(c.to).map((k) => K.ruleLabel(m, k)).join(", ")}</Txt>
            <Txt style={tw`text-xs text-mute`}>Agreed by {names(c.agreedBy)}, {time(c.at)}</Txt>
          </View>
        ))}
      </>}
    </Sheet>
  );
}

export function BallLostSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const [reason, setReason] = useState(K.LOST_REASONS[0]);
  return (
    <Sheet title="Ball lost" onClose={onClose} footer={<PrimaryButton onPress={() => { onSave(E.ballLost(m, reason)); onClose(); }}>Ball lost</PrimaryButton>}>
      <Txt style={tw`mb-3 text-sm text-mute`}>A dead ball: nothing counts and the over carries on.</Txt>
      <View style={tw`flex-row flex-wrap gap-2`}>{K.LOST_REASONS.map((r) => <Pill key={r} active={reason === r} onPress={() => setReason(r)}>{r}</Pill>)}</View>
      <Input value={K.LOST_REASONS.includes(reason) ? "" : reason} set={(v) => setReason(v || K.LOST_REASONS[0])} placeholder="Or say what happened" />
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
      footer={<PrimaryButton onPress={() => { onSave(E.addPenalty(m, side, runs, reason || "Penalty")); onClose(); }}>{`Give ${runs} run${runs === 1 ? "" : "s"} to ${m.teams[side].name}`}</PrimaryButton>}>
      <Label>To which side?</Label>
      <Segmented value={side} set={setSide} items={([0, 1] as Side[]).map((s) => ({ v: s, label: `${m.teams[s].name}${s === inn.bat ? " (batting)" : ""}` }))} />
      <Label style="mt-5">Runs</Label>
      <Stepper value={runs} set={setRuns} min={1} max={20} />
      <Input value={reason} set={setReason} placeholder="Why? Ball hit the helmet, say" />
      {side !== inn.bat && <Txt style={tw`mt-3 text-xs text-mute`}>The fielding side gets them on its own innings.</Txt>}
    </Sheet>
  );
}

export function AddPlayerSheet({ match: m, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const solo = E.isSolo(m), inn = m.innings[m.innings.length - 1];
  const [side, setSide] = useState<Side>(inn ? E.otherSide(inn.bat) : 0);
  return (
    <Sheet title="Add a player" onClose={onClose}>
      {solo ? <Txt style={tw`mb-1 text-sm text-mute`}>They join the end of the batting order.</Txt> : <>
        <Label>Joins</Label>
        <Segmented value={side} set={setSide} items={([0, 1] as Side[]).map((s) => ({ v: s, label: m.teams[s].name }))} />
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
      footer={<PrimaryButton tone="navy" disabled={!id} onPress={() => { onSave(K.leaveMatch(m, id!), id!); onClose(); }}>{id ? `${E.playerName(m, id)} went home` : "Pick who left"}</PrimaryButton>}>
      <Txt style={tw`mb-3 text-sm text-mute`}>They can't bat or bowl again. What they did so far stays on the card.</Txt>
      {sides.map((s) => (
        <View key={s} style={tw`mb-4`}>
          {!solo && <Label>{m.teams[s].name}</Label>}
          <PlayerPick players={m.teams[s].players.filter((p) => !E.hasLeft(m, p.id))} value={id} set={setId} />
        </View>
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
      footer={<PrimaryButton onPress={() => { onSet(Date.now() + mins * 60000); onClose(); }}>{`Start ${mins} minutes`}</PrimaryButton>}>
      <Txt style={tw`mb-3 text-sm text-mute`}>How long is the booking? The phone buzzes 10 and 5 minutes before the end.</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`mb-3 flex-row gap-2`}>
        {K.TURF_PRESETS.map((p) => <Pill key={p} active={mins === p} onPress={() => setMins(p)}>{`${p} min`}</Pill>)}
      </ScrollView>
      <View style={tw`items-center`}><NumRow value={mins} set={setMins} min={5} max={300} step={5} /></View>
      {end !== null && <View style={tw`mt-4`}><GhostButton danger onPress={() => { onSet(null); onClose(); }}>Clear the timer</GhostButton></View>}
    </Sheet>
  );
}

/** Header chip counting down to the end of the booking; calls out the 10 and 5 minute marks once each. */
export function TurfChip({ end, onPress, onAlert }: { end: number; onPress: () => void; onAlert: (text: string) => void }) {
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
  const left = end - now, tone = left <= 5 * 60000 ? "out" : left <= 10 * 60000 ? "sun" : "plain";
  const ink = tone === "out" ? C.out : tone === "sun" ? C.sun : C.teal;
  return (
    <Press onPress={onPress} accessibilityLabel="Turf timer"
      style={[tw`flex-row items-center gap-1.5 rounded-full border px-3 py-1`, { borderColor: tone === "out" ? OUT_LINE : tone === "sun" ? C.sun : C.line, backgroundColor: tone === "out" ? OUT_BG : C.panel }]}>
      <Timer size={12} color={ink} strokeWidth={2.2} />
      {left > 0 ? <Txt style={[tw`text-[12px]`, { color: ink }]}><Num style={[tw`text-[12px]`, { color: tone === "plain" ? C.fg : ink }]}>{K.clock(left)}</Num> left</Txt>
        : <Txt style={[tw`text-[12px] font-semibold`, { color: ink }]}>Time's up</Txt>}
    </Press>
  );
}
