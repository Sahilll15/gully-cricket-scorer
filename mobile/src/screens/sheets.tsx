import { Children, useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
import * as E from "@shared/engine/engine";
import type { Ball, Extra, Match, Player, Wicket, WicketKind } from "@shared/engine/types";
import { BLOCK_TEXT, wicketCost } from "@shared/liveKit";
import { revisedTarget } from "@shared/season";
import { Plus } from "lucide-react-native";
import { Badge, C, GhostButton, Num, Pill, Press, PrimaryButton, SectionTitle, Segmented, Sheet, Stepper, Txt, tw } from "@/ui/ui";

const addPlayer = E.addPlayer;

/** Rows of equal-width cells, standing in for the web's CSS grid-cols-N. */
export function Grid({ cols, gap = 8, children }: { cols: number; gap?: number; children: ReactNode }) {
  const cells = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {row.map((c, i) => <View key={i} style={tw`flex-1`}>{c}</View>)}
          {Array.from({ length: cols - row.length }, (_, i) => <View key={`pad${i}`} style={tw`flex-1`} />)}
        </View>
      ))}
    </View>
  );
}

const capitalize = (s: string) => s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());

export function PlayerPick({ players, value, set, disabled, note }: {
  players: Player[]; value: string | null; set: (id: string) => void; disabled?: (id: string) => boolean; note?: (id: string) => string;
}) {
  return (
    <View style={tw`flex-row flex-wrap gap-2`}>
      {players.map((p) => {
        const on = value === p.id, off = !!disabled?.(p.id);
        return (
          <Press key={p.id} onPress={() => set(p.id)} disabled={off} accessibilityState={{ selected: on, disabled: off }}
            style={[tw`min-h-12 flex-row items-center gap-2 rounded-full border py-1 pl-1 pr-4 ${on ? "border-sun bg-sun" : "border-line bg-panel"}`, off && { opacity: 0.35 }]}>
            <Badge name={p.name} size={36} />
            <View>
              <Txt style={tw`text-sm font-semibold leading-tight ${on ? "text-ink" : "text-fg"}`}>{p.name}</Txt>
              {note && <NoteText on={on} text={note(p.id)} />}
            </View>
          </Press>
        );
      })}
    </View>
  );
}

/** Bowling figures are numbers, so they read in the mono face; words stay in Inter. */
function NoteText({ on, text }: { on: boolean; text: string }) {
  const style = [tw`text-[11px] leading-tight`, { color: on ? "rgba(5,5,7,0.72)" : C.mute }];
  return /^\d/.test(text) ? <Num style={[style, { fontWeight: "500" }]}>{text}</Num> : <Txt style={[style, { fontWeight: "500" }]}>{text}</Txt>;
}

/** A Pill whose label is a number. */
export function NumPill({ active, value, onPress }: { active: boolean; value: number; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: active }}
      style={tw`min-h-11 rounded-full border px-4 items-center justify-center ${active ? "border-sun bg-sun" : "border-line"}`}>
      <Num style={tw`text-[15px] ${active ? "text-ink" : "text-teal"}`}>{value}</Num>
    </Press>
  );
}

export function AddName({ onAdd, label }: { onAdd: (name: string) => void; label: string }) {
  const [v, setV] = useState("");
  const [focus, setFocus] = useState(false);
  const submit = () => { if (v.trim()) { onAdd(v); setV(""); } };
  return (
    <View style={tw`mt-3 flex-row gap-2`}>
      <TextInput value={v} onChangeText={setV} placeholder={label} maxLength={20} onSubmitEditing={submit} submitBehavior="submit"
        returnKeyType="done" autoCapitalize="words" placeholderTextColor={C.mute} selectionColor={C.sun}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[tw`min-h-12 flex-1 rounded-[18px] border bg-panel px-4 text-[15px] text-fg ${focus ? "border-sun" : "border-line"}`, { fontFamily: "Inter_500Medium" }]} />
      <Press onPress={submit} style={tw`min-h-12 flex-row items-center justify-center gap-1 rounded-[18px] border border-line bg-panel pl-3 pr-4`}>
        <Plus size={18} color={C.sun} strokeWidth={2.2} />
        <Txt style={tw`font-medium text-fg`}>Add</Txt>
      </Press>
    </View>
  );
}

