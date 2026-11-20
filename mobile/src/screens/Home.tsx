import { useRef, useState } from "react";
import { Animated, Linking, PanResponder, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, ChevronRight, Plus, Radio, Wallet, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { matchTotals } from "@shared/stats";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { seriesScore } from "@shared/engine/series";
import { cleanCode, liveSupported } from "@/lib/live";
import { useStore } from "@/lib/store";
import { cardStatus } from "@shared/cardStatus";
import { tipLink } from "@shared/upi";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { AdBanner } from "@/ui/AdBanner";
import { TapeBall } from "@/ui/gully";
import { showIntro } from "@/ui/Onboarding";
import { GettingStarted } from "@/ui/guide";
import { demoMatch } from "@/lib/demo";
import { Badge, C, Card, LivePill, Num, ConfirmSheet, Page, Press, PrimaryButton, SectionTitle, Sheet, Txt, tw } from "@/ui/ui";
import { AccountButton } from "./accountUi";
import { seriesNames, SeriesNext } from "./Series";
import { NextGameCard } from "./nextGameUi";

const lbl = [tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }];
/** One match row for live and finished matches alike, laid out like a score app: header, two team lines, a status line. */
export function MatchCard({ m, onLongPress }: { m: Match; onLongPress?: () => void }) {
  const { go } = useStore();
  const { text: status, live } = cardStatus(m), res = E.result(m);
  const idx = m.innings.length - 1, batting = live && idx >= 0 && !E.isSolo(m) && !E.isTest(m) ? m.innings[idx].bat : null;
  const score = (side: 0 | 1) => {
    if (E.isTest(m)) return { main: E.sideScore(m, side) ?? "Yet to bat", ov: "" };
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return { main: "Yet to bat", ov: "" };
    const st = E.replay(m, i);
    return { main: `${st.runs}/${st.wickets}`, ov: ` (${E.oversText(st.legal)})` };
  };
  const meta = `${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${E.formatText(m)}`;
  return (
    <Press onPress={() => go(live ? "live" : m.status === "done" ? "result" : "home", m.id)} onLongPress={onLongPress} style={tw`w-full`}>
      <Card style={tw`py-3`}>
        <View style={tw`mb-1.5 flex-row items-center justify-between`}>
          <Num style={[lbl, tw`font-medium`]} numberOfLines={1}>{meta}</Num>
          {live ? <LivePill /> : <Txt style={tw`text-[11px] font-semibold text-mute`}>Result</Txt>}
        </View>
        {([0, 1] as const).map((s) => {
          const strong = batting === s || res?.winner === s, sc = score(s);
          return (
            <View key={s} style={tw`flex-row items-center gap-3 py-1`}>
              <Badge name={m.teams[s].name} size={28} kind="team" />
              <Txt style={tw`flex-1 text-[15px] ${strong ? "font-semibold text-fg" : "font-medium text-teal"}`} numberOfLines={1}>{m.teams[s].name}</Txt>
              <Txt style={tw`text-[15px] ${strong ? "font-bold text-fg" : "font-medium text-teal"}`}>{sc.main}<Txt style={tw`text-[12px] font-normal text-mute`}>{sc.ov}</Txt></Txt>
            </View>
          );
        })}
        {!!status && <Txt style={tw`mt-1.5 text-[13px] font-medium ${live ? "text-sun" : "text-fg"}`} numberOfLines={2}>{status}</Txt>}
      </Card>
    </Press>
  );
}

/** A live match you can remove: long-press it, or drag it sideways like a mail row. Both ask before deleting. */
function LiveRow({ m }: { m: Match }) {
  const { remove } = useStore();
  const x = useRef(new Animated.Value(0)).current;
  const [ask, setAsk] = useState(false);
  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => x.setValue(g.dx),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 110) setAsk(true); back(); },
    onPanResponderTerminate: back,
  })).current;
  const names = `${m.teams[0].name} v ${m.teams[1].name}`;
  return (
    <View>
      <View style={[tw`absolute inset-0 rounded-[24px] items-center justify-center bg-out`]} pointerEvents="none"><Txt style={tw`font-semibold text-ink`}>Delete</Txt></View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <MatchCard m={m} onLongPress={() => setAsk(true)} />
      </Animated.View>
      {ask && <ConfirmSheet title="Delete this match?" body={`${names} will be removed from this phone. This can't be undone.`} yes="Delete" danger
        onYes={() => { track(EV.match_delete, { how: "live_row" }); remove(m.id); }} onClose={() => setAsk(false)} />}
    </View>
  );
}

