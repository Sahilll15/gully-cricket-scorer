import { useState } from "react";
import { TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, ChevronRight, Radio, Wallet } from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { matchTotals } from "@shared/stats";
import { seriesScore } from "@shared/engine/series";
import { cleanCode, liveSupported } from "@/lib/live";
import { useStore } from "@/lib/store";
import { AdBanner } from "@/ui/AdBanner";
import { TapeBall } from "@/ui/gully";
import { Badge, Board, C, Card, LivePill, Num, Page, Press, PrimaryButton, RunWorm, ScoreHero, SectionTitle, Sheet, Txt, tw } from "@/ui/ui";
import { AccountButton, BackupCard } from "./accountUi";
import { seriesNames, SeriesNext } from "./Series";
import { NextGameCard } from "./nextGameUi";

const lbl = [tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }];
const WORM_MAX = 12;

/** Runs per over of the innings being played, padded with empty overs still to come, last 12 at most. */
function worm(m: Match, idx: number) {
  const st = E.replay(m, idx), inn = m.innings[idx];
  const runs = st.overs.map((o) => o.reduce((s, b) => s + E.ballTotal(b, m.rules), 0));
  const cur = Math.floor(st.legal / 6);
  const current = cur < runs.length && !st.ended ? cur : undefined;
  if (!E.isTest(m) && inn.overs <= WORM_MAX) while (runs.length < inn.overs) runs.push(0);
  const cut = Math.max(0, runs.length - WORM_MAX);
  return { st, overs: runs.slice(cut), current: current === undefined ? undefined : current - cut };
}

export function MatchCard({ m }: { m: Match }) {
  const { go } = useStore();
  const res = E.result(m), live = m.status === "live" || m.status === "break";
  const line = (side: 0 | 1) => {
    if (E.isTest(m)) return E.sideScore(m, side) ?? "Yet to bat";
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return "Yet to bat";
    const st = E.replay(m, i);
    return `${st.runs}/${st.wickets} (${E.oversText(st.legal)})`;
  };
  const meta = `${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${E.formatText(m)}`;
  const foot = res ? res.text : live ? "Tap to keep scoring" : "";
  const idx = m.innings.length - 1;

  if (live && idx >= 0) {
    const bat = m.innings[idx].bat, other = bat === 0 ? 1 : 0;
    const { st, overs, current } = worm(m, idx);
    return (
      <Press onPress={() => go("live", m.id)} style={tw`w-full`}>
        <ScoreHero wall>
          <View style={tw`flex-row items-center justify-between`}>
            <LivePill />
            <Num style={[lbl, tw`font-medium`]}>{meta}</Num>
          </View>
          <View style={tw`mt-3 flex-row items-end justify-between gap-3`}>
            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Txt style={tw`text-[13px] text-teal`} numberOfLines={1}>{m.teams[bat].name}</Txt>
                {E.isTest(m) && <Num style={tw`text-[12px] font-medium text-mute`}>{line(bat)}</Num>}
              </View>
              <Board style={{ fontSize: 46, lineHeight: 50 }} numberOfLines={1} adjustsFontSizeToFit>{`${st.runs}/${st.wickets}`}</Board>
            </View>
            <View style={tw`items-end pb-1`}>
              <Num style={tw`text-[13px] font-medium`}>{E.oversText(st.legal)} ov</Num>
              <View style={tw`mt-1 flex-row items-center gap-1`}>
                <Txt style={lbl}>CRR</Txt>
                <Num style={tw`text-[12px] font-medium text-teal`}>{E.runRate(st.runs, st.legal).toFixed(2)}</Num>
              </View>
            </View>
          </View>
          <View style={tw`mt-3.5`}><RunWorm overs={overs} current={current} /></View>
          <View style={tw`mt-1.5 flex-row items-center justify-between gap-3`}>
            <Txt style={lbl}>Runs per over</Txt>
            <View style={tw`flex-row flex-1 items-center justify-end gap-1.5`}>
              <Txt style={lbl} numberOfLines={1}>{m.teams[other].name}</Txt>
              <Num style={tw`text-[12px] font-medium text-teal`}>{line(other)}</Num>
            </View>
          </View>
          <View style={tw`mt-3 flex-row items-center justify-between border-t border-line pt-3`}>
            <Txt style={tw`flex-1 text-[13px] font-medium text-fg`}>{foot}</Txt>
            <ChevronRight size={18} color={C.mute} strokeWidth={2} />
          </View>
        </ScoreHero>
      </Press>
    );
  }

  return (
    <Press onPress={() => go(live ? "live" : m.status === "done" ? "result" : "home", m.id)} style={tw`w-full`}>
      <Card>
        <View style={tw`mb-2 flex-row items-center justify-between`}>
          <Num style={[lbl, tw`font-medium`]}>{meta}</Num>
          {live ? <LivePill /> : <View style={tw`rounded-full border border-line px-2.5 py-1`}><Txt style={tw`text-[11px] font-medium text-teal`}>Completed</Txt></View>}
        </View>
        {([0, 1] as const).map((s) => {
          const lead = res?.winner === s;
          return (
            <View key={s} style={tw`flex-row items-center gap-3 py-1.5`}>
              <Badge name={m.teams[s].name} size={30} />
              <Txt style={tw`flex-1 text-[15px] ${lead ? "font-semibold text-fg" : "font-medium text-teal"}`} numberOfLines={1}>{m.teams[s].name}</Txt>
              <Num style={tw`text-[16px] ${lead ? "text-fg" : "text-teal"}`}>{line(s)}</Num>
            </View>
          );
        })}
        {!!foot && <Txt style={tw`mt-2 border-t border-line pt-2.5 text-[13px] font-medium text-fg`}>{foot}</Txt>}
      </Card>
    </Press>
  );
}