export const Label = ({ children, style, action }: { children: string; style?: string; action?: ReactNode }) => (
  <View style={tw`${style ?? ""}`}><SectionTitle action={action}>{children}</SectionTitle></View>
);

/** Lime-tinted info box. Text can't round its own background on Android, so it sits in a View. */
export const Note = ({ children, style, weight }: { children: ReactNode; style?: string; weight?: string }) => (
  <View style={tw`rounded-[18px] bg-sun-soft p-3.5 ${style ?? ""}`}><Txt style={tw`text-sm text-fg ${weight ?? ""}`}>{children}</Txt></View>
);

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
  const ok = !!(s && bw && !atCrease(bw) && (alone || (ns && s !== ns)));
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
      footer={<PrimaryButton disabled={!ok} onPress={() => onStart(E.startInnings(m, s!, alone ? null : ns, bw!, { followOn }))}>Start innings</PrimaryButton>}>
      {E.canFollowOn(m) && (
        <View style={tw`mb-5 rounded-[18px] bg-sun-soft p-3.5`}>
          <Txt style={tw`mb-2 text-sm text-fg`}><Txt style={tw`font-semibold text-fg`}>{E.testStatus(m)}.</Txt> {first} can bat again, or make {second} follow on and bat again now.</Txt>
          <Segmented value={followOn ? "yes" : "no"} set={(v) => chooseFollowOn(v === "yes")}
            items={[{ v: "no", label: `${first} bat` }, { v: "yes", label: `${second} follow on` }]} />
        </View>
      )}
      <Label>{`${m.teams[bat].name}: on strike`}</Label>
      <PlayerPick players={batters} value={s} set={(id) => { if (id === ns) setNs(s); setS(id); }} />
      <Label style="mt-5" action={batters.length > 1 ? (
        <View style={tw`flex-row rounded-full border border-line bg-panel p-1`}>
          {[false, true].map((v) => (
            <Press key={String(v)} onPress={() => setAlone(v)} accessibilityState={{ selected: alone === v }}
              style={tw`min-h-10 items-center justify-center rounded-full px-3.5 ${alone === v ? "bg-sun" : ""}`}>
              <Txt style={tw`text-[13px] font-medium ${alone === v ? "text-ink" : "text-teal"}`}>{v ? "Bat alone" : "Two batters"}</Txt>
            </Press>
          ))}
        </View>
      ) : undefined}>Non-striker</Label>
      {alone
        ? <Note>One batter at a time. When they're out the next one walks in, and every player gets to bat.</Note>
        : <PlayerPick players={batters} value={ns} set={(id) => { if (id === s) setS(ns); setNs(id); }} />}
      <Label style="mt-5">{`${m.teams[field].name}: ${test ? "bowling" : "bowling first"}`}</Label>
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
      {yet.length > 0 && st.bowlOrder.length > 0 && <Note style="mt-3">Yet to bowl: {yet.map((p) => p.name).join(", ")}. Give them a go?</Note>}
      {onEnd && (
        <View style={tw`mt-4`}><GhostButton onPress={onEnd} danger>{endLabel}</GhostButton></View>
      )}
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
  const ready = !!(kind && (!needNew || newId));
  const name = (id: string | null) => E.playerName(m, id);

  return (
    <Sheet title={st.freeHit ? "Free hit: only a run out" : extra === "nb" ? "No ball: only a run out" : extra === "wd" ? "Out on a wide" : extra ? "Out on a bye: only a run out" : "How out?"} onClose={onClose}
      footer={<PrimaryButton tone="navy" disabled={!ready}
        onPress={() => onDone(m, { runs: kind === "run out" ? runs : 0, extra: extra ?? undefined, wicket: { kind: kind!, out: kind === "run out" ? out : "s", outId: (kind === "run out" && out === "ns" ? st.nonStriker : st.striker) ?? undefined, newId: offer.some((p) => p.id === newId) ? newId : null, ...(byLabel && fielder && { fielderId: fielder }) } })}>
        Confirm wicket
      </PrimaryButton>}>
      <Grid cols={2}>
        {kinds.map((k) => <Pill key={k} active={kind === k} onPress={() => setKind(k)}>{capitalize(k)}</Pill>)}
      </Grid>
      {kind === "run out" && (
        <>
          <Label style="mt-5">Who is out?</Label>
          <Grid cols={2}>
            <Pill active={out === "s"} onPress={() => setOut("s")}>{name(st.striker)}</Pill>
            {st.nonStriker && <Pill active={out === "ns"} onPress={() => setOut("ns")}>{name(st.nonStriker)}</Pill>}
          </Grid>
          <Label style="mt-5">{`Runs completed before the run out${extra === "nb" ? " (plus the no-ball run)" : extra === "wd" ? " (plus the wide)" : ""}`}</Label>
          <Grid cols={4}>{[0, 1, 2, 3].map((r) => <NumPill key={r} active={runs === r} value={r} onPress={() => setRuns(r)} />)}</Grid>
        </>
      )}
      {byLabel && (
        <>
          <Label style="mt-5">{`${byLabel} (optional)`}</Label>
          <PlayerPick players={fielders} value={fielder} set={(id) => setFielder((f) => (f === id ? null : id))} />
          {!solo && <AddName label="Fielder's name" onAdd={(n) => { const r = addPlayer(m, fieldSide, n); setM(r.match); setFielder(r.id); }} />}
        </>
      )}
      {needNew ? (
        <>
          <Label style="mt-5">New batter</Label>
          <PlayerPick players={offer} value={newId} set={setNewId} note={(id) => (fresh.some((p) => p.id === id) ? "Yet to bat" : "Retired, comes back")} />
          <AddName label="New batter's name" onAdd={(n) => { const r = addPlayer(m, inn.bat, n); setM(r.match); setNewId(r.id); }} />
        </>
      ) : (
        <>
          {offer.length > 0 && (
            <>
              <Label style="mt-5">Retired batter coming back? (optional)</Label>
              <PlayerPick players={offer} value={newId} set={(id) => setNewId((v) => (v === id ? null : id))} />
            </>
          )}
          {!newId && (
            <Note style="mt-5" weight="font-medium">
              {stays ? `${name(outId)} is protected: stays in, and it costs ${cost} run${cost === 1 ? "" : "s"}.`
                : pairs ? `${name(outId)} bats on.${cost ? ` It costs ${cost} run${cost === 1 ? "" : "s"}.` : ""}`
                : solo ? (lastWicket ? `That's ${name(st.striker)}'s last life. The turn ends.`
                : `${name(st.striker)} loses a life and bats on, ${livesAfter} ${livesAfter === 1 ? "life" : "lives"} left.`)
                : lastWicket ? "That's the last wicket. The innings ends."
                : alone ? "Last man stands: the other batter carries on alone."
                : "Nobody left to bat. That's all out, the innings ends."}
            </Note>
          )}
        </>
      )}
      {cost > 0 && !stays && !pairs && <Txt style={tw`mt-3 text-sm text-mute`}>This dismissal costs <Num style={tw`text-sm text-mute`}>{cost}</Num> run{cost === 1 ? "" : "s"}.</Txt>}
    </Sheet>
  );
}

