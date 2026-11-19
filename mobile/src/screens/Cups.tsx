import { useEffect, useState } from "react";
import { View } from "react-native";
import * as E from "@shared/engine/engine";
import { advance, champion, fixtureCount, newTournament, stageLabel, standings, type CupFormat, type Fixture, type Tournament } from "@shared/engine/tournament";
import type { Match, Rules } from "@shared/engine/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { leaders, strikeRate } from "@shared/stats";
import { Trophy } from "lucide-react-native";
import { Badge, C, Card, ConfirmSheet, Header, LivePill, Num, Page, Press, PrimaryButton, ScoreHero, SectionTitle, Segmented, Stepper, tw, Txt } from "@/ui/ui";
import { RankRow } from "./Lists";
import { SeriesList } from "./Series";
import { TextField } from "./Teams";
import { GroupChips } from "./groups";
import { playersFrom } from "@shared/groups";

export const CUP_RULES: Rules = {
  overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
  wall: "none", tipAndRun: false, maxOversPerBowler: null,
};

export const FORMATS: { v: CupFormat; label: string; hint: string; min: number }[] = [
  { v: "league-final", label: "Top 2 play the final", hint: "League, then 1st v 2nd", min: 3 },
  { v: "ipl", label: "IPL style, top 4", hint: "Qualifier 1 (1v2), Eliminator (3v4), Qualifier 2, Final", min: 4 },
  { v: "semis", label: "Semi-finals", hint: "League, then 1v4 and 2v3, winners in the final", min: 4 },
  { v: "knockout", label: "Knockout", hint: "No league. Lose once and you're out", min: 2 },
  { v: "league", label: "League only", hint: "Top of the table wins", min: 2 },
];
const formatLabel = (f: CupFormat) => FORMATS.find((x) => x.v === f)?.label ?? f;

export function Cups() {
  const { cups, go, matches, teams, cupsTab: tab } = useStore();
  const setTab = (v: "cups" | "series") => useStore.setState({ cupsTab: v });
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  return (
    <Page tabs>
      <Header title={tab === "cups" ? "Tournaments" : "Series"} />
      <View style={tw`gap-3 px-4 pt-4`}>
        <Segmented value={tab} set={setTab} items={[{ v: "cups", label: "Tournaments" }, { v: "series", label: "Series" }]} />
        {tab === "series" ? <SeriesList /> : <>
        <PrimaryButton onPress={() => go("newcup")}>+ Create tournament</PrimaryButton>
        {cups.map((c) => {
          const done = c.fixtures.filter((f) => matches.some((m) => m.id === f.matchId && m.status === "done")).length;
          const champ = champion(c, matches);
          return (
            <Press key={c.id} onPress={() => { useStore.setState({ cupId: c.id }); go("cup"); }}>
              <Card>
                <View style={tw`flex-row items-center justify-between gap-2`}>
                  <Txt style={tw`flex-1 text-[17px] font-semibold`} numberOfLines={1}>{c.name}</Txt>
                  {champ ? (
                    <View style={tw`flex-row items-center gap-1.5`}>
                      <Trophy size={14} color={C.sun} strokeWidth={2} />
                      <Txt style={tw`text-[13px] font-semibold text-sun`}>{name(champ)}</Txt>
                    </View>
                  ) : (
                    <Txt style={tw`text-xs text-mute`}><Num style={tw`text-[15px] text-fg`}>{done}/{c.fixtures.length}</Num> played</Txt>
                  )}
                </View>
                <Txt style={tw`mt-1 text-[13px] text-mute`}>{c.teamIds.length} teams · {c.rules.overs} overs · {formatLabel(c.format)}</Txt>
              </Card>
            </Press>
          );
        })}
        {!cups.length && (
          <Card style={tw`items-center py-6`}>
            <View style={tw`h-14 w-14 rounded-full bg-sun-soft items-center justify-center`}><Trophy size={22} color={C.sun} strokeWidth={2} /></View>
            <Txt style={tw`mt-3 font-semibold text-center`}>No tournaments yet</Txt>
            <Txt style={tw`text-sm text-mute text-center`}>Pick your teams, and fixtures plus a points table with net run rate are made for you.</Txt>
          </Card>
        )}
        </>}
      </View>
    </Page>
  );
}

