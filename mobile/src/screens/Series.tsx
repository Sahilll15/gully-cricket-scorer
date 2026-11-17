import { useState } from "react";
import { View } from "react-native";
import { newSeries, seriesMatches, seriesScore, type Series } from "@shared/engine/series";
import type { Match, Rules } from "@shared/engine/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { Repeat } from "lucide-react-native";
import { Badge, C, Card, ConfirmSheet, Header, Num, Page, Pill, Press, PrimaryButton, ScoreHero, SectionTitle, Segmented, Stepper, Toggle, tw, Txt } from "@/ui/ui";
import { MatchCard } from "./Home";
import { TextField } from "./Teams";

const SERIES_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

const teamName = (id: string) => useStore.getState().teams.find((t) => t.id === id)?.name ?? "?";
export const seriesNames = (s: Series): [string, string] => [teamName(s.a), teamName(s.b)];
const ruleText = (s: Series) => (s.rules.format === "test" ? `Test${s.rules.matchOvers ? `, ${s.rules.matchOvers} overs max` : ""}` : `${s.rules.overs} overs`);

/** One-tap button for the next match of a series, or to carry on the one under way. */
export function SeriesNext({ s, matches }: { s: Series; matches: Match[] }) {
  const { playSeries, go } = useStore();
  const sc = seriesScore(s, matches), names = seriesNames(s);
  if (sc.current) return <PrimaryButton onPress={() => go("live", sc.current)}>{`Carry on match ${sc.played + 1} of ${s.games}`}</PrimaryButton>;
  if (sc.next === null) return null;
  return <PrimaryButton onPress={() => playSeries(s.id)}>{`Play match ${sc.next} of ${s.games} · ${names[0]} v ${names[1]}`}</PrimaryButton>;
}

function ScoreBoard({ s, matches }: { s: Series; matches: Match[] }) {
  const sc = seriesScore(s, matches), names = seriesNames(s);
  return (
    <ScoreHero style={tw`mt-3`}>
      <View style={tw`flex-row items-center justify-center gap-3`}>
        <View style={tw`flex-1 items-center gap-1.5`}>
          <Badge name={names[0]} size={40} />
          <Txt style={tw`text-center text-[13px] font-medium text-teal`} numberOfLines={1}>{names[0]}</Txt>
        </View>
        <Num style={tw`text-[44px] text-sun`}>{sc.a}-{sc.b}</Num>
        <View style={tw`flex-1 items-center gap-1.5`}>
          <Badge name={names[1]} size={40} />
          <Txt style={tw`text-center text-[13px] font-medium text-teal`} numberOfLines={1}>{names[1]}</Txt>
        </View>
      </View>
      <Txt style={tw`mt-3 text-center text-[14px] font-medium text-fg`}>{sc.text(names)}{sc.drawn ? ` · ${sc.drawn} ${s.rules.format === "test" ? "drawn" : "tied"}` : ""}</Txt>
    </ScoreHero>
  );
}

export function SeriesList() {
  const { series, matches, go } = useStore();
  return (<>
    <PrimaryButton onPress={() => go("newseries")}>+ Create series</PrimaryButton>
    {series.map((s) => {
      const sc = seriesScore(s, matches), names = seriesNames(s);
      return (
        <Press key={s.id} onPress={() => { useStore.setState({ seriesId: s.id }); go("series"); }}>
          <Card>
            <View style={tw`flex-row items-center justify-between gap-2`}>
              <Txt style={tw`flex-1 text-[17px] font-semibold`} numberOfLines={1}>{s.name}</Txt>
              <Num style={tw`text-[18px] text-sun`}>{sc.a}-{sc.b}</Num>
            </View>
            <Txt style={tw`mt-1 text-[13px] text-mute`}>{names[0]} v {names[1]} · {s.games} matches · {ruleText(s)}</Txt>
            <Txt style={tw`mt-1 text-[14px] text-teal`}>{sc.text(names)}</Txt>
          </Card>
        </Press>
      );
    })}
    {!series.length && (
      <Card style={tw`items-center py-6`}>
        <View style={tw`h-14 w-14 rounded-full bg-sun-soft items-center justify-center`}><Repeat size={22} color={C.sun} strokeWidth={2} /></View>
        <Txt style={tw`mt-3 font-semibold text-center`}>No series yet</Txt>
        <Txt style={tw`text-sm text-mute text-center`}>Same two teams, a set number of matches. Set it up once and every next match starts filled in, with the series score kept for you.</Txt>
      </Card>
    )}
  </>);
}

const OVERS = [3, 4, 5, 6, 10];