export function EditBallSheet({ ball, onSave, onClose }: { ball: Ball; onSave: (p: { runs: number; extra?: Extra }) => void; onClose: () => void }) {
  const [runs, setRuns] = useState(ball.runs);
  const [extra, setExtra] = useState<Extra | undefined>(ball.extra);
  const extras: { v?: Extra; label: string }[] = [{ label: "None" }, { v: "wd", label: "Wide" }, { v: "nb", label: "No ball" }, { v: "b", label: "Bye" }, { v: "lb", label: "Leg bye" }];
  return (
    <Sheet title="Correct this ball" onClose={onClose}>
      <Label>Runs</Label>
      <Grid cols={4}>{[0, 1, 2, 3, 4, 5, 6].map((r) => <NumPill key={r} active={runs === r} value={r} onPress={() => setRuns(r)} />)}</Grid>
      <Label style="mt-5">Extra</Label>
      <View style={tw`flex-row flex-wrap gap-2`}>{extras.map((x) => <Pill key={x.label} active={extra === x.v} onPress={() => setExtra(x.v)}>{x.label}</Pill>)}</View>
      {ball.wicket && <Txt style={tw`mt-4 text-xs text-mute`}>The wicket on this ball stays. Undo back to it to change the wicket.</Txt>}
      <View style={tw`mt-6`}><PrimaryButton onPress={() => onSave({ runs, extra })}>Save</PrimaryButton></View>
    </Sheet>
  );
}