export function NewCup() {
  const { teams, go, putCup, saveTeam, groups } = useStore();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [name, setName] = useState("Gully Premier League");
  const [pick, setPick] = useState<string[]>([]);
  const [overs, setOvers] = useState(5);
  const [format, setFormat] = useState<CupFormat>("league-final");
  const [newTeam, setNewTeam] = useState("");
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);
  const min = FORMATS.find((f) => f.v === format)!.min;
  const fixtures = fixtureCount(format, pick.length);
  const addTeam = () => { if (newTeam.trim()) { track(EV.team_save); const g = groups.find((x) => x.id === groupId); if (g) track(EV.group_use, { where: "cup" });
    const t = saveTeam(newTeam, g ? playersFrom(g, []) : []); setPick([...pick, t.id]); setNewTeam(""); } };

  return (
    <Page>
      <Header title="New Tournament" back={() => go("cups")} />
      <View style={tw`gap-3 px-4 pt-4`}>
        <Card>
          <SectionTitle>Name</SectionTitle>
          <TextField value={name} onChangeText={setName} maxLength={32} weight="600" outline style={tw`min-h-12 w-full text-[17px]`} />
        </Card>
        <Card>
          <SectionTitle>{`Teams (${pick.length} picked)`}</SectionTitle>
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
          <GroupChips value={groupId} set={setGroupId} />
          <Txt style={tw`mt-2 text-xs text-mute`}>Add players to each team from the Teams tab, or at the toss of each match.</Txt>
        </Card>
        <Card>
          <SectionTitle>Overs an innings</SectionTitle>
          <Stepper value={overs} set={setOvers} max={50} />
          <View style={tw`mt-4`}><SectionTitle>Playoffs</SectionTitle></View>
          <View style={tw`gap-2`}>
            {FORMATS.map((f) => {
              const on = format === f.v;
              return (
                <Press key={f.v} onPress={() => setFormat(f.v)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={tw`flex-row min-h-14 items-center gap-3 rounded-[16px] border px-4 py-2 ${on ? "border-sun bg-sun-soft" : "border-line"}`}>
                  <View style={tw`h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-sun" : "border-mute"}`}>
                    {on && <View style={tw`h-2.5 w-2.5 rounded-full bg-sun`} />}
                  </View>
                  <View style={tw`flex-1`}>
                    <Txt style={tw`text-[15px] font-medium`}>{f.label}</Txt>
                    <Txt style={tw`text-xs ${on ? "text-teal" : "text-mute"}`}>{f.hint}{f.min > 2 ? ` · ${f.min}+ teams` : ""}</Txt>
                  </View>
                </Press>
              );
            })}
          </View>
          {pick.length >= 2 && pick.length < min && <Txt style={tw`mt-2 text-xs text-out`}>{min} teams needed for this. With {pick.length} it becomes {pick.length >= 3 ? "a top-2 final" : "a league"}.</Txt>}
          {format !== "league" && format !== "knockout" && <Txt style={tw`mt-2 text-xs text-mute`}>A tied playoff sends the team higher in the table through.</Txt>}
          {format === "knockout" && <Txt style={tw`mt-2 text-xs text-mute`}>Seeded in the order you picked the teams. A tie sends the higher seed through.</Txt>}
        </Card>
        <PrimaryButton disabled={pick.length < 2 || !name.trim()} onPress={() => {
          const t = newTournament(name.trim(), pick, { ...CUP_RULES, overs }, format);
          track(EV.cup_create, { format, teams: pick.length });
          putCup(t); useStore.setState({ cupId: t.id }); go("cup");
        }}>{pick.length < 2 ? "Pick at least 2 teams" : `Create · ${fixtures} match${fixtures === 1 ? "" : "es"}`}</PrimaryButton>
      </View>
    </Page>
  );
}

