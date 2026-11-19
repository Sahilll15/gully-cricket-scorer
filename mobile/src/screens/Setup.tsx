import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, ArrowUp, Check, ChevronDown, Minus, Pencil, Plus, Scale, Shuffle, Users, X, Zap, type LucideIcon } from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { Match, Player, Rules, Side, Team } from "@shared/engine/types";
import { playerPool } from "@shared/stats";
import { nextRules, planned, seriesScore } from "@shared/engine/series";
import { fairTeams, ratingsFor, type FairSplit } from "@shared/records";
import { applyPreset, type PresetId } from "@shared/presets";
import {
  DEFAULT_RULES, buildTeams, draftMatch, forMatch, modeOf, pairsOf, protectIds, roster, ruleSummary, shows, shuffled, soloSettings, withMode, type Mode,
} from "@shared/setupOptions";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { flag, matchStartParams, presetIdOf } from "@shared/matchEvents";
import { GlossaryLink } from "@/ui/guide";
import { C, Badge, Card, Header, Num, Page, Press, PrimaryButton, SectionTitle, Segmented, Sheet, Txt, tw } from "@/ui/ui";
import { OpenersSheet, SoloTurnSheet } from "./sheets";
import { ChaseCard, FairStrip, Field, FrenchFirst, OversCard, PairsCard, PairsStartSheet, PresetRow, RulesCardView, RulesEditor } from "./setupParts";

/** Splits "Rahul, Amit\nSam" into names, so a squad can be pasted in one go. */
const splitNames = (v: string) => v.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);

function Chip({ onPress, active, icon: I, children }: { onPress: () => void; active?: boolean; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Press onPress={onPress} style={tw`min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5 ${active ? "border-sun bg-sun-soft" : "border-line bg-key"}`}>
      {I && <I size={15} color={active ? C.sun : C.teal} strokeWidth={2} />}
      <Txt style={tw`text-[13px] font-medium ${active ? "text-sun" : "text-fg"}`}>{children}</Txt>
    </Press>
  );
}