export function OversSheet({ match, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const min = E.minOvers(match), inn = match.innings[match.innings.length - 1];
  const [overs, setOvers] = useState(match.status === "live" && inn && !inn.superOver ? inn.overs : match.rules.overs);
  return (
    <Sheet title="Change overs" onClose={onClose}>
      <Txt style={tw`mb-3 text-sm text-mute`}>{match.status === "break" ? "Sets the overs for the chase." : "Running late or getting dark? Change the overs for the rest of the match."}</Txt>
      <Stepper value={overs} set={setOvers} min={min} max={50} />
      {match.status === "live" && min > 1 && <Txt style={tw`mt-2 text-xs text-mute`}>Can't go below <Num style={tw`text-xs text-mute`}>{min}</Num>, that many overs are already started.</Txt>}
      <View style={tw`mt-6`}><PrimaryButton onPress={() => onSave(E.setOvers(match, overs))}>Save</PrimaryButton></View>
    </Sheet>
  );
}

/** Rain: fewer overs for the chase and a lower target, shown as runs to win and balls left. */
export function RainSheet({ match, onSave, onClose }: { match: Match; onSave: (m: Match) => void; onClose: () => void }) {
  const first = E.replay(match, 0).runs, was = match.innings[0].overs, inn = match.innings[1];
  const min = E.minOvers(match);
  const [overs, setOvers] = useState(Math.min(inn.overs, was));
  const [target, setTarget] = useState(match.revisedTarget ?? revisedTarget(first, was, Math.min(inn.overs, was)));
  const pickOvers = (o: number) => { setOvers(o); setTarget(revisedTarget(first, was, o)); };
  return (
    <Sheet title="Rain rule" onClose={onClose}
      footer={<PrimaryButton onPress={() => onSave(E.setRevisedTarget(E.setOvers(match, overs), target))}>{`Apply: ${target} to win in ${overs} overs`}</PrimaryButton>}>
      <Txt style={tw`mb-3 text-sm text-mute`}>{`Rain cut the chase short? Pick the new overs. The target is the first innings (${first} in ${was} overs) scaled down. Change it if you agree a different number.`}</Txt>
      <SectionTitle>Overs for the chase</SectionTitle>
      <Stepper value={overs} set={pickOvers} min={min} max={was} />
      <View style={tw`mt-4`}><SectionTitle>Runs to win</SectionTitle></View>
      <Stepper value={target} set={setTarget} min={1} max={500} />
      {!!match.revisedTarget && <View style={tw`mt-4`}><GhostButton onPress={() => onSave(E.setRevisedTarget(match, null))}>Back to the normal target</GhostButton></View>}
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
        onPress={() => onSave(E.retire(m, who, newId, !!hurt))}>Retire {name(who === "s" ? st.striker : st.nonStriker)}</PrimaryButton>}>
      <Txt style={tw`mb-3 text-sm text-mute`}>{hurt ? "They go off retired hurt, not out, and can come back in later."
        : batter && m.rules.retireAt
        ? `${name(batter)} has reached ${m.rules.retireAt}, so they retire. They go off not out and can bat again later.`
        : "Hurt, or has to leave? They go off not out and it isn't a wicket."}</Txt>
      <Grid cols={2}>
        <Pill active={who === "s"} onPress={() => setWho("s")}>{name(st.striker)}</Pill>
        {st.nonStriker && <Pill active={who === "ns"} onPress={() => setWho("ns")}>{name(st.nonStriker)}</Pill>}
      </Grid>
      <Label style="mt-5">Who comes in?</Label>
      <PlayerPick players={remaining} value={newId} set={setNewId} />
      <AddName label="New batter's name" onAdd={(n) => { const r = addPlayer(m, inn.bat, n); setM(r.match); setNewId(r.id); }} />
      {st.nonStriker && (
        <Press onPress={() => setNewId(null)}
          style={tw`mt-3 min-h-12 w-full items-center justify-center rounded-[18px] border px-4 ${newId === null ? "border-sun bg-sun-soft" : "border-line bg-panel"}`}>
          <Txt style={tw`text-center font-medium ${newId === null ? "text-fg" : "text-teal"}`}>Nobody, the other batter carries on alone</Txt>
        </Press>
      )}
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
      footer={<PrimaryButton disabled={!bw} onPress={() => onStart(E.startTurn(m, bw!))}>{`Start ${who}'s turn`}</PrimaryButton>}>
      <Label>{`Who bowls to ${who}?`}</Label>
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
      footer={<PrimaryButton disabled={!bat || !bw || bat === bw} onPress={() => onStart(E.frenchNext(m, bat!, bw!))}>{`Start ${who}'s turn`}</PrimaryButton>}>
      <Label>Who bats next?</Label>
      <PlayerPick players={here} value={bat} set={(id) => { setBat(id); if (id === bw) setBw(bowlerFor(id)); }} note={(id) => (id === outBy ? "Got them out" : "")} />
      <Label style="mt-5">{`Who bowls to ${who}?`}</Label>
      <PlayerPick players={here.filter((p) => p.id !== bat)} value={bw} set={setBw} note={(id) => (id === prev ? "Just batted" : "")} />
    </Sheet>
  );
}

const SOLO_FULL: [string, number][] = [["R", 34], ["B", 30], ["SR", 38], ["4s", 26], ["6s", 26], ["Out", 32]];
const SOLO_SHORT: [string, number][] = [["R", 36], ["B", 32], ["Out", 34]];

/** Solo: the leaderboard as hairline rows. `full` adds strike rate and boundaries, for the result. */
export function SoloTable({ match: m, full, highlight }: { match: Match; full?: boolean; highlight?: string | null }) {
  const rows = E.soloStandings(m), cols = full ? SOLO_FULL : SOLO_SHORT;
  return (
    <View>
      <View style={tw`flex-row items-center px-3.5 py-2.5`}>
        <Txt style={tw`w-6 text-[12px] font-medium text-mute`}>#</Txt>
        <Txt style={tw`flex-1 text-[12px] font-medium text-mute`}>Name</Txt>
        {cols.map(([h, w]) => <Txt key={h} style={[tw`text-right text-[12px] font-medium text-mute`, { width: w }]}>{h}</Txt>)}
      </View>
      {rows.map((r, i) => {
        const vals = full ? [r.runs, r.balls, r.strikeRate.toFixed(0), r.fours, r.sixes, r.outs] : [r.runs, r.balls, r.outs];
        const on = r.id === highlight;
        return (
          <View key={r.id} style={[tw`flex-row items-center border-t border-line px-3.5 py-2.5`, on && { backgroundColor: C.sunSoft }]}>
            <Num style={tw`w-6 text-[12px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
            <View style={tw`flex-1 min-w-0 pr-1`}>
              <Txt style={tw`text-[14px] font-medium text-fg`} numberOfLines={1}>{r.name}</Txt>
              {r.turns === 0 && <Txt style={tw`text-xs text-mute`}>Yet to bat</Txt>}
            </View>
            {vals.map((v, k) => (
              <Num key={k} style={[k === 0 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, { textAlign: "right", width: cols[k][1] }]}>{String(v)}</Num>
            ))}
          </View>
        );
      })}
    </View>
  );
}