export default function Home() {
  const { matches, go, watchMatch, series } = useStore();
  const top = useSafeAreaInsets().top;
  const going = series.filter((s) => { const sc = seriesScore(s, matches); return sc.current || sc.next !== null; }).slice(0, 2);
  const [ask, setAsk] = useState(false);
  const [code, setCode] = useState("");
  const [focus, setFocus] = useState(false);
  const live = matches.filter((m) => m.status === "live" || m.status === "break");
  const done = matches.filter((m) => m.status === "done").slice(0, 3);
  const sums = matchTotals(matches);
  const total = (k: "runs" | "sixes" | "wickets") => sums[k];
  const submit = () => { if (code.length === 6) { setAsk(false); watchMatch(code); } };
  const stats: [string, number][] = [["Matches", matches.length], ["Runs", total("runs")], ["Sixes", total("sixes")], ["Wickets", total("wickets")]];
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
        <Txt style={tw`mt-2 text-[13px] text-mute`}>Tap or just say it: "four", "wide", "out".</Txt>
        <View style={tw`mt-4 flex-row gap-2`}>
          {stats.map(([k, v]) => (
            <View key={k} style={tw`flex-1 rounded-2xl border border-line bg-panel px-1 py-2.5 items-center`}>
              <Num style={tw`text-[18px] text-fg`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
              <Txt style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{k}</Txt>
            </View>
          ))}
        </View>
      </View>
      <View style={tw`gap-3 px-4 pt-4`}>
        <View style={tw`flex-row gap-2.5`}>
          <Press onPress={() => go("setup")} style={[tw`h-[92px] justify-between rounded-[20px] bg-sun p-4`, { flex: 1.4 }]}>
            <TapeBall size={24} tone="ink" />
            <Txt style={tw`text-[15px] font-semibold text-ink`}>Start new match</Txt>
          </Press>
          {liveSupported && (
            <Press onPress={() => setAsk(true)} style={tw`h-[92px] flex-1 justify-between rounded-[20px] border border-line bg-panel p-4`}>
              <Radio size={20} color={C.sun} strokeWidth={2} />
              <Txt style={tw`text-[14px] font-semibold text-fg`} numberOfLines={2}>Watch a live match</Txt>
            </Press>
          )}
        </View>
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
        {matches.length > 0 && <BackupCard />}
        {live.length > 0 && <View style={tw`pt-3`}><SectionTitle>Live now</SectionTitle></View>}
        {live.map((m) => <MatchCard key={m.id} m={m} />)}
        {done.length > 0 && <View style={tw`pt-3`}><SectionTitle>Recent matches</SectionTitle></View>}
        {done.map((m) => <MatchCard key={m.id} m={m} />)}
        {!matches.length && (
          <Card style={tw`items-center py-7`}>
            <View style={tw`h-12 w-12 rounded-full border border-line bg-key items-center justify-center`}>
              <TapeBall size={22} tone="mute" />
            </View>
            <Txt style={tw`mt-3 text-[17px] font-semibold text-fg`}>No matches yet</Txt>
            <Txt style={tw`mt-1 text-center text-[13px] text-mute`}>Set one up in under 30 seconds. Everything stays on this phone.</Txt>
          </Card>
        )}
        <AdBanner />
      </View>
      {ask && (
        <Sheet title="Watch a live match" onClose={() => setAsk(false)}>
          <Txt style={tw`text-[13px] text-mute`}>Ask the scorer for the 6-letter code on their screen.</Txt>
          <View style={tw`mt-3 gap-3`}>
            <TextInput value={code} onChangeText={(t) => setCode(cleanCode(t))} placeholder="ABC123" autoFocus textAlignVertical="center" autoCapitalize="characters" autoCorrect={false}
              placeholderTextColor={C.mute} selectionColor={C.sun} accessibilityLabel="Match code" returnKeyType="go" onSubmitEditing={submit}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              style={[tw`min-h-16 w-full rounded-2xl border ${focus ? "border-sun" : "border-line"} bg-panel px-4 text-center text-[28px] text-fg`,
                { fontFamily: "JetBrainsMono_700Bold", letterSpacing: 8 }]} />
            <PrimaryButton disabled={code.length !== 6} onPress={submit}>Watch</PrimaryButton>
          </View>
        </Sheet>
      )}
    </Page>
  );
}
