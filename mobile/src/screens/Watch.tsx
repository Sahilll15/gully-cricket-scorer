import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, ScrollView, View, type TextStyle } from "react-native";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { fingerprint, watch, type LiveState } from "@/lib/live";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { stamp, useStore } from "@/lib/store";
import { deviceId } from "@/lib/device";
import { Badge, BallChip, Board, C, Card, Header, LivePill, Num, Page, PrimaryButton, ScoreHero, SectionTitle, Txt, tw } from "@/ui/ui";
import { oversLine } from "@shared/liveKit";
import { SoloTable } from "./sheets";
import { PairsStrip } from "./liveSheets";

const RIGHT: TextStyle = { textAlign: "right" };

/** The match code, big and widely spaced so it can be read out across a ground. */
function CodePanel({ code, children }: { code: string; children: ReactNode }) {
  return (
    <Card style={tw`mt-3 items-center py-6`}>
      <Txt style={tw`text-[12px] font-medium text-mute`}>Match code</Txt>
      <Num accessibilityLabel={`Match code ${code.split("").join(" ")}`} numberOfLines={1} adjustsFontSizeToFit
        style={[tw`mt-2 text-[44px] text-fg text-center`, { letterSpacing: 8, paddingLeft: 8 }]}>{code}</Num>
      <Txt style={tw`mt-4 text-center text-[14px] text-teal`}>{children}</Txt>
    </Card>
  );
}

export default function Watch() {
  const { watchCode, watchKey, go } = useStore();
  const [live, setLive] = useState<LiveState | null>(null);
  const [status, setStatus] = useState("CONNECTING");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => (watchCode ? watch(watchCode, watchKey, setLive, setStatus) : undefined), [watchCode, watchKey]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  if (!watchCode) return null;

  const m = live?.match;
  const ago = live ? Math.max(0, Math.round((now - live.at) / 1000)) : 0;
  const done = m?.status === "done";

  return (
    <Page>
      <Header title="Watching live" back={() => go("home")} right={done ? undefined : <LivePill />}>
        {m && m.innings.length > 0 ? <Safe><LiveScore m={m} /></Safe> : (
          <CodePanel code={watchCode}>
            {m ? "The scorer is setting up the match." : status === "SUBSCRIBED" ? "Waiting for the scorer. Their app needs to be open." : "Connecting..."}
          </CodePanel>
        )}
      </Header>
      <View style={tw`gap-3 px-4 pt-4`}>
        {m && m.innings.length > 0 && <Safe><Details m={m} /></Safe>}
        {live && !done && (
          <Txt style={tw`text-center text-xs text-mute`}>
            {ago < 60 ? `Updated ${ago < 5 ? "just now" : `${ago}s ago`}` : "No update for a while. The scorer's phone may be locked."}
          </Txt>
        )}
        {!watchKey && <Txt style={tw`text-center text-xs text-mute`}>Joined by code. Open the scorer's link to be sure it's really them.</Txt>}
        <PrimaryButton tone="navy" onPress={() => go("home")}>Stop watching</PrimaryButton>
      </View>
    </Page>
  );
}