export function NewSeries() {
  const { teams, go, putSeries, saveTeam } = useStore();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [games, setGames] = useState(3);
  const [rules, setRules] = useState<Rules>(SERIES_RULES);
  const [newTeam, setNewTeam] = useState("");
  const test = rules.format === "test";
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < 2 ? [...pick, id] : [pick[1], id]);
  const names = pick.map((id) => teams.find((t) => t.id === id)?.name ?? "");
  const addTeam = () => { if (newTeam.trim()) { track(EV.team_save); const t = saveTeam(newTeam, []); setPick((p) => [...p.filter((x) => x !== t.id), t.id].slice(-2)); setNewTeam(""); } };
  return (
    <Page>
      <Header title="New Series" back={() => go("cups")} />
      <View style={tw`gap-3 px-4 pt-4`}>
        <Card>
          <SectionTitle>{`Two teams (${pick.length} of 2)`}</SectionTitle>
          <View style={tw`flex-row flex-wrap gap-2`}>
            {teams.map((t) => {
              const on = pick.includes(t.id);
              return (
                <Press key={t.id} onPress={() => toggle(t.id)} accessibilityState={{ selected: on }}
                  style={tw`flex-row min-h-12 items-center gap-2 rounded-full border py-1 pl-1 pr-4 ${on ? "border-sun bg-sun-soft" : "border-line"}`}>
                  <Badge name={t.name} size={34} /><Txt style={tw`text-sm font-medium ${on ? "text-sun" : "text-fg"}`}>{t.name}</Txt>
                </Press>
              );
            })}
          </View>
          <View style={tw`mt-3 flex-row gap-2`}>
            <TextField value={newTeam} onChangeText={setNewTeam} placeholder="Add a team" maxLength={18} outline
              onSubmitEditing={addTeam} returnKeyType="done" style={tw`min-h-12 flex-1`} />
            <Press onPress={addTeam} style={tw`min-h-12 rounded-[16px] border border-line px-5 items-center justify-center`}>
              <Txt style={tw`font-semibold text-fg`}>Add</Txt>
            </Press>
          </View>
          <Txt style={tw`mt-2 text-xs text-mute`}>Players come from each saved team. You can add more at the start of any match.</Txt>
        </Card>
        <Card>
          <SectionTitle>Name</SectionTitle>
          <TextField value={name} onChangeText={setName} maxLength={32} weight="600" outline placeholder={names.length === 2 ? `${names[0]} v ${names[1]}` : "Sunday series"}
            style={tw`min-h-12 w-full text-[17px]`} />
          <View style={tw`mt-4`}><SectionTitle>Matches in the series</SectionTitle></View>
          <Stepper value={games} set={setGames} max={9} />
        </Card>
        <Segmented value={test ? "test" : "limited"} set={(v) => setRules({ ...rules, format: v === "test" ? "test" : undefined, matchOvers: undefined })}
          items={[{ v: "limited", label: "Limited overs" }, { v: "test", label: "Test matches" }]} />
        {test ? <Card>
          <Txt style={tw`text-sm text-mute`}>Every match is a Test: two innings a side, declare, follow-on and draws.</Txt>
          <Toggle on={!!rules.matchOvers} set={(v) => setRules({ ...rules, matchOvers: v ? 30 : null })} label="Stop each match after a set number of overs" hint="A draw if nobody has won by then" />
          {!!rules.matchOvers && <Stepper value={rules.matchOvers} set={(v) => setRules({ ...rules, matchOvers: v })} max={200} />}
        </Card> : <Card>
          <SectionTitle>Overs an innings</SectionTitle>
          <View style={tw`flex-row gap-2`}>
            {OVERS.map((o) => <View key={o} style={tw`flex-1`}><Pill active={rules.overs === o} onPress={() => setRules({ ...rules, overs: o })}>{o}</Pill></View>)}
          </View>
          <View style={tw`mt-2`}><Stepper value={rules.overs} set={(v) => setRules({ ...rules, overs: v })} max={50} /></View>
        </Card>}
        <PrimaryButton disabled={pick.length < 2} onPress={() => {
          const s = newSeries(name.trim() || `${names[0]} v ${names[1]}`, pick[0], pick[1], games, rules);
          track(EV.series_create, { matches: games });
          putSeries(s); useStore.setState({ seriesId: s.id, cupsTab: "series" }); go("series");
        }}>{pick.length < 2 ? "Pick 2 teams" : `Create · ${games} match${games === 1 ? "" : "es"}`}</PrimaryButton>
      </View>
    </Page>
  );
}

export function SeriesView() {
  const { series, seriesId, matches, go, removeSeries } = useStore();
  const [askDel, setAskDel] = useState(false);
  const s = series.find((x) => x.id === seriesId);
  if (!s) return null;
  const list = seriesMatches(s, matches);
  return (
    <Page>
      <Header title={s.name} back={() => { useStore.setState({ cupsTab: "series" }); go("cups"); }}>
        <ScoreBoard s={s} matches={matches} />
      </Header>
      <View style={tw`gap-3 px-4 pt-4`}>
        <Txt style={tw`text-center text-xs text-mute`}>{s.games} matches · {ruleText(s)}</Txt>
        <SeriesNext s={s} matches={matches} />
        {list.map((m, i) => (
          <View key={m.id}>
            <View style={tw`px-1`}><SectionTitle>{`Match ${i + 1}`}</SectionTitle></View>
            <MatchCard m={m} />
          </View>
        ))}
        {!list.length && <Txt style={tw`pt-2 text-center text-sm text-mute`}>No matches played yet.</Txt>}
        <Press onPress={() => setAskDel(true)} style={tw`min-h-12 w-full rounded-[16px] items-center justify-center`}>
          <Txt style={tw`font-medium text-out`}>Delete series</Txt>
        </Press>
      </View>
      {askDel && <ConfirmSheet title={`Delete ${s.name}?`} body="Its matches stay in History." yes="Delete" danger
        onYes={() => { removeSeries(s.id); go("cups"); }} onClose={() => setAskDel(false)} />}
    </Page>
  );
}

/** Series score and the next match, shown under a finished series match. */
export function SeriesAfterMatch({ m }: { m: Match }) {
  const { series, matches, go } = useStore();
  const s = series.find((x) => x.id === m.series?.id);
  if (!s) return null;
  const names = seriesNames(s), sc = seriesScore(s, matches);
  return (
    <Card>
      <SectionTitle>{s.name}</SectionTitle>
      <Txt style={tw`text-[20px] font-semibold`}>{sc.text(names)}</Txt>
      <View style={tw`mt-3 gap-2`}>
        <SeriesNext s={s} matches={matches} />
        <Press onPress={() => { useStore.setState({ seriesId: s.id }); go("series"); }} style={tw`min-h-12 rounded-[16px] border border-line items-center justify-center`}>
          <Txt style={tw`font-medium text-fg`}>See the series</Txt>
        </Press>
      </View>
    </Card>
  );
}
