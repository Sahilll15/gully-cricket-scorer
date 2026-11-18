import { useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { BookOpen, ChevronRight, Download, Search } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { economy, fmtOf, leaders, strikeRate } from "@shared/stats";
import { overview } from "@shared/records";
import type { Match } from "@shared/engine/types";
import { AdBanner } from "@/ui/AdBanner";
import { ChalkStumps } from "@/ui/gully";
import { Badge, Board as Score, C, ConfirmSheet, FmtSwitch, GhostButton, Header, Num, Page, Press, ScoreHero, Segmented, tw, Txt } from "@/ui/ui";
import { csvName, statsCsv } from "@shared/csv";
import { shareCsv } from "@/lib/share";
import { MatchCard } from "./Home";

export function History() {
  const { matches, remove, go } = useStore();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [f, setF] = useState<"all" | "live" | "done">("all");
  const [ask, setAsk] = useState<Match | null>(null);
  const list = matches.filter((m) =>
    (f === "all" || (f === "done" ? m.status === "done" : m.status !== "done")) &&
    m.teams.some((t) => t.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <Page tabs scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={tw`gap-3 pb-4`}>
            <Header title="Match History">
              <View style={[tw`mt-3 min-h-12 flex-row items-center gap-2.5 rounded-[16px] border bg-panel px-4`, { borderColor: focus ? C.sun : C.line }]}>
                <Search size={18} color={C.mute} strokeWidth={2} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search a team" placeholderTextColor={C.mute} selectionColor={C.sun}
                  onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                  style={[tw`min-h-12 flex-1 text-[15px]`, { color: C.fg, fontFamily: "Inter_500Medium" }]} />
              </View>
            </Header>
            <View style={tw`gap-3 px-4`}>
              <Press onPress={() => go("book")} style={tw`min-h-14 flex-row items-center gap-3 rounded-[18px] border border-line bg-panel px-4 py-3`}>
                <BookOpen size={20} color={C.teal} strokeWidth={2} />
                <View style={tw`flex-1`}>
                  <Txt style={tw`text-[15px] font-semibold text-fg`}>Gully Book</Txt>
                  <Txt style={tw`text-[12px] text-mute`}>Records, milestones and bragging rights</Txt>
                </View>
                <ChevronRight size={18} color={C.mute} strokeWidth={2} />
              </Press>
              <Segmented value={f} set={setF} items={[{ v: "all", label: "All" }, { v: "live", label: "Live" }, { v: "done", label: "Completed" }]} />
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={tw`h-3`} />}
        renderItem={({ item: m }) => (
          <View style={tw`px-4`}>
            <MatchCard m={m} />
            <View style={tw`absolute bottom-2.5 right-6`}>
              <Press onPress={() => setAsk(m)} accessibilityLabel="Delete match" style={tw`min-h-10 rounded-full px-3 items-center justify-center`}>
                <Txt style={tw`text-xs font-semibold text-out`}>Delete</Txt>
              </Press>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={tw`items-center pt-10`}>
            <ChalkStumps />
            <Txt style={tw`mt-2 text-center text-sm text-mute`}>No matches here yet.</Txt>
          </View>
        }
        ListFooterComponent={<View style={tw`px-4`}><AdBanner /></View>}
      />
      {ask && <ConfirmSheet title="Delete this match?" body={`${ask.teams[0].name} vs ${ask.teams[1].name}. Its runs and wickets come off everyone's stats.`}
        yes="Delete" danger onYes={() => remove(ask.id)} onClose={() => setAsk(null)} />}
    </Page>
  );
}

type Board = "runs" | "wickets" | "sr" | "sixes" | "field";

/** One leaderboard row on a hairline: rank and value in mono, only rank 1 lit. */
export function RankRow({ rank, name, sub, big, onPress, first }: { rank: number; name: string; sub: string; big: string; onPress: () => void; first?: boolean }) {
  return (
    <Press onPress={onPress} style={tw`flex-row w-full items-center gap-3 py-3 ${first ? "" : "border-t border-line"}`}>
      <Num style={tw`w-6 text-[14px] ${rank === 1 ? "text-sun" : "text-mute"}`}>{rank}</Num>
      <Badge name={name} size={36} />
      <View style={tw`flex-1 min-w-0`}>
        <Txt style={tw`text-[15px] font-medium`} numberOfLines={1}>{name}</Txt>
        {!!sub && <Txt style={tw`text-xs text-mute`} numberOfLines={1}>{sub}</Txt>}
      </View>
      <Num style={tw`text-[20px] text-fg`}>{big}</Num>
    </Press>
  );
}

/** Totals for the chosen format, so the leaderboard below has something to be a share of. */
function Summary({ matches, fmt, players }: { matches: Match[]; fmt: "limited" | "test"; players: number }) {
  const o = overview(matches, fmt);
  if (!o.played) return null;
  const tiles: [string, number][] = [["Runs", o.runs], ["Wickets", o.wickets], ["Sixes", o.sixes], ["Fours", o.fours], ["Players", players]];
  return (
    <ScoreHero>
      <Txt style={tw`text-[12px] font-medium text-mute`}>Overall · {fmt === "test" ? "Test" : "limited overs"}</Txt>
      <View style={tw`mt-1 flex-row items-end gap-2`}>
        <Score style={{ fontSize: 44, lineHeight: 50 }}>{o.played}</Score>
        <Txt style={tw`pb-2 text-[14px] text-teal`}>{o.played === 1 ? "match" : "matches"}</Txt>
      </View>
      <View style={tw`mt-3 flex-row border-t border-line pt-3`}>
        {tiles.map(([k, v]) => (
          <View key={k} style={tw`flex-1 items-center`}>
            <Num style={tw`text-[17px]`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
            <Txt style={tw`mt-0.5 text-[11px] text-mute`}>{k}</Txt>
          </View>
        ))}
      </View>
      {o.completed < o.played && <Txt style={tw`mt-3 text-[12px] text-mute`}>Totals count the {o.completed} finished {o.completed === 1 ? "match" : "matches"}.</Txt>}
    </ScoreHero>
  );
}

export function Stats() {
  const { matches, openPlayer, fmt } = useStore();
  const [b, setB] = useState<Board>("runs");
  const all = leaders(matches, fmt);
  const dismissals = (r: (typeof all)[number]) => r.catches + r.runOuts + r.stumpings;
  const rows = {
    runs: [...all].filter((r) => r.runs).sort((x, y) => y.runs - x.runs).map((r) => [r, `${r.runs}`, `${r.balls} balls · ${r.matches} match${r.matches === 1 ? "" : "es"}`] as const),
    wickets: [...all].filter((r) => r.wickets).sort((x, y) => y.wickets - x.wickets || x.conceded - y.conceded).map((r) => [r, `${r.wickets}`, `econ ${economy(r.conceded, r.legal).toFixed(1)}`] as const),
    sr: [...all].filter((r) => r.balls >= 10).sort((x, y) => strikeRate(y.runs, y.balls) - strikeRate(x.runs, x.balls)).map((r) => [r, strikeRate(r.runs, r.balls).toFixed(0), `${r.runs} off ${r.balls}`] as const),
    sixes: [...all].filter((r) => r.sixes).sort((x, y) => y.sixes - x.sixes).map((r) => [r, `${r.sixes}`, `${r.fours} fours too`] as const),
    field: [...all].filter(dismissals).sort((x, y) => dismissals(y) - dismissals(x) || y.catches - x.catches)
      .map((r) => [r, `${dismissals(r)}`, `${r.catches} caught · ${r.runOuts} run out · ${r.stumpings} stumped`] as const),
  }[b];
  return (
    <Page tabs>
      <Header title="Leaderboard" />
      <View style={tw`gap-3 px-4 pt-4`}>
        <FmtSwitch value={fmt} set={(v) => useStore.setState({ fmt: v })} />
        <Summary matches={matches} fmt={fmt} players={all.length} />
        <Segmented value={b} set={setB} items={[{ v: "runs", label: "Runs" }, { v: "wickets", label: "Wkts" }, { v: "sr", label: "SR" }, { v: "sixes", label: "6s" }, { v: "field", label: "Field" }]} />
        {b === "sr" && <Txt style={tw`text-center text-xs text-mute`}>Players with at least 10 balls faced</Txt>}
        {rows.length > 0 && <Txt style={tw`text-center text-xs text-mute`}>Tap a player to open their card.</Txt>}
        <View>
          {rows.map(([r, big, sub], i) => (
            <RankRow key={r.name} rank={i + 1} name={r.name} sub={sub} big={big} first={i === 0} onPress={() => openPlayer(r.name)} />
          ))}
          {!rows.length && (
            <View style={tw`items-center p-6`}>
              <ChalkStumps />
              <Txt style={tw`mt-2 text-center text-sm text-mute`}>{matches.some((m) => fmtOf(m) === fmt)
                ? b === "field" ? "Name the fielder when you record a catch, run out or stumping, and it counts here." : "Nothing here yet."
                : fmt === "test" ? "No Test matches yet. Pick Test match when you set one up." : "Name your players when setting up a match and they show up here."}</Txt>
            </View>
          )}
        </View>
        {all.length > 0 && (
          <GhostButton onPress={() => void shareCsv(statsCsv(matches, fmt), csvName(fmt))}>
            <View style={tw`flex-row items-center justify-center gap-2`}>
              <Download size={18} color={C.fg} strokeWidth={2} />
              <Txt style={tw`text-[15px] font-medium text-fg`}>Download all player stats (CSV)</Txt>
            </View>
          </GhostButton>
        )}
      </View>
      <View style={tw`px-4`}><AdBanner /></View>
    </Page>
  );
}