/** Opened from a hand-over link: waits for the scorer's phone, then carries on scoring here. */
export function JoinScoring() {
  const { joinCode, joinKey, joinToken, go, watchMatch } = useStore();
  const [status, setStatus] = useState("CONNECTING");
  const [fpShown, setFp] = useState<string | null>(null);
  useEffect(() => {
    if (!joinCode || !joinKey) return;
    let stop = () => {}, got = false, gone = false;
    void fingerprint(joinKey.x, joinKey.y).then((fp) => {
      if (gone) return;
      setFp(fp);
      stop = watch(joinCode, fp, ({ match }) => {
        if (got) return;
        got = true;
        if (!replays(match)) { setStatus("BAD"); return; }
        // The link works once: the sender's phone holds the same token until it's used or cancelled.
        if (!joinToken || match.handover !== joinToken) { setStatus("USED"); return; }
        const s = useStore.getState(), mine = s.matches.find((x) => x.id === match.id);
        // Only a phone already scoring with this same key may have its copy replaced; anything else lands as a new match.
        const same = mine && mine.liveKey?.x === joinKey.x && mine.liveKey?.y === joinKey.y;
        const keep: Match = same ? ((mine.editedAt ?? 0) > (match.editedAt ?? 0) ? mine : match) : { ...match, id: mine ? E.uid() : match.id, cup: undefined };
        s.adopt(stamp({ ...keep, live: joinCode, liveKey: joinKey, liveFp: fp, scorer: deviceId(), handover: undefined }, keep));
        useStore.setState({ redo: [] });
        track(EV.move_scoring_in);
        go("live", keep.id);
      }, setStatus);
    });
    return () => { gone = true; stop(); };
  }, [joinCode, joinKey, joinToken, go]);
  if (!joinCode) return null;
  return (
    <Page>
      <Header title="Move scoring here" back={() => go("home")}>
        <CodePanel code={joinCode}>
          {status === "BAD" ? "That match couldn't be read. Ask for a fresh link."
            : status === "USED" ? "Link already used. Ask for a new one."
            : status === "SUBSCRIBED" ? "Getting the match. Keep the other app open." : "Connecting..."}
        </CodePanel>
      </Header>
      <View style={tw`gap-3 px-4 pt-4`}>
        <Txt style={tw`text-center text-sm text-mute`}>Scoring moves here. The other phone follows.</Txt>
        {status === "USED" && fpShown && <PrimaryButton onPress={() => watchMatch(joinCode, fpShown)}>Just watch the match</PrimaryButton>}
        <PrimaryButton tone="navy" onPress={() => go("home")}>Cancel</PrimaryButton>
      </View>
    </Page>
  );
}

function replays(m: Match) {
  try { m.innings.forEach((_, i) => E.replay(m, i)); return typeof m.id === "string" && m.id.length > 0; } catch { return false; }
}

// A bad update must not blank the viewer's screen; the next good one renders again.
class Safe extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidUpdate(prev: { children: ReactNode }) { if (prev.children !== this.props.children && this.state.err) this.setState({ err: false }); }
  render() { return this.state.err ? <Txt style={tw`py-4 text-center text-sm text-mute`}>Couldn't read the last update. Waiting for the next ball.</Txt> : this.props.children; }
}

