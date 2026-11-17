import { useState } from "react";
import { View, type TextStyle } from "react-native";
import * as E from "@shared/engine/engine";
import type { Ball } from "@shared/engine/types";
import { strikeRate } from "@shared/stats";
import { useMatch, useStore } from "@/lib/store";
import { canScore } from "@/lib/device";
import { shareImage, sharePdf } from "@/lib/share";
import { Badge, BallChip, C, Card, GhostButton, Header, LivePill, Num, Page, Press, PrimaryButton, SectionTitle, Segmented, Txt, tw } from "@/ui/ui";
import { ChartsTab, MvpTab } from "@/ui/Charts";
import { ChalkStumps, Crease } from "@/ui/gully";
import { EditBallSheet } from "./sheets";

const NUM: TextStyle = { textAlign: "right" };
const BAT_COLS: [string, number][] = [["R", 32], ["B", 28], ["4s", 26], ["6s", 26], ["SR", 40]];
const BOWL_COLS: [string, number][] = [["O", 34], ["M", 26], ["R", 30], ["W", 28], ["Econ", 42]];
const SOLO_BOWL: [string, number][] = [["O", 36], ["R", 34], ["W", 30], ["Econ", 44]];

/** Table header row: first column grows, the number columns keep fixed widths. */
function Head({ first, cols }: { first: string; cols: [string, number][] }) {
  return (
    <View style={tw`flex-row items-center py-2.5 px-3.5`}>
      <Txt style={tw`flex-1 text-[12px] font-medium text-mute`}>{first}</Txt>
      {cols.map(([h, w]) => <Txt key={h} style={[tw`text-[12px] font-medium text-mute`, NUM, { width: w }]}>{h}</Txt>)}
    </View>
  );
}

