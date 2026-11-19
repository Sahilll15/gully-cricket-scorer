import { useState } from "react";
import { View } from "react-native";
import { endBody, endSeries, newSeries, rulesLabel, seriesMatches, seriesScore, seriesSub, type Series } from "@shared/engine/series";
import type { Match, Rules } from "@shared/engine/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { Repeat } from "lucide-react-native";
import { Badge, C, Card, ConfirmSheet, Header, Num, Page, Press, PrimaryButton, ScoreHero, SectionTitle, Segmented, Stepper, tw, Txt } from "@/ui/ui";
import { MatchCard } from "./Home";
import { TextField } from "./Teams";

const SERIES_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

const teamName = (id: string) => useStore.getState().teams.find((t) => t.id === id)?.name ?? "?";
export const seriesNames = (s: Series): [string, string] => [teamName(s.a), teamName(s.b)];

/** One-tap button for the next match of a series, or to carry on the one under way. */
export function SeriesNext({ s, matches, label = "Play next match" }: { s: Series; matches: Match[]; label?: string }) {
  const { playSeries, go } = useStore();
  const sc = seriesScore(s, matches);
  if (sc.current) return <PrimaryButton onPress={() => go("live", sc.current)}>{`Carry on match ${sc.played + 1}`}</PrimaryButton>;
  if (sc.next === null) return null;
  return <PrimaryButton onPress={() => playSeries(s.id)}>{label}</PrimaryButton>;
}

/** Ends the series after a confirm, unless it is already over. */
export function EndSeries({ s, matches }: { s: Series; matches: Match[] }) {
  const { putSeries } = useStore();
  const [ask, setAsk] = useState(false);
  if (seriesScore(s, matches).done) return null;
  return (<>
    <Press onPress={() => setAsk(true)} style={tw`min-h-12 rounded-[16px] border border-line items-center justify-center`}>
      <Txt style={tw`font-medium text-fg`}>End series</Txt>
    </Press>
    {ask && <ConfirmSheet title="End the series?" body={endBody(s, matches, seriesNames(s))} yes="End series"
      onYes={() => { putSeries(endSeries(s)); setAsk(false); }} onClose={() => setAsk(false)} />}
  </>);
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
      <Txt style={tw`mt-3 text-center text-[14px] font-medium text-fg`}>{sc.text(names)}{sc.drawn ? ` · ${sc.drawn} drawn` : ""}</Txt>
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
            <Txt style={tw`mt-1 text-[13px] text-mute`}>{names[0]} v {names[1]} · {seriesSub(s, sc)}</Txt>
            <Txt style={tw`mt-1 text-[14px] text-teal`}>{sc.text(names)}</Txt>
          </Card>
        </Press>
      );
    })}
    {!series.length && (
      <Card style={tw`items-center py-6`}>
        <View style={tw`h-14 w-14 rounded-full bg-sun-soft items-center justify-center`}><Repeat size={22} color={C.sun} strokeWidth={2} /></View>
        <Txt style={tw`mt-3 font-semibold text-center`}>No series yet</Txt>
        <Txt style={tw`text-sm text-mute text-center`}>Same two teams, as many matches as you like. The team that wins the most matches wins the series. Every next match starts filled in.</Txt>
      </Card>
    )}
  </>);
}

export function NewSeries() {
  const { teams, go, putSeries, saveTeam } = useStore();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [plan, setPlan] = useState(false);
  const [games, setGames] = useState(3);
  const [newTeam, setNewTeam] = useState("");
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < 2 ? [...pick, id] : [pick[1], id]);
  const names = pick.map((id) => teams.find((t) => t.id === id)?.name ?? "");
  const addTeam = () => { if (newTeam.trim()) { track(EV.team_save); const t = saveTeam(newTeam, []); setPick((p) => [...p.filter((x) => x !== t.id), t.id].slice(-2)); setNewTeam(""); } };
  return (
    <Page>
      <Header title="New series" back={() => go("cups")} />
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
        </Card>
        <Card>
          <SectionTitle>Number of matches</SectionTitle>
          <Segmented value={plan ? "set" : "open"} set={(v) => setPlan(v === "set")} items={[{ v: "open", label: "Open series" }, { v: "set", label: "Plan a number" }]} />
          {plan && <View style={tw`mt-2`}><Stepper value={games} set={setGames} max={9} /></View>}
          <Txt style={tw`mt-2 text-xs text-mute`}>{plan ? "You can still play on or end it early." : "Play as many matches as you like and end it when you decide. Most wins takes the series."}</Txt>
        </Card>
        <PrimaryButton disabled={pick.length < 2} onPress={() => {
          const s = newSeries(name.trim() || `${names[0]} v ${names[1]}`, pick[0], pick[1], plan ? games : null, SERIES_RULES);
          track(EV.series_create, { matches: plan ? games : 0 });
          putSeries(s); useStore.setState({ seriesId: s.id, cupsTab: "series" }); go("series");
        }}>{pick.length < 2 ? "Pick 2 teams" : "Create series"}</PrimaryButton>
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
        <Txt style={tw`text-center text-xs text-mute`}>{seriesSub(s, seriesScore(s, matches))}{seriesScore(s, matches).done ? " · Ended" : ""}</Txt>
        <SeriesNext s={s} matches={matches} />
        <EndSeries s={s} matches={matches} />
        {list.map((m, i) => (
          <View key={m.id}>
            <View style={tw`px-1`}><SectionTitle>{`Match ${i + 1} · ${rulesLabel(m.rules)}`}</SectionTitle></View>
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
        <SeriesNext s={s} matches={matches} label="Play the next match" />
        <EndSeries s={s} matches={matches} />
        <Press onPress={() => { useStore.setState({ seriesId: s.id }); go("series"); }} style={tw`min-h-12 rounded-[16px] border border-line items-center justify-center`}>
          <Txt style={tw`font-medium text-fg`}>See the series</Txt>
        </Press>
      </View>
    </Card>
  );
}