/** The web .roll animation: the score slides up from below and fades in whenever it changes. */
function Roll({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>{children}</Animated.View>;
}

function LiveScore({ m }: { m: NonNullable<LiveState["match"]> }) {
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const tgt = E.target(m, idx), batTeam = m.teams[inn.bat];
  const need = tgt !== null ? tgt - st.runs : 0, left = E.ballsLeft(m, idx) ?? 0;
  const res = E.result(m), test = E.isTest(m), status = E.testStatus(m), solo = E.isSolo(m);
  const label = E.inningsLabel(m, idx), who = E.playerName(m, inn.striker), lives = E.livesLeft(m);
  const line = tw`mt-3 text-[13px] text-teal`, hi = tw`text-[13px] text-fg`;
  return (
    <ScoreHero style={tw`mt-3`}>
      <View style={tw`flex-row items-center gap-2`}>
        <Badge name={solo ? who : batTeam.name} kind={solo ? "player" : "team"} size={28} />
        <Txt numberOfLines={1} style={tw`flex-1 text-[13px] font-medium text-teal`}>
          {solo ? `${who} ${m.status === "live" ? "batting" : "· turn over"}${E.isFrench(m) ? " · French cricket" : ""}` : `${batTeam.name} · ${label}`}
        </Txt>
      </View>
      <View style={tw`mt-2 flex-row items-end gap-3`}>
        <Roll key={st.runs + "-" + st.wickets}>
          <Board style={{ fontSize: 56, lineHeight: 60 }}>{solo ? st.runs : `${st.runs}/${st.wickets}`}</Board>
        </Roll>
        <Num style={tw`pb-2 text-[14px] text-teal`}>{solo ? `off ${st.bat.get(inn.striker)?.balls ?? 0}` : `(${oversLine(m, idx, st)})`}</Num>
      </View>
      <Txt style={line}>
        {res ? <Txt style={tw`font-semibold text-fg`}>{res.text}</Txt>
          : solo ? (m.status === "break" ? "Between turns" : <><Num style={hi}>{lives}</Num> {lives === 1 ? "life" : "lives"} left</>)
          : test ? <>{m.status === "break" ? "Innings break · " : ""}{status ?? <>Run rate <Num style={hi}>{E.runRate(st.runs, st.legal, st.bpo).toFixed(2)}</Num></>}</>
          : m.status === "break" ? <>Innings break · {m.teams[E.otherSide(inn.bat)].name} need <Num style={hi}>{st.runs + 1}</Num></>
          : tgt !== null ? <>Need <Num style={hi}>{Math.max(0, need)}</Num> off <Num style={hi}>{left}</Num> ball{left === 1 ? "" : "s"} · Target <Num style={hi}>{tgt}</Num></>
          : <>Run rate <Num style={hi}>{E.runRate(st.runs, st.legal, st.bpo).toFixed(2)}</Num></>}
        {st.penalties > 0 && <> · incl. <Num style={hi}>{st.penalties}</Num> penalty run{st.penalties === 1 ? "" : "s"}</>}
      </Txt>
    </ScoreHero>
  );
}

const BOWL_COLS: [string, number][] = [["O", 32], ["M", 22], ["R", 28], ["W", 24], ["Wd", 24], ["Nb", 24], ["Econ", 38]];

function Details({ m }: { m: NonNullable<LiveState["match"]> }) {
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const name = (id: string | null) => E.playerName(m, id);
  const bowler = st.bowl.get(inn.bowler), ump = E.umpire(m), solo = E.isSolo(m), french = E.isFrench(m);
  const overNo = Math.floor(st.legal / st.bpo);
  const over = st.overs[overNo]?.length ? st.overs[overNo] : (st.overs[overNo - 1] ?? []);
  const empty = french ? 0 : Math.max(0, st.bpo - over.filter((b) => E.isLegal(b, m.rules)).length);
  const others = solo ? [] : m.innings.slice(0, idx).map((x, i) => ({ x, st: E.replay(m, i) }));
  const pair = [st.striker, st.nonStriker].filter((id): id is string => !!id);
  return (
    <View style={tw`gap-3`}>
      {m.status === "live" && pair.length > 0 && !solo && (
        <Card style={tw`px-3.5 py-1`}>
          {pair.map((id, i) => {
            const on = id === st.striker;
            return (
              <View key={id} style={tw`flex-row items-center py-2.5 ${i ? "border-t border-line" : ""}`}>
                <View accessible={on} accessibilityLabel={on ? "On strike" : undefined} style={[tw`mr-2 h-1.5 w-1.5 rounded-full`, { backgroundColor: on ? C.sun : "transparent" }]} />
                <Txt numberOfLines={1} style={tw`flex-1 text-[15px] ${on ? "font-semibold text-fg" : "text-teal"}`}>{name(id)}</Txt>
                <Num style={tw`text-[18px] ${on ? "text-fg" : "text-teal"}`}>{st.bat.get(id)?.runs ?? 0}</Num>
                <Num style={[tw`ml-1.5 w-9 text-[12px] text-mute`]}>({st.bat.get(id)?.balls ?? 0})</Num>
                {!!st.bat.get(id)?.outs && <Txt style={tw`ml-1 text-[11px] text-out`}>out <Num style={tw`text-[11px] text-out`}>{st.bat.get(id)!.outs}</Num>×</Txt>}
              </View>
            );
          })}
        </Card>
      )}
      {E.isPairs(m) && <PairsStrip match={m} idx={idx} />}
      <View>
        <View style={tw`flex-row items-center justify-between gap-2`}>
          <Txt numberOfLines={1} style={tw`flex-1 text-[13px] text-mute`}>Bowler: <Txt style={tw`font-medium text-fg`}>{name(inn.bowler)}</Txt></Txt>
          <Num style={tw`text-[13px] text-teal`}>{bowler ? `${E.oversText(bowler.legal, st.bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}</Num>
        </View>
        {!!ump && <Txt style={tw`mt-1 text-[12px] text-mute`}>Umpire this over: <Txt style={tw`font-medium text-fg`}>{ump.name}</Txt></Txt>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2.5`} contentContainerStyle={tw`flex-row items-center gap-2 pb-1`}>
          <Txt style={tw`mr-1 text-[12px] font-medium text-mute`}>{french ? "Balls" : over.length ? `Over ${st.overs[overNo]?.length ? overNo + 1 : overNo}` : "New over"}</Txt>
          {over.map((b, i) => <BallChip key={i} b={b} size={32} />)}
          {Array.from({ length: empty }, (_, i) => (
            <View key={`e${i}`} style={tw`h-8 w-8 rounded-full border border-line`} />
          ))}
        </ScrollView>
      </View>
      {others.length > 0 && (
        <Card style={tw`px-3.5 py-1`}>
          {others.map(({ x, st: s }, i) => (
            <View key={i} style={tw`flex-row items-center gap-3 py-2.5 ${i ? "border-t border-line" : ""}`}>
              <Badge name={m.teams[x.bat].name} size={28} kind="team" />
              <Txt numberOfLines={1} style={tw`flex-1 text-[14px] text-teal`}>{m.teams[x.bat].name}{x.superOver ? " (super over)" : ""}</Txt>
              <Num style={tw`text-[16px] text-fg`}>{E.inningsScore(m, i)} <Num style={tw`text-[12px] text-mute`}>({E.oversText(s.legal)})</Num></Num>
            </View>
          ))}
        </Card>
      )}
      {solo && <Card style={tw`p-0 overflow-hidden`}><View style={tw`px-3.5 pt-3`}><SectionTitle>Standings</SectionTitle></View><SoloTable match={m} highlight={m.status === "live" ? inn.striker : null} /></Card>}
      {!solo && <Card style={tw`px-3.5 pb-1 pt-3`}>
        <SectionTitle>{`Batting · ${m.teams[inn.bat].name}`}</SectionTitle>
        {[...st.bat.entries()].map(([id, b]) => (
          <View key={id} style={tw`flex-row items-center py-2.5 border-t border-line`}>
            <Txt style={tw`flex-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{name(id)}{b.out ? "" : " *"}</Txt>
            <Num style={tw`text-[16px] text-fg`}>{b.runs}</Num>
            <Num style={tw`ml-1.5 w-9 text-[12px] text-mute`}>({b.balls})</Num>
          </View>
        ))}
      </Card>}
      <Card style={tw`p-0 overflow-hidden`}>
        <View style={tw`px-3.5 pt-3`}><SectionTitle>{solo ? "Bowling this turn" : `Bowling · ${m.teams[E.otherSide(inn.bat)].name}`}</SectionTitle></View>
        <View style={tw`flex-row items-center py-2 px-3.5`}>
          <Txt style={tw`flex-1 text-[12px] font-medium text-mute`}>Bowler</Txt>
          {BOWL_COLS.map(([h, w]) => <Txt key={h} style={[tw`text-[12px] font-medium text-mute`, RIGHT, { width: w }]}>{h}</Txt>)}
        </View>
        {st.bowlOrder.map((id) => {
          const b = st.bowl.get(id)!, on = m.status === "live" && id === inn.bowler;
          const vals = [E.oversText(b.legal, st.bpo), b.maidens, b.runs, b.wickets, b.wides, b.noBalls, E.runRate(b.runs, b.legal, st.bpo).toFixed(1)];
          return (
            <View key={id} style={tw`flex-row items-center border-t border-line py-2.5 px-3.5`}>
              <Txt numberOfLines={1} style={tw`flex-1 min-w-0 pr-1 text-[14px] font-medium ${on ? "text-sun" : "text-fg"}`}>{name(id)}{on ? " *" : ""}</Txt>
              {vals.map((v, k) => (
                <Num key={k} style={[k === 3 ? tw`text-[15px] text-fg` : tw`text-[13px] text-teal`, RIGHT, { width: BOWL_COLS[k][1] }]}>{String(v)}</Num>
              ))}
            </View>
          );
        })}
        {!st.bowlOrder.length && <Txt style={tw`px-3.5 py-3 text-sm text-mute`}>No balls yet.</Txt>}
      </Card>
    </View>
  );
}