export default function Home() {
  const { matches, go, watchMatch, series, me, openPlayer, setMe } = useStore();
  const tip = tipLink(process.env.EXPO_PUBLIC_TIP_UPI, "Sahil Chalke");
  const top = useSafeAreaInsets().top;
  const going = series.filter((s) => { const sc = seriesScore(s, matches); return sc.current || sc.next !== null; }).slice(0, 2);
  const [ask, setAsk] = useState(false);
  const [code, setCode] = useState("");
  const [focus, setFocus] = useState(false);
  const live = matches.filter((m) => m.status === "live" || m.status === "break");
  const done = matches.filter((m) => m.status === "done").slice(0, 3);
  const sums = matchTotals(matches);
  const stats: [string, number][] = [["Matches", matches.length], ["Runs", sums.runs], ["Sixes", sums.sixes], ["Wickets", sums.wickets]];
  const submit = () => { if (code.length === 6) { setAsk(false); watchMatch(code); } };
  const now = new Date();
  const weekday = now.toLocaleDateString("en-IN", { weekday: "long" });
  const day = now.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <Page tabs>
      <View style={[tw`px-5`, { paddingTop: Math.max(22, top + 10) }]}>
        <View style={tw`flex-row items-start justify-between gap-3`}>
          <View style={tw`flex-1`}>
            <Txt style={lbl}>Gully scorer · {weekday} <Num style={[lbl, tw`font-medium`]}>{day}</Num></Txt>
            <Txt accessibilityRole="header" style={[tw`mt-1 text-[24px] font-semibold text-fg`, { lineHeight: 30, letterSpacing: -0.3 }]}>
              Score every ball.{"\n"}<Txt style={tw`text-teal`}>No login needed.</Txt>
            </Txt>
          </View>
          <AccountButton />
        </View>
        {matches.length > 0 && (
          <View style={tw`mt-4 flex-row gap-2`}>
            {stats.map(([k, v]) => (
              <View key={k} style={tw`flex-1 rounded-2xl border border-line bg-panel px-1 py-2.5 items-center`}>
                <Num style={tw`text-[18px] text-fg`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
                <Txt style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{k}</Txt>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={tw`gap-3 px-4 pt-4`}>
        <View style={tw`flex-row gap-2.5`}>
          <Press onPress={() => go("setup")} accessibilityLabel="Start new match" style={[{ flex: 1.4, borderRadius: 20, shadowColor: C.sun, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10 }]}>
            <LinearGradient colors={["#ffb070", C.sun, C.ember]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }}
              style={[tw`h-[104px] overflow-hidden rounded-[20px] p-3.5 justify-between`, { borderWidth: 1, borderColor: "#ffd2ad" }]}>
              <LinearGradient colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.08)"]} pointerEvents="none"
                style={[tw`absolute left-0 right-0 top-0 h-[46px]`, { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 60, borderBottomRightRadius: 60 }]} />
              <View pointerEvents="none" style={[tw`absolute`, { right: -20, bottom: -26, opacity: 0.85, transform: [{ rotate: "-18deg" }] }]}><TapeBall size={76} tone="ink" /></View>
              <View style={[tw`h-8 w-8 rounded-full items-center justify-center`, { backgroundColor: "rgba(17,17,17,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" }]}><Plus size={18} color={C.ink} strokeWidth={2.6} /></View>
              <Txt style={[tw`text-[16px] font-bold text-ink`, { lineHeight: 20, paddingRight: 34 }]} numberOfLines={2}>Start new match</Txt>
            </LinearGradient>
          </Press>
          {liveSupported && (
            <Press onPress={() => setAsk(true)} style={tw`h-[104px] flex-1 justify-between rounded-[20px] border border-line bg-panel p-3.5`}>
              <Radio size={20} color={C.sun} strokeWidth={2} />
              <Txt style={tw`text-[14px] font-semibold text-fg`} numberOfLines={2}>Watch a live match</Txt>
            </Press>
          )}
        </View>
        {live.length > 0 && <View style={tw`pt-3`}><SectionTitle>Live now</SectionTitle></View>}
        {live.map((m) => <LiveRow key={m.id} m={m} />)}
        {done.length > 0 && (
          <View style={tw`pt-3`}>
            <SectionTitle action={
              <Press onPress={() => go("history")} accessibilityRole="link" accessibilityLabel="See all matches" hitSlop={12} haptic={false}>
                <Txt style={tw`text-[13px] font-semibold text-sun`}>See all</Txt>
              </Press>
            }>Recent matches</SectionTitle>
          </View>
        )}
        {done.map((m) => <MatchCard key={m.id} m={m} />)}
        {!matches.length && (
          <Card style={tw`items-center py-7`}>
            <View style={tw`h-12 w-12 rounded-full border border-line bg-key items-center justify-center`}>
              <TapeBall size={22} tone="mute" />
            </View>
            <Txt style={tw`mt-3 text-[17px] font-semibold text-fg`}>No matches yet</Txt>
            <Txt style={tw`mt-1 text-center text-[13px] text-mute`}>Set one up in 30 seconds.</Txt>
            <Press onPress={() => { const m = demoMatch(); useStore.getState().add(m); go("live", m.id); }} accessibilityLabel="Try a demo match" style={tw`mt-4 rounded-full border border-sun px-5 py-2.5`}>
              <Txt style={tw`text-[14px] font-semibold text-sun`}>Try a demo match</Txt>
            </Press>
          </Card>
        )}
        <View style={tw`flex-row gap-2.5`}>
          {([["book", BookOpen, "Gully Book", "Records and bragging rights"], ["kitty", Wallet, "Kitty", "Who paid for the ball"]] as const).map(([s, I, title, sub]) => (
            <Press key={s} onPress={() => go(s)} style={tw`flex-1 gap-2 rounded-[20px] border border-line bg-panel p-4`}>
              <I size={20} color={C.teal} strokeWidth={2} />
              <View>
                <Txt style={tw`text-[14px] font-semibold text-fg`}>{title}</Txt>
                <Txt style={tw`text-[12px] text-mute`} numberOfLines={1}>{sub}</Txt>
              </View>
            </Press>
          ))}
        </View>
        {!!me && (
          <View style={tw`flex-row items-center gap-3 rounded-[20px] border border-line bg-panel p-3 pl-4`}>
            <Badge name={me} size={40} />
            <View style={tw`flex-1 min-w-0`}>
              <Txt style={tw`text-[15px] font-semibold text-fg`} numberOfLines={1}>{me}</Txt>
              <Txt style={tw`text-[12px] text-mute`}>Your stats and skill card</Txt>
            </View>
            <Press onPress={() => openPlayer(me)} style={tw`min-h-10 rounded-full bg-sun px-4 items-center justify-center`}><Txt style={tw`text-[13px] font-semibold text-ink`}>My stats</Txt></Press>
            <Press onPress={() => setMe(null)} accessibilityLabel="Not me" style={tw`min-h-10 px-2 items-center justify-center`}><X size={16} color={C.mute} strokeWidth={2.2} /></Press>
          </View>
        )}
        <NextGameCard />
        {going.map((s) => (
          <Card key={s.id} style={tw`p-3`}>
            <Press onPress={() => { useStore.setState({ seriesId: s.id }); go("series"); }} style={tw`mb-2 min-h-10 flex-row w-full items-center justify-between px-1`}>
              <Txt style={tw`flex-1 text-[14px] font-semibold text-fg`} numberOfLines={1}>{s.name}</Txt>
              <Txt style={tw`pl-2 text-[13px] text-mute`}>{seriesScore(s, matches).text(seriesNames(s))}</Txt>
              <ChevronRight size={18} color={C.mute} strokeWidth={2} />
            </Press>
            <SeriesNext s={s} matches={matches} />
          </Card>
        ))}
        <GettingStarted />
        {!!tip && (
          <Press onPress={() => { track(EV.tip_open); void Linking.openURL(tip).catch(() => {}); }} style={tw`rounded-[20px] border border-line bg-panel p-4 items-center`}>
            <Txt style={tw`text-[14px] font-medium text-fg`}>Enjoying the app? Tip the developer</Txt>
          </Press>
        )}
        <Press onPress={showIntro} accessibilityLabel="How it works" style={tw`self-center py-2`}>
          <Txt style={tw`text-[13px] font-medium text-mute`}>How it works</Txt>
        </Press>
        <AdBanner />
      </View>
      {ask && (
        <Sheet title="Watch a live match" onClose={() => setAsk(false)}>
          <Txt style={tw`text-[13px] text-mute`}>Ask the scorer for the 6-letter code on their screen.</Txt>
          <View style={tw`mt-3 gap-3`}>
            <TextInput value={code} onChangeText={(t) => { const c = cleanCode(t); setCode(c); if (c.length === 6) { setAsk(false); watchMatch(c); } }} placeholder="ABC123" autoFocus textAlignVertical="center" autoCapitalize="characters" autoCorrect={false}
              placeholderTextColor={C.mute} selectionColor={C.sun} accessibilityLabel="Match code" returnKeyType="go" onSubmitEditing={submit}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              style={[tw`min-h-16 w-full rounded-2xl border ${focus ? "border-sun" : "border-line"} bg-panel px-4 text-center text-[28px] text-fg`,
                { fontFamily: "Poppins_700Bold", letterSpacing: 8 }]} />
            <PrimaryButton disabled={code.length !== 6} onPress={submit}>Watch</PrimaryButton>
          </View>
        </Sheet>
      )}
    </Page>
  );
}