/** One fixture as a hairline row: stage on top, both sides with their scores, the winner lit. */
function FixtureRow({ f, cup, matches, name, first }: { f: Fixture; cup: Tournament; matches: Match[]; name: (id: string) => string; first: boolean }) {
  const { playFixture, go } = useStore();
  const m = matches.find((x) => x.id === f.matchId);
  const res = m && E.result(m);
  const score = (side: 0 | 1) => {
    if (!m) return "";
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return "";
    const st = E.replay(m, i);
    return `${st.runs}/${st.wickets}`;
  };
  const live = m && m.status !== "done";
  return (
    <Press onPress={() => (m ? go(m.status === "done" ? "result" : "live", m.id) : (track(EV.cup_fixture_play), playFixture(cup.id, f.id)))}
      style={tw`py-3 ${first ? "" : "border-t border-line"}`}>
      <View style={tw`mb-1.5 flex-row items-center justify-between`}>
        {f.stage === "final" ? (
          <View style={tw`flex-row items-center gap-1.5`}>
            <Trophy size={14} color={C.sun} strokeWidth={2} />
            <Txt style={tw`text-xs font-semibold text-sun`}>Final</Txt>
          </View>
        ) : f.stage === "league" ? <Txt style={tw`text-xs font-medium text-mute`}>Match {cup.fixtures.indexOf(f) + 1} · Round {f.round}</Txt>
          : <Txt style={tw`text-xs font-semibold text-sun`}>{stageLabel(cup, f)}</Txt>}
        {live ? <LivePill />
          : !m ? <Txt style={tw`text-xs font-semibold text-sun`}>Tap to play</Txt>
          : <Txt style={tw`text-xs font-medium text-mute`}>Result</Txt>}
      </View>
      {([[f.a, 0], [f.b, 1]] as const).map(([id, s]) => {
        const won = !!res && res.winner === s;
        return (
          <View key={id} style={tw`flex-row items-center gap-3 py-1`}>
            <Badge name={name(id)} size={28} />
            <Txt style={tw`flex-1 text-[15px] ${won ? "font-semibold text-sun" : res ? "text-teal" : "font-medium text-fg"}`} numberOfLines={1}>{name(id)}</Txt>
            <Num style={tw`text-[16px] ${won ? "text-sun" : res ? "text-teal" : "text-fg"}`}>{score(s)}</Num>
          </View>
        );
      })}
      {res && <Txt style={tw`mt-1 text-[13px] text-teal`}>{res.text}</Txt>}
    </Press>
  );
}

const COL = { num: 22, pts: 30, nrr: 54 };