export default function Scorecard() {
  const m = useMatch();
  const { go, put } = useStore();
  const [idx, setIdx] = useState(() => Math.max(0, (m?.innings.length ?? 1) - 1));
  const [edit, setEdit] = useState<number | null>(null);
  const [tab, setTab] = useState<"card" | "charts" | "mvp">("card");
  const [pdfBusy, setPdfBusy] = useState(false);
  if (!m || !m.innings.length) return null;

  const inn = m.innings[idx], st = E.replay(m, idx), name = (id: string) => E.playerName(m, id);
  const live = m.status === "live" || m.status === "break", test = E.isTest(m);
  const head = (side: 0 | 1) => {
    const i = m.innings.findIndex((x) => x.bat === side && !x.superOver);
    return i < 0 ? null : { st: E.replay(m, i) };
  };
  const short = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  let evCursor = 0;
  const balls = (
    <Card style={tw`mt-3`}>
      <SectionTitle action={<Txt style={tw`text-xs text-mute`}>· tap a ball to correct it</Txt>}>{E.isSolo(m) ? `Ball by ball, ${E.inningsLabel(m, idx)}` : "Ball by ball"}</SectionTitle>
      {st.overs.map((over, o) => (
        <View key={o} style={tw`flex-row items-center gap-2 py-2.5 ${o > 0 ? "border-t border-line" : ""}`}>
          <Num style={tw`w-11 text-[12px] text-mute`}>Ov {o + 1}</Num>
          <View style={tw`flex-1 flex-row flex-wrap gap-1.5`}>{over.map((b: Ball, i) => {
            while (inn.events[evCursor] && inn.events[evCursor].t !== "ball") evCursor++;
            const at = evCursor++;
            return <BallChip key={i} b={b} size={30} onPress={canScore(m) ? () => setEdit(at) : undefined} />;
          })}</View>
          <Num style={tw`text-[16px] text-fg`}>{over.reduce((n, b) => n + E.ballTotal(b, m.rules), 0)}</Num>
        </View>
      ))}
      {!st.overs.length && (
        <View style={tw`flex-row items-center gap-2`}>
          <ChalkStumps size={28} />
          <Txt style={tw`text-sm text-mute`}>No balls yet.</Txt>
        </View>
      )}
    </Card>
  );
  const tabs = <Segmented value={tab} set={setTab} items={[{ v: "card", label: "Scorecard" }, { v: "charts", label: "Charts" }, { v: "mvp", label: "MVP" }]} />;
  const actions = (
    <View style={tw`mt-4 gap-2`}>
      <PrimaryButton onPress={() => shareImage(m, "full")}>Send this scorecard on WhatsApp</PrimaryButton>
      <GhostButton disabled={pdfBusy} onPress={async () => { setPdfBusy(true); await sharePdf(m); setPdfBusy(false); }}>
        {pdfBusy ? "Making the PDF…" : "Save scoresheet as PDF"}
      </GhostButton>
    </View>
  );
  const editSheet = edit !== null && inn.events[edit]?.t === "ball" && (
    <EditBallSheet ball={inn.events[edit] as Ball} onClose={() => setEdit(null)}
      onSave={(p) => { put(E.editBall(m, idx, edit, p)); setEdit(null); }} />
  );

  if (E.isSolo(m)) {
    const rows = E.soloStandings(m), res = E.result(m), lead = rows[0];
    const bowlers = rows.filter((r) => r.bowled > 0).sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded);
    return (
      <Page>
        <Header title="Match Score Board" back={() => go(live ? "live" : "result")} right={live ? <LivePill /> : undefined}>
          <Txt style={tw`mt-2 text-center text-[13px] text-mute`}>{E.formatText(m)}</Txt>
          <Txt style={tw`mt-1 text-center text-[16px] font-semibold text-sun`}>{res?.text ?? (lead && lead.turns ? `${lead.name} leads with ${lead.runs}` : "First turn under way")}</Txt>
        </Header>
        <View style={tw`px-4 pt-4`}>
          {tabs}
          <View style={tw`mt-4`}>{tab === "charts" ? <ChartsTab m={m} idx={idx} pick={setIdx} /> : tab === "mvp" ? <MvpTab m={m} /> : <>
          <SectionTitle action={<Txt style={tw`text-xs text-mute`}>tap a turn for its balls</Txt>}>Batting, turn by turn</SectionTitle>
          <Card style={tw`p-0 overflow-hidden`}>
            <Head first="Turn" cols={BAT_COLS} />
            {m.innings.map((t, i) => {
              const s = E.replay(m, i), b = s.bat.get(t.striker), ex = s.extras.wd + s.extras.nb + s.extras.b + s.extras.lb;
              const lost = t.wicketLimit > 1 && s.wickets && s.wickets < t.wicketLimit ? `, lost ${s.wickets} of ${t.wicketLimit} lives` : "";
              const now = i === m.innings.length - 1 && m.status === "live";
              const vals = [s.runs, b?.balls ?? 0, b?.fours ?? 0, b?.sixes ?? 0, strikeRate(s.runs, b?.balls ?? 0).toFixed(0)];
              return (
                <Press key={i} onPress={() => setIdx(i)} accessibilityState={{ selected: i === idx }}
                  style={[tw`flex-row items-center border-t border-line py-2.5 px-3.5`, i === idx && { backgroundColor: C.sunSoft }]}>
                  <View style={tw`flex-1 min-w-0 pr-1`}>
                    <Txt style={tw`text-[14px] font-medium text-fg`} numberOfLines={1}>{E.inningsLabel(m, i)}{now ? " *" : ""}</Txt>
                    <Txt style={tw`text-xs text-mute`}>{b ? E.howOut(m, b) : "not out"}{lost}{ex ? `, ${ex} extras` : ""}</Txt>
                  </View>
                  {vals.map((v, k) => (
                    <Num key={k} style={[k === 0 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, NUM, { width: BAT_COLS[k][1] }]}>{String(v)}</Num>
                  ))}
                </Press>
              );
            })}
          </Card>

          <Crease style={tw`mt-5`} />
          <View style={tw`mt-4`}><SectionTitle>Bowling</SectionTitle></View>
          <Card style={tw`p-0 overflow-hidden`}>
            <Head first="Bowler" cols={SOLO_BOWL} />
            {bowlers.map((r) => {
              const vals = [E.oversText(r.bowled, E.ballsPerOver(m.rules)), r.conceded, r.wickets, E.runRate(r.conceded, r.bowled, E.ballsPerOver(m.rules)).toFixed(1)];
              return (
                <View key={r.id} style={tw`flex-row items-center border-t border-line py-3 px-3.5`}>
                  <Txt style={tw`flex-1 min-w-0 pr-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{r.name}</Txt>
                  {vals.map((v, k) => (
                    <Num key={k} style={[k === 2 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, NUM, { width: SOLO_BOWL[k][1] }]}>{String(v)}</Num>
                  ))}
                </View>
              );
            })}
            {!bowlers.length && <Txt style={tw`px-3 py-3 text-sm text-mute`}>No balls yet.</Txt>}
          </Card>
          {balls}
          </>}</View>
          {actions}
        </View>
        {editSheet}
      </Page>
    );
  }

  const side = (s: 0 | 1) => {
    const h = head(s);
    return (
      <View key={s} style={tw`flex-1 items-center`}>
        <Badge name={m.teams[s].name} size={44} />
        <Txt style={tw`mt-2 text-center text-[13px] font-medium text-teal`} numberOfLines={1}>{m.teams[s].name}</Txt>
        {test ? <Num style={tw`mt-1 text-center text-[18px]`}>{E.sideScore(m, s) ?? "Yet to bat"}</Num>
          : h ? <>
            <Num style={tw`mt-1 text-center text-[28px]`}>{h.st.runs}/{h.st.wickets}</Num>
            <Num style={tw`mt-0.5 text-center text-[12px] text-teal`}>({E.oversText(h.st.legal, h.st.bpo)} Over)</Num>
          </> : <Txt style={tw`mt-1 text-center text-[13px] text-mute`}>Yet to bat</Txt>}
        {h && !test && <Txt style={tw`mt-1 text-center text-[11px] text-mute`}>Wide: {h.st.extras.wd} | No Ball: {h.st.extras.nb} | Byes: {h.st.extras.b + h.st.extras.lb}</Txt>}
      </View>
    );
  };

  return (
    <Page>
      <Header title="Match Score Board" back={() => go(live ? "live" : "result")} right={live ? <LivePill /> : undefined}>
        <View style={tw`mt-3 flex-row items-start gap-2`}>
          {side(0)}
          <Txt style={tw`mt-4 text-[13px] font-medium text-mute`}>vs</Txt>
          {side(1)}
        </View>
        {m.toss && <Txt style={tw`mt-3 text-center text-[13px] text-teal`}>Toss won by: {m.teams[m.toss.winner].name}, elected to {m.toss.choice}</Txt>}
        {test && <Txt style={tw`mt-2 text-center font-semibold text-sun`}>{E.result(m)?.text ?? E.testStatus(m) ?? "Test match"}</Txt>}
      </Header>

      <View style={tw`px-4 pt-4`}>
        {tabs}
        {tab !== "mvp" && <View style={tw`mt-3`}><Segmented value={idx} set={setIdx} items={m.innings.map((x, i) => {
          const s = E.replay(m, i);
          if (test) return { v: i, label: `${short(m.teams[x.bat].name)} ${E.inningsScore(m, i)}` };
          return { v: i, label: `${x.superOver ? "SO " : ""}${short(m.teams[x.bat].name)} ${s.runs}/${s.wickets}(${E.oversText(s.legal, s.bpo)})` };
        })} /></View>}

        {tab === "charts" ? <View style={tw`mt-4`}><ChartsTab m={m} idx={idx} pick={setIdx} /></View> : tab === "mvp" ? <View style={tw`mt-4`}><MvpTab m={m} /></View> : <>

        <View style={tw`mt-5`}><SectionTitle>{`Batting, ${m.teams[inn.bat].name}${test ? `, ${E.inningsLabel(m, idx)}` : ""}`}</SectionTitle></View>
        <Card style={tw`p-0 overflow-hidden`}>
          <Head first="Name" cols={BAT_COLS} />
          {st.order.map((id) => {
            const b = st.bat.get(id)!;
            const vals = [b.runs, b.balls, b.fours, b.sixes, strikeRate(b.runs, b.balls).toFixed(0)];
            return (
              <View key={id} style={tw`flex-row items-center border-t border-line py-2.5 px-3.5`}>
                <View style={tw`flex-1 min-w-0 pr-1`}>
                  <Txt style={tw`text-[14px] font-medium text-fg`}>{name(id)}{(id === st.striker || id === st.nonStriker) && !b.out && live && idx === m.innings.length - 1 ? " *" : ""}</Txt>
                  <Txt style={tw`text-xs text-mute`}>{E.howOut(m, b)}</Txt>
                </View>
                {vals.map((v, k) => (
                  <Num key={k} style={[k === 0 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, NUM, { width: BAT_COLS[k][1] }]}>{String(v)}</Num>
                ))}
              </View>
            );
          })}
        </Card>

        {E.isPairs(m) && (
          <Card style={tw`mt-3 py-2`}>
            <SectionTitle>Pairs</SectionTitle>
            {E.pairStandings(m, idx).map((p, i) => (
              <View key={p.names} style={tw`flex-row items-center gap-3 py-2.5 ${i ? "border-t border-line" : ""}`}>
                <Txt style={tw`flex-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{p.names}</Txt>
                <Num style={tw`text-[12px] font-medium text-mute`}>{`${p.outs} out · ${E.oversText(p.balls, st.bpo)} ov`}</Num>
                <Num style={[tw`text-[16px] text-fg`, NUM, { width: 40 }]}>{p.runs}</Num>
              </View>
            ))}
          </Card>
        )}

        <Card style={tw`mt-3`}>
          <Txt style={tw`text-[14px] text-fg`}>
            <Txt style={tw`font-semibold`}>Extras {st.extras.wd + st.extras.nb + st.extras.b + st.extras.lb}</Txt>
            <Txt style={tw`text-mute`}> (wd {st.extras.wd}, nb {st.extras.nb}, b {st.extras.b}, lb {st.extras.lb})</Txt>
          </Txt>
          {st.penalties !== 0 && <Txt style={tw`mt-1 text-[14px] font-semibold text-fg`}>Penalty runs {st.penalties}</Txt>}
          {st.deducted > 0 && <Txt style={tw`mt-1 text-[14px] text-fg`}><Txt style={tw`font-semibold`}>{st.deducted} off</Txt><Txt style={tw`text-mute`}> for dismissals</Txt></Txt>}
          <View style={tw`mt-3 flex-row items-baseline gap-2`}>
            <Txt style={tw`text-[14px] font-semibold`}>Total</Txt>
            <Num style={tw`text-[26px]`}>{st.runs}/{st.wickets}</Num>
          </View>
          <Txt style={tw`mt-0.5 text-[13px] text-mute`}>in {E.oversText(st.legal, st.bpo)} overs, run rate {E.runRate(st.runs, st.legal, st.bpo).toFixed(2)}</Txt>
          {st.fow.length > 0 && <>
            <View style={tw`mt-4`}><SectionTitle>Fall of wickets</SectionTitle></View>
            {st.fow.map((f, i) => (
              <View key={i} style={tw`flex-row items-center gap-3 py-2 ${i ? "border-t border-line" : ""}`}>
                <Num style={tw`w-14 text-[14px] text-fg`}>{f.score}-{f.wicket}</Num>
                <Txt style={tw`flex-1 text-[14px] text-teal`} numberOfLines={1}>{name(f.id)}</Txt>
                <Num style={tw`text-[13px] text-mute`}>{f.over}</Num>
              </View>
            ))}
          </>}
        </Card>

        <Crease style={tw`mt-5`} />
        <View style={tw`mt-4`}><SectionTitle>{`Bowling, ${m.teams[E.otherSide(inn.bat)].name}`}</SectionTitle></View>
        <Card style={tw`p-0 overflow-hidden`}>
          <Head first="Bowler" cols={BOWL_COLS} />
          {st.bowlOrder.map((id) => {
            const b = st.bowl.get(id)!;
            const vals = [E.oversText(b.legal, st.bpo), b.maidens, b.runs, b.wickets, E.runRate(b.runs, b.legal, st.bpo).toFixed(1)];
            return (
              <View key={id} style={tw`flex-row items-center border-t border-line py-3 px-3.5`}>
                <Txt style={tw`flex-1 min-w-0 pr-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{name(id)}</Txt>
                {vals.map((v, k) => (
                  <Num key={k} style={[k === 3 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, NUM, { width: BOWL_COLS[k][1] }]}>{String(v)}</Num>
                ))}
              </View>
            );
          })}
          {!st.bowlOrder.length && <Txt style={tw`px-3 py-3 text-sm text-mute`}>No balls yet.</Txt>}
        </Card>

        {balls}
        </>}
        {actions}
      </View>
      {editSheet}
    </Page>
  );
}