function TeamCard({ label, name, setName, names, setNames, size, setSize, locked, lockName, other, known }: {
  label: string; name: string; setName: (s: string) => void; names: string[]; setNames: (n: string[]) => void;
  size: number; setSize: (n: number) => void; locked?: boolean; lockName?: boolean; other: string; known: string[];
}) {
  const saved = useStore((s) => s.teams).filter((t) => t.name !== other);
  const [v, setV] = useState("");
  const [nameFocus, setNameFocus] = useState(false);
  const add = (list: string[]) => {
    const have = new Set(names.map((n) => n.toLowerCase()));
    const fresh = list.filter((n) => !have.has(n.toLowerCase()) && have.add(n.toLowerCase()));
    if (fresh.length) setNames([...names, ...fresh]);
  };
  const submit = () => { add(splitNames(v)); setV(""); };
  const unnamed = Math.max(0, size - names.length);
  const fixedName = locked || lockName;
  return (
    <Card>
      <View style={tw`flex-row items-center gap-3`}>
        <Badge name={name || label} size={44} />
        <TextInput value={name} onChangeText={setName} placeholder={label} maxLength={18} editable={!fixedName} accessibilityLabel={`${label} name`}
          placeholderTextColor={C.mute} selectionColor={C.sun} onFocus={() => setNameFocus(true)} onBlur={() => setNameFocus(false)}
          style={[tw`min-h-12 flex-1 rounded-2xl bg-cream pl-4 pr-10 text-[18px] text-fg border ${nameFocus ? "border-sun" : "border-line"}`,
            { fontFamily: "Inter_600SemiBold" }]} />
        {!fixedName && (
          <View pointerEvents="none" style={tw`absolute right-3.5`} accessibilityElementsHidden importantForAccessibility="no">
            <Pencil size={16} color={C.mute} strokeWidth={2.2} />
          </View>
        )}
      </View>
      {!fixedName && saved.length > 0 && (
        <View style={tw`mt-3`}>
          <Txt style={tw`mb-2 text-[12px] font-medium text-mute`}>Your teams</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={tw`gap-2 pb-1`}>
            {saved.map((t) => (
              <Chip key={t.id} active={t.name === name} onPress={() => { setName(t.name); setNames(t.players.map((p) => p.name)); }}>
                {t.name} <Num style={tw`text-[12px] font-medium text-mute`}>· {t.players.length}</Num>
              </Chip>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
        {names.map((n) => (
          <View key={n} style={tw`flex-row min-h-10 items-center rounded-full border border-line bg-key pl-3.5 ${locked ? "pr-3.5" : ""}`}>
            <Txt style={tw`text-[13px] font-medium text-fg`}>{n}</Txt>
            {!locked && (
              <Press onPress={() => setNames(names.filter((x) => x !== n))} accessibilityLabel={`Remove ${n}`} style={tw`h-10 w-9 items-center justify-center`}>
                <X size={15} color={C.mute} strokeWidth={2} />
              </Press>
            )}
          </View>
        ))}
        {Array.from({ length: unnamed }, (_, i) => (
          <View key={i} style={tw`min-h-10 justify-center rounded-full border border-dashed border-line px-3.5`}>
            <Txt style={tw`text-[13px] text-mute`}>Player <Num style={tw`text-[12px] font-medium text-mute`}>{names.length + i + 1}</Num></Txt>
          </View>
        ))}
      </View>
      {!locked && <>
        <View style={tw`mt-3 flex-row gap-2`}>
          <Field value={v} onChangeText={setV} placeholder="Type names, comma between" maxLength={300} returnKeyType="done" submitBehavior="submit"
            onSubmitEditing={submit} accessibilityLabel={`Add players to ${name || label}`} style={tw`flex-1`} />
          <Press onPress={submit} disabled={!v.trim()} style={tw`min-h-12 flex-row gap-1 rounded-2xl border border-line bg-key px-4 items-center justify-center`}>
            <Plus size={17} color={C.fg} strokeWidth={2} />
            <Txt style={tw`text-[14px] font-semibold text-fg`}>Add</Txt>
          </Press>
        </View>
        {known.length > 0 && (
          <View style={tw`mt-3`}>
            <Txt style={tw`mb-2 text-[12px] font-medium text-mute`}>Played before, tap to add</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={tw`gap-2 pb-1`}>
              {known.map((n) => <Chip key={n} icon={Plus} onPress={() => add([n])}>{n}</Chip>)}
            </ScrollView>
          </View>
        )}
        <View style={tw`mt-4 flex-row items-center gap-3 border-t border-line pt-4`}>
          <View style={tw`flex-1`}>
            <Txt style={tw`text-[14px] font-medium text-fg`}><Num style={tw`text-[18px] text-fg`}>{size}</Num> player{size === 1 ? "" : "s"}</Txt>
            <Txt style={tw`text-[12px] text-mute`}>{unnamed ? <><Num style={tw`text-[12px] font-medium text-mute`}>{unnamed}</Num> without a name yet</> : "Everyone's named"}</Txt>
          </View>
          <Press onPress={() => setSize(Math.max(1, names.length, size - 1))} disabled={size <= Math.max(1, names.length)} accessibilityLabel="One fewer player"
            style={tw`h-11 w-11 rounded-full border border-line bg-key items-center justify-center`}>
            <Minus size={18} color={C.fg} strokeWidth={2} />
          </Press>
          <Press onPress={() => setSize(Math.min(15, size + 1))} accessibilityLabel="One more player" style={tw`h-11 w-11 rounded-full border border-line bg-key items-center justify-center`}>
            <Plus size={18} color={C.fg} strokeWidth={2} />
          </Press>
        </View>
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
      footer={<View style={tw`flex-row gap-2`}>
        <View style={tw`flex-1`}><PrimaryButton disabled={picked.length < 2} onPress={() => onFair(picked)}>Fair teams</PrimaryButton></View>
        <View style={tw`flex-1`}><PrimaryButton tone="navy" disabled={picked.length < 2} onPress={() => onSplit(picked)}>Split {picked.length} at random</PrimaryButton></View>
      </View>}>
      <View style={tw`mb-3 flex-row items-center justify-between`}>
        <Txt style={tw`text-[13px] text-mute`}><Num style={tw`text-[13px] font-medium text-teal`}>{picked.length}</Num> picked</Txt>
        <Press onPress={() => setOn(new Set(picked.length === names.length ? [] : names.map((n) => n.toLowerCase())))} style={tw`min-h-10 justify-center`}>
          <Txt style={tw`text-[13px] font-medium text-sun`}>{picked.length === names.length ? "Clear all" : "Pick all"}</Txt>
        </Press>
      </View>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {names.map((n) => {
          const sel = on.has(n.toLowerCase());
          return (
            <Press key={n} onPress={() => flip(n)} accessibilityRole="checkbox" accessibilityState={{ checked: sel }}
              style={tw`min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5 ${sel ? "border-sun bg-sun-soft" : "border-line bg-key"}`}>
              {sel && <Check size={15} color={C.sun} strokeWidth={2.4} />}
              <Txt style={tw`text-[13px] font-medium ${sel ? "text-sun" : "text-fg"}`}>{n}</Txt>
            </Press>
          );
        })}
      </View>
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
  const submit = () => { add(splitNames(v)); setV(""); };
  return (
    <Card>
      <Txt style={tw`text-[17px] font-semibold text-fg`}>Who's playing?</Txt>
      <Txt style={tw`mt-0.5 text-[13px] text-mute`}>Everyone bats on their own. Most runs wins.</Txt>
      {saved.length > 0 && (
        <View style={tw`mt-3`}>
          <Txt style={tw`mb-2 text-[12px] font-medium text-mute`}>Your teams, tap to add everyone</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={tw`gap-2 pb-1`}>
            {saved.map((t) => (
              <Chip key={t.id} icon={Plus} onPress={() => add(t.players.map((p) => p.name))}>
                {t.name} <Num style={tw`text-[12px] font-medium text-mute`}>· {t.players.length}</Num>
              </Chip>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
        {names.map((n) => (
          <View key={n} style={tw`flex-row min-h-10 items-center rounded-full border border-line bg-key pl-3.5`}>
            <Txt style={tw`text-[13px] font-medium text-fg`}>{n}</Txt>
            <Press onPress={() => setNames(names.filter((x) => x !== n))} accessibilityLabel={`Remove ${n}`} style={tw`h-10 w-9 items-center justify-center`}>
              <X size={15} color={C.mute} strokeWidth={2} />
            </Press>
          </View>
        ))}
        {names.length < 2 && Array.from({ length: 2 - names.length }, (_, i) => (
          <View key={i} style={tw`min-h-10 justify-center rounded-full border border-dashed border-line px-3.5`}>
            <Txt style={tw`text-[13px] text-mute`}>Player <Num style={tw`text-[12px] font-medium text-mute`}>{names.length + i + 1}</Num></Txt>
          </View>
        ))}
      </View>
      <View style={tw`mt-3 flex-row gap-2`}>
        <Field value={v} onChangeText={setV} placeholder="Type names, comma between" maxLength={300} returnKeyType="done" submitBehavior="submit"
          onSubmitEditing={submit} accessibilityLabel="Add players" style={tw`flex-1`} />
        <Press onPress={submit} disabled={!v.trim()} style={tw`min-h-12 flex-row gap-1 rounded-2xl border border-line bg-key px-4 items-center justify-center`}>
          <Plus size={17} color={C.fg} strokeWidth={2} />
          <Txt style={tw`text-[14px] font-semibold text-fg`}>Add</Txt>
        </Press>
      </View>
      {known.length > 0 && (
        <View style={tw`mt-3`}>
          <Txt style={tw`mb-2 text-[12px] font-medium text-mute`}>Played before, tap to add</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={tw`gap-2 pb-1`}>
            {known.map((n) => <Chip key={n} icon={Plus} onPress={() => add([n])}>{n}</Chip>)}
          </ScrollView>
        </View>
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
    <View>
      <SectionTitle action={names.length >= 2 ? (
        <Press onPress={shuffle} style={tw`min-h-9 flex-row items-center gap-1.5 rounded-full border border-line bg-panel px-3`}>
          <Shuffle size={14} color={C.teal} strokeWidth={2} />
          <Txt style={tw`text-[13px] font-medium text-fg`}>Shuffle</Txt>
        </Press>
      ) : undefined}>Who bats first</SectionTitle>
      <Card style={tw`px-4 py-1`}>
        {names.length ? names.map((n, i) => (
          <View key={n} style={tw`min-h-12 flex-row items-center gap-3 py-1.5 ${i ? "border-t border-line" : ""}`}>
            <Num style={tw`w-6 text-[14px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
            <Txt style={tw`flex-1 text-[15px] ${i === 0 ? "font-semibold text-fg" : "text-fg"}`} numberOfLines={1}>{n}</Txt>
            {i > 0 && (
              <Press onPress={() => up(i)} accessibilityLabel={`Move ${n} up`} style={tw`h-9 w-9 rounded-full border border-line bg-key items-center justify-center`}>
                <ArrowUp size={16} color={C.teal} strokeWidth={2} />
              </Press>
            )}
          </View>
        )) : <Txt style={tw`py-3 text-[13px] text-mute`}>Add players and they line up here in batting order.</Txt>}
      </Card>
    </View>
  );
}

/** The web's coin-flip keyframes: rises 110px while spinning, then lands, over 1.3s. */
function Coin({ flipping, face }: { flipping: boolean; face: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!flipping) return;
    t.setValue(0);
    const ease = Easing.bezier(0.3, 0.7, 0.4, 1);
    const anim = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 585, easing: ease, useNativeDriver: true }),
      Animated.timing(t, { toValue: 2, duration: 715, easing: ease, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [flipping, t]);
  const translateY = t.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -110, 0] });
  const rotateX = t.interpolate({ inputRange: [0, 1, 2], outputRange: ["0deg", "1260deg", "2160deg"] });
  return (
    <Animated.View style={[tw`self-center my-2 h-28 w-28 rounded-full`,
      { shadowColor: C.sun, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
      { transform: [{ perspective: 800 }, { translateY }, { rotateX }] }]}>
      <LinearGradient colors={["#24242d", "#17171f", "#121514"]} locations={[0, 0.55, 1]} start={{ x: 0.25, y: 0.2 }} end={{ x: 0.9, y: 1 }}
        style={tw`h-28 w-28 rounded-full items-center justify-center border-2 border-sun`}>
        <Num style={tw`text-[20px] text-sun`}>{face && face[0] + face.slice(1).toLowerCase()}</Num>
      </LinearGradient>
    </Animated.View>
  );
}

const sameList = (x: string[], y: string[]) => x.length === y.length && x.every((n, i) => n.toLowerCase() === y[i].toLowerCase());

/** Named players plus the "Player n" placeholders the team will be padded with, in batting order. */
const padded = (names: string[], size: number) => [...names, ...Array.from({ length: Math.max(0, size - names.length) }, (_, i) => `Player ${names.length + i + 1}`)];

interface Fair { pool: string[]; common: string | null; seed: number; split: FairSplit }

const SmallButton = ({ onPress, icon: I, children }: { onPress: () => void; icon: LucideIcon; children: string }) => (
  <Press onPress={onPress} style={tw`min-h-10 flex-row items-center gap-1.5 rounded-full border border-line bg-panel px-3.5`}>
    <I size={15} color={C.teal} strokeWidth={2} />
    <Txt style={tw`text-[13px] font-medium text-fg`}>{children}</Txt>
  </Press>
);

export default function Setup() {
  const { go, add, put, fixture, cups, teams, matches, saveTeam, lastSetup, seriesPlay, series: allSeries } = useStore();
  const bottom = useSafeAreaInsets().bottom;
  // Android back skips the header's back button, so a cup fixture or series pick must not outlive this screen.
  useEffect(() => () => { useStore.setState({ fixture: null, seriesPlay: null }); }, []);
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
    setRules(nextRules(series, matches));
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
    <Page scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 144 }} keyboardShouldPersistTaps="handled">
        <Header title={cup ? cup.name : series ? series.name : "New match"} back={() => { useStore.setState({ fixture: null, seriesPlay: null }); go(cup ? "cup" : series ? "series" : "home"); }} />
        <View style={tw`gap-3 px-4 pt-4`}>
          {!cup && !series && (
            <Press onPress={quickMatch} accessibilityLabel="Quick match" style={tw`flex-row items-center gap-3 rounded-[18px] border border-line bg-panel px-4 py-3`}>
              <View style={tw`h-10 w-10 rounded-full bg-sun-soft items-center justify-center`}><Zap size={18} color={C.sun} strokeWidth={2.2} /></View>
              <View style={tw`flex-1`}>
                <Txt style={tw`text-[15px] font-semibold text-fg`}>Quick match</Txt>
                <Txt style={tw`text-[12px] leading-4 text-mute`}>Team A vs Team B, Player 1, 2, 3... {lastSetup ? "Your last rules" : "Standard rules"}. Straight to the first ball.</Txt>
              </View>
              <ArrowRight size={18} color={C.teal} strokeWidth={2} />
            </Press>
          )}
          {last && (
            <View style={tw`flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-1.5`}>
              <Txt style={tw`flex-1 text-[13px] text-teal`}>Filled in from your last match</Txt>
              <Press onPress={clear} style={tw`min-h-10 justify-center`}><Txt style={tw`text-[13px] font-semibold text-fg`}>Start fresh</Txt></Press>
            </View>
          )}
          {series && seriesNo && (
            <View style={tw`rounded-2xl border border-line bg-panel px-4 py-3`}>
              <Txt style={tw`text-[14px] font-semibold text-fg`}>Match <Num style={tw`text-[13px]`}>{seriesNo.played + 1}</Num>{planned(series) ? <> of <Num style={tw`text-[13px]`}>{planned(series)}</Num></> : ""}</Txt>
              <Txt style={tw`mt-0.5 text-[13px] text-teal`}>{seriesNo.text([a, b])}. Teams are filled in from the series. Overs and rules start as last match and can be changed.</Txt>
            </View>
          )}
          {!cup && !series && <PresetRow rules={rules} mode={mode} test={test} onPick={pick} />}
          {!cup && !series && <Segmented<Mode> value={mode} set={(v) => setRules(withMode(rules, v, v === "teams" && test))}
            items={[{ v: "teams", label: "Teams" }, { v: "pairs", label: "Pairs" }, { v: "solo", label: "Solo" }, { v: "french", label: "French" }]} />}
          {solo ? (
            <SoloPlayers names={soloNames} setNames={setSoloNames} known={known} />
          ) : <>
          <TeamCard label="Team A" name={a} setName={setA} names={na} setNames={setNa} size={sa} setSize={setSa} locked={!!cup} lockName={!!series} other={b} known={known} />
          <View style={tw`flex-row flex-wrap items-center justify-center gap-3`}>
            <Txt style={tw`text-[13px] font-medium text-mute`}>vs</Txt>
            {!cup && !series && na.length + nb.length >= 2 && <>
              <SmallButton icon={Shuffle} onPress={() => shuffle()}>Shuffle teams</SmallButton>
              <SmallButton icon={Scale} onPress={() => fairSplit([...na, ...nb], common.trim() || null, 0)}>Fair teams</SmallButton>
            </>}
          </View>
          {fairShown && <FairStrip a={a || "Team A"} b={b || "Team B"} ratingA={fairShown.split.ratingA} ratingB={fairShown.split.ratingB}
            onReshuffle={() => fairSplit(fairShown.pool, fairShown.common, fairShown.seed + 1)} />}
          {!cup && !series && pool.length >= 2 && (
            <Press onPress={() => setPicking(true)} style={tw`min-h-12 w-full flex-row gap-2 items-center justify-center rounded-2xl border border-dashed border-line bg-panel px-4`}>
              <Users size={17} color={C.teal} strokeWidth={2} />
              <Txt style={tw`text-[14px] font-medium text-fg`}>Pick today's players from <Num style={tw`text-[13px]`}>{pool.length}</Num> saved</Txt>
            </Press>
          )}
          <TeamCard label="Team B" name={b} setName={setB} names={nb} setNames={setNb} size={sb} setSize={setSb} locked={!!cup} lockName={!!series} other={a} known={known} />
          {mode === "pairs" && <>
            <PairsCard team={a || "Team A"} names={padded(na, sa)} common={common} setNames={setNa} />
            <PairsCard team={b || "Team B"} names={padded(nb, sb)} common={common} setNames={setNb} />
          </>}
          </>}

          {!cup && mode === "teams" && <View style={tw`mt-2`}><Segmented value={test ? "test" : "limited"} set={(v) => setRules(withMode(rules, "teams", v === "test"))}
            items={[{ v: "limited", label: "Limited overs" }, { v: "test", label: "Test match" }]} /></View>}

          <OversCard key={`${mode}-${test}`} rules={rules} setRules={setRules} mode={mode} test={test}
            pairsCount={Math.max(1, Math.ceil((Math.max(sa, sb) + (common.trim() ? 1 : 0)) / 2))} />

          <View>
            <SectionTitle action={<GlossaryLink />}>Gully rules</SectionTitle>
            <Card style={tw`p-0 overflow-hidden`}>
              <Press onPress={() => setShowRules(!showRules)} accessibilityLabel="Gully rules" accessibilityState={{ expanded: showRules }}
                style={tw`min-h-14 flex-row w-full items-center gap-3 px-4 py-3.5`}>
                <Txt style={tw`flex-1 text-[13px] leading-5 text-teal`}>{on || "Standard cricket"}</Txt>
                <View style={[tw`h-9 w-9 rounded-full border border-line bg-key items-center justify-center`, { transform: [{ rotate: showRules ? "180deg" : "0deg" }] }]}>
                  <ChevronDown size={18} color={C.teal} strokeWidth={2} />
                </View>
              </Press>
              {showRules && (
                <View style={tw`border-t border-line`}>
                  <RulesEditor rules={rules} setRules={setRules} mode={mode} test={test} common={common} setCommon={setCommon}
                    names={protNames} prot={prot} setProt={setProt} />
                </View>
              )}
            </Card>
          </View>
          {mode === "solo" && <BattingOrder names={soloNames} setNames={setSoloNames} />}
          {mode === "french" && <FrenchFirst names={soloNames} first={first} setFirst={setFrenchFirst} />}
          {!cup && !series && !test && !solo && <ChaseCard on={chaseOn} setOn={setChaseOn} side={chaseSide} setSide={setChaseSide} target={target} setTarget={setTarget}
            down={down} setDown={setDown} a={a} b={b} maxDown={Math.max(0, (chaseSide === 0 ? sb : sa) - 1)} />}
          <RulesCardView lines={card} extra={chaseLine} />
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={[tw`absolute left-0 right-0 bottom-0 px-4 pt-8`, { paddingBottom: Math.max(16, bottom) }]}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,5,7,0)", C.cream, C.cream]} locations={[0, 0.4, 1]} style={tw`absolute inset-0`} />
        {mode === "solo" ? (
          <PrimaryButton disabled={soloNames.length < 2} onPress={beginSolo}>
            {soloNames.length < 2 ? "Add at least 2 players" : `Start, ${soloNames[0]} bats first`}
          </PrimaryButton>
        ) : mode === "french" ? (
          <PrimaryButton disabled={soloNames.length < 2} onPress={beginFrench}>
            {soloNames.length < 2 ? "Add at least 2 players" : `Start, ${first} bats first`}
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={!chaseReady} onPress={chasing ? beginChase : () => setTossOpen(true)}>
            <View style={tw`flex-row items-center gap-2`}>
              <Txt style={tw`text-[16px] font-semibold text-ink`}>{!chaseReady ? "Enter the target" : chasing ? "Agree rules, start the chase" : "Agree rules, next: toss"}</Txt>
              {chaseReady && <ArrowRight size={20} color={C.ink} strokeWidth={2.4} />}
            </View>
          </PrimaryButton>
        )}
      </View>

      {tossOpen && (
        <Sheet title="Toss" onClose={() => { if (!flipping) { setTossOpen(false); setToss(null); } }}>
          <View style={tw`items-center`}>
            <View style={tw`w-full items-center pt-10 pb-6`}>
              {/* Not Glow: its overflow clip would cut the coin off mid-flip. */}
              <LinearGradient pointerEvents="none" colors={["rgba(255,138,61,0.10)", "rgba(255,138,61,0)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
              <Coin flipping={flipping} face={flipping ? "" : toss?.face ?? "TOSS"} />
              {toss ? (
                <Txt style={tw`mt-5 px-4 text-center text-[20px] font-semibold text-fg`}>{(toss.winner === 0 ? a : b) || "Team"} won the toss</Txt>
              ) : null}
            </View>
            {toss ? (
              <View style={tw`mt-4 w-full`}>
                <View style={tw`flex-row gap-2`}>
                  <View style={tw`flex-1`}><PrimaryButton onPress={() => begin({ winner: toss.winner, choice: "bat" })}>Bat first</PrimaryButton></View>
                  <View style={tw`flex-1`}><PrimaryButton tone="navy" onPress={() => begin({ winner: toss.winner, choice: "bowl" })}>Bowl first</PrimaryButton></View>
                </View>
              </View>
            ) : <View style={tw`mt-4 w-full`}><PrimaryButton disabled={flipping} onPress={flip}>Flip the coin</PrimaryButton></View>}
            <Press onPress={() => begin(null)} style={tw`mt-2 min-h-12 w-full items-center justify-center rounded-2xl`}>
              <Txt style={tw`text-[14px] font-medium text-mute`}>Skip toss, {a || "Team A"} bats first</Txt>
            </Press>
          </View>
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
    </Page>
  );
}