export function Cup() {
  const { cups, cupId, matches, teams, go, putCup, removeCup, openPlayer } = useStore();
  const cup = cups.find((c) => c.id === cupId);
  const [tab, setTab] = useState<"fix" | "table" | "stats">("fix");
  const [askDel, setAskDel] = useState(false);
  useEffect(() => {
    if (!cup) return;
    let next = cup;
    for (let i = 0; i < 4; i++) next = advance(next, matches);
    if (next !== cup) putCup(next);
  }, [cup, matches, putCup]);
  if (!cup) return null;
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const table = standings(cup, matches);
  const champ = champion(cup, matches);
  const cupMatches = matches.filter((m) => cup.fixtures.some((f) => f.matchId === m.id));
  const top = leaders(cupMatches, "limited");
  const ko = cup.format === "knockout";
  const through = cup.format === "league" ? 1 : cup.teamIds.length >= 4 && (cup.format === "ipl" || cup.format === "semis") ? 4 : 2;
  type Row = (typeof top)[number];
  const boards: readonly (readonly [string, Row[], (r: Row) => string, (r: Row) => string])[] = [
    ["Most runs", [...top].sort((a, b) => b.runs - a.runs), (r) => `${r.runs}`, (r) => `SR ${strikeRate(r.runs, r.balls).toFixed(0)}`],
    ["Most wickets", [...top].filter((r) => r.wickets).sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded), (r) => `${r.wickets}`, (r) => `${r.conceded} runs`],
    ["Most sixes", [...top].filter((r) => r.sixes).sort((a, b) => b.sixes - a.sixes), (r) => `${r.sixes}`, () => ""],
  ];
  const head = (h: string, w: number) => (
    <Txt key={h} style={[tw`py-2 text-right text-[12px] font-medium text-mute`, { width: w }]}>{h}</Txt>
  );

  return (
    <Page>
      <Header title={cup.name} back={() => go("cups")}>
        {champ && (
          <ScoreHero style={tw`mt-3`}>
            <View style={tw`flex-row items-center gap-3`}>
              <View style={tw`h-12 w-12 rounded-full bg-sun items-center justify-center`}><Trophy size={22} color={C.ink} strokeWidth={2} /></View>
              <View style={tw`flex-1 min-w-0`}>
                <Txt style={tw`text-[12px] font-medium text-mute`}>Champions</Txt>
                <Txt style={tw`text-[24px] font-semibold`} numberOfLines={1}>{name(champ)}</Txt>
              </View>
            </View>
          </ScoreHero>
        )}
      </Header>
      <View style={tw`gap-3 px-4 pt-4`}>
        <Txt style={tw`text-center text-xs text-mute`}>{formatLabel(cup.format)} · {cup.rules.overs} overs</Txt>
        <Segmented value={tab} set={setTab} items={ko ? [{ v: "fix", label: "Fixtures" }, { v: "stats", label: "Stats" }] : [{ v: "fix", label: "Fixtures" }, { v: "table", label: "Points table" }, { v: "stats", label: "Stats" }]} />
        {tab === "fix" && (
          <View>
            {[...cup.fixtures].sort((a, b) => a.round - b.round).map((f, i) => <FixtureRow key={f.id} f={f} cup={cup} matches={matches} name={name} first={i === 0} />)}
          </View>
        )}
        {tab === "table" && (
          <View>
            <View style={tw`flex-row items-center border-b border-line`}>
              <Txt style={tw`flex-1 py-2 pl-2.5 text-[12px] font-medium text-mute`}>Team</Txt>
              {head("P", COL.num)}{head("W", COL.num)}{head("L", COL.num)}{head("T", COL.num)}{head("Pts", COL.pts)}{head("NRR", COL.nrr)}
            </View>
            {table.map((r, i) => {
              const q = i < through;
              return (
                <View key={r.teamId} style={tw`flex-row items-center border-b border-line`}>
                  <View style={[tw`absolute left-0 top-3 bottom-3 w-[2px] rounded-full`, { backgroundColor: q ? C.sun : "transparent" }]} />
                  <View style={tw`flex-1 flex-row items-center gap-2 py-3 pl-2.5`}>
                    <Num style={tw`w-5 text-[14px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
                    <Txt style={tw`flex-1 text-[14px] font-medium`} numberOfLines={1}>{name(r.teamId)}</Txt>
                  </View>
                  {[r.p, r.w, r.l, r.t].map((v, k) => <Num key={k} style={[tw`text-right text-[14px] text-teal`, { width: COL.num }]}>{v}</Num>)}
                  <Num style={[tw`text-right text-[16px] text-fg`, { width: COL.pts }]}>{r.pts}</Num>
                  <Num style={[tw`text-right text-[13px] ${r.nrr < 0 ? "text-mute" : "text-teal"}`, { width: COL.nrr }]}>{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</Num>
                </View>
              );
            })}
            <Txt style={tw`py-3 text-xs text-mute`}>Win 2 points, tie 1. Net run rate: runs per over scored minus runs per over conceded.{cup.format === "league" ? "" : ` ${FORMATS.find((f) => f.v === cup.format)?.hint ?? ""}.`}</Txt>
          </View>
        )}
        {tab === "stats" && (
          <View style={tw`gap-5`}>
            {boards.map(([title, rows, big, sub]) => (
              <View key={title}>
                <SectionTitle>{title}</SectionTitle>
                {rows.slice(0, 5).map((r, i) => (
                  <RankRow key={r.name} rank={i + 1} name={r.name} sub={sub(r)} big={big(r)} first={i === 0} onPress={() => openPlayer(r.name)} />
                ))}
                {!rows.length && <Txt style={tw`py-2 text-sm text-mute`}>Nothing yet.</Txt>}
              </View>
            ))}
          </View>
        )}
        <Press onPress={() => setAskDel(true)} style={tw`min-h-12 w-full rounded-[16px] items-center justify-center`}>
          <Txt style={tw`font-medium text-out`}>Delete tournament</Txt>
        </Press>
      </View>
      {askDel && <ConfirmSheet title={`Delete ${cup.name}?`} body="Its matches stay in History." yes="Delete" danger
        onYes={() => { removeCup(cup.id); go("cups"); }} onClose={() => setAskDel(false)} />}
    </Page>
  );
}
