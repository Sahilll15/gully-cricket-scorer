import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollView, TextInput, View } from "react-native";
import {
  ArrowDownRight, ArrowLeftRight, BookOpen, ChevronRight, CircleDot, Crown, Egg, Flame, Footprints, Handshake, Medal, Share2,
  Star, Swords, Target, Timer, TrendingDown, TrendingUp, Trophy, Users, Zap, type LucideIcon,
} from "lucide-react-native";
import { headToHead, rivalry, type Duel, type HallOfShame, type Rec, type Records } from "@shared/records";
import { playerPool, type Fmt } from "@shared/stats";
import {
  bookData, dateText, emptyBook, plural, RECORD_ROWS, recordDetail, SECTIONS, SHAME, type BookData, type Section,
} from "@shared/screens/book/book";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { sendText } from "@/lib/share";
import { markBookSeen } from "@/ui/guide";
import { fetchTop, fetchWorld, myBoard, renameBoard, showOnBoard, useAccount, type BoardMetric, type BoardRow, type MyBoard } from "@/lib/account";
import type { GullyWorld } from "@shared/globalStats";
import { Badge, Board, C, Card, FmtSwitch, GhostButton, Header, IconButton, Num, Page, Press, ScoreHero, SectionTitle, Sheet, tw, Txt } from "@/ui/ui";

const lbl = [tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }];
const row = (first: boolean) => tw`flex-row w-full items-center gap-3 py-3 ${first ? "" : "border-t border-line"}`;

const RECORD_ICON: Record<keyof Records, LucideIcon> = {
  highestScore: Star, bestBowling: Target, mostSixesInnings: Zap, highestTotal: TrendingUp, lowestAllOut: TrendingDown,
  closestFinish: Timer, biggestWinRuns: Trophy, biggestWinWickets: Trophy, mostRunsInOver: Flame, biggestCollapse: ArrowDownRight,
};
const SHAME_ICON: Record<keyof HallOfShame, LucideIcon> = {
  ducks: Egg, goldenDucks: Egg, runOutsSuffered: Footprints, runOutsCaused: Users, extrasBowled: CircleDot, expensiveOvers: Flame,
};

function Disc({ icon: I, lit }: { icon: LucideIcon; lit?: boolean }) {
  return (
    <View style={[tw`h-9 w-9 rounded-full border items-center justify-center`, { borderColor: lit ? C.sun : C.line, backgroundColor: lit ? C.sunSoft : C.key }]}>
      <I size={18} color={lit ? C.sun : C.teal} strokeWidth={2} />
    </View>
  );
}

function Empty({ icon: I, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={tw`items-center py-7`}>
      <View style={tw`h-12 w-12 rounded-full border border-line bg-key items-center justify-center`}>
        <I size={20} color={C.teal} strokeWidth={2} />
      </View>
      <Txt style={tw`mt-3 text-[17px] font-semibold text-fg`}>{title}</Txt>
      <Txt style={tw`mt-1 text-center text-[13px] leading-5 text-mute`}>{body}</Txt>
      {action && <View style={tw`mt-4 self-stretch`}>{action}</View>}
    </Card>
  );
}

function Tabs({ value, set }: { value: Section; set: (s: Section) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`-mx-4`} contentContainerStyle={tw`gap-1.5 px-4`}>
      {SECTIONS.map((s) => {
        const on = value === s.v;
        return (
          <Press key={s.v} onPress={() => set(s.v)} accessibilityState={{ selected: on }}
            style={tw`min-h-10 rounded-full border px-3.5 items-center justify-center ${on ? "border-raised bg-raised" : "border-line"}`}>
            <Txt style={tw`text-[13px] ${on ? "font-semibold text-fg" : "font-medium text-mute"}`}>{s.label}</Txt>
          </Press>
        );
      })}
    </ScrollView>
  );
}

const fmtN = (v: number) => v.toLocaleString("en-IN");

/** All-time totals across every scorer who backs up. Anonymous numbers only. */
function WorldCard() {
  const [w, setW] = useState<GullyWorld | null>(null);
  useEffect(() => { void fetchWorld().then(setW); }, []);
  if (!w) return null;
  const tiles: [string, number][] = [["Matches", w.matches], ["Runs", w.runs], ["Sixes", w.sixes], ["Wickets", w.wickets]];
  return (
    <ScoreHero>
      <Txt style={lbl}>Gully world, all time</Txt>
      <Board style={{ fontSize: 48, lineHeight: 54, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{fmtN(w.people)}</Board>
      <Txt style={tw`text-[13px] text-mute`}>scorers, {fmtN(w.active7)} active this week</Txt>
      <View style={tw`mt-3 flex-row border-t border-line pt-3`}>
        {tiles.map(([k, v]) => (
          <View key={k} style={tw`flex-1 items-center`}>
            <Num style={tw`text-[16px]`} numberOfLines={1} adjustsFontSizeToFit>{fmtN(v)}</Num>
            <Txt style={tw`mt-0.5 text-[11px] text-mute`}>{k}</Txt>
          </View>
        ))}
      </View>
      {w.best > 0 && <Txt style={tw`mt-3 text-[13px]`}>Highest individual score: <Txt style={tw`font-bold text-sun`}>{fmtN(w.best)}</Txt></Txt>}
      <Txt style={tw`mt-2 text-[11px] text-mute`}>Runs, sixes and wickets count the {fmtN(w.reporting)} scorers who have backed up since this card began.</Txt>
    </ScoreHero>
  );
}

const METRICS: [BoardMetric, string][] = [["matches", "Matches"], ["runs", "Runs"], ["sixes", "Sixes"], ["wickets", "Wickets"]];

/** Opt-in world leaderboard of scorers, by nickname. */
function WorldBoard() {
  const phone = useAccount((a) => a.phone);
  const [m, setM] = useState<BoardMetric>("matches");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [me, setMe] = useState<MyBoard | null>(null);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = () => { void fetchTop(m).then(setRows); void myBoard().then(setMe); };
  useEffect(load, [m, phone]);
  if (rows === null) return null;
  const rename = async () => { const e = await renameBoard(nick); setErr(e); if (!e) { setOpen(false); load(); } };
  const toggle = async () => { await showOnBoard(!me?.on); load(); };
  return (
    <Card>
      <Txt style={lbl}>World leaderboard</Txt>
      <View style={tw`mt-2 flex-row gap-1 rounded-full border border-line p-1`}>
        {METRICS.map(([k, l]) => (
          <Press key={k} onPress={() => setM(k)} style={tw`min-h-9 flex-1 items-center justify-center rounded-full ${m === k ? "bg-sun" : ""}`}>
            <Txt style={tw`text-[12px] font-semibold ${m === k ? "text-ink" : "text-mute"}`}>{l}</Txt>
          </Press>
        ))}
      </View>
      <View style={tw`mt-2`}>
        {rows.length === 0 && <Txt style={tw`py-3 text-center text-[13px] text-mute`}>The board fills as scorers back up their matches.</Txt>}
        {rows.map((r, i) => (
          <View key={r.nickname + i} style={tw`flex-row items-center gap-3 py-2 ${i ? "border-t border-line" : ""}`}>
            <Num style={tw`w-6 text-[16px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
            <Txt style={tw`flex-1 text-[15px] font-semibold ${r.nickname === me?.nickname ? "text-sun" : "text-fg"}`} numberOfLines={1}>{r.nickname}</Txt>
            <Num style={tw`text-[18px]`}>{fmtN(r[m])}</Num>
          </View>
        ))}
      </View>
      {!phone ? <Txt style={tw`mt-2 text-[12px] text-mute`}>Sign in from Home and your totals join the board under a made-up handle.</Txt>
        : me ? (
          <View style={tw`mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1`}>
            <Txt style={tw`text-[12px] text-mute`}>{me.on ? "You appear as" : "Hidden. Your handle is"} <Txt style={tw`text-[12px] font-semibold text-fg`}>{me.nickname}</Txt></Txt>
            <Press onPress={() => { setNick(me.nickname); setOpen(true); }}><Txt style={tw`text-[12px] font-semibold text-sun underline`}>Rename</Txt></Press>
            <Press onPress={() => void toggle()}><Txt style={tw`text-[12px] font-semibold text-mute underline`}>{me.on ? "Hide me" : "Show me"}</Txt></Press>
          </View>
        ) : <Txt style={tw`mt-2 text-[12px] text-mute`}>You'll appear after your next backup.</Txt>}
      {open && (
        <Sheet title="Rename on the leaderboard" onClose={() => setOpen(false)}>
          <Txt style={tw`text-[13px] leading-5 text-mute`}>Others see this name with your matches, runs, sixes and wickets. Never your number or player names.</Txt>
          <TextInput value={nick} onChangeText={setNick} maxLength={20} placeholderTextColor={C.mute} selectionColor={C.sun} autoCorrect={false}
            style={[tw`mt-3 min-h-12 rounded-2xl border border-line bg-panel px-4 text-[16px] text-fg`, { fontFamily: "Poppins_500Medium" }]} />
          {err && <Txt style={tw`mt-2 text-[13px] text-out`}>{err}</Txt>}
          <View style={tw`mt-4`}><GhostButton onPress={() => void rename()}><Txt style={tw`font-semibold text-sun`}>Save</Txt></GhostButton></View>
        </Sheet>
      )}
    </Card>
  );
}

function Overview({ d, fmt }: { d: BookData; fmt: Fmt }) {
  const { openPlayer } = useStore();
  if (!d.o.played) return <><Empty icon={BookOpen} title="The book is empty" body={emptyBook(fmt)} /><WorldCard /><WorldBoard /></>;
  const tiles: [string, number][] = [["Runs", d.o.runs], ["Sixes", d.o.sixes], ["Wickets", d.o.wickets], ["Ducks", d.o.ducks]];
  return (<>
    <ScoreHero>
      <Txt style={lbl}>Matches played</Txt>
      <View style={tw`mt-1 flex-row items-end justify-between gap-3`}>
        <Board style={{ fontSize: 60, lineHeight: 64 }} numberOfLines={1} adjustsFontSizeToFit>{d.o.played}</Board>
        {d.o.first != null && (
          <View style={tw`items-end pb-2`}>
            <Txt style={lbl}>Since</Txt>
            <Num style={tw`text-[13px] font-medium text-teal`}>{dateText(d.o.first)}</Num>
          </View>
        )}
      </View>
      <View style={tw`mt-3 flex-row border-t border-line pt-3`}>
        {tiles.map(([k, v], i) => (
          <View key={k} style={tw`flex-1 ${i ? "border-l border-line pl-3" : ""}`}>
            <Num style={tw`text-[18px] text-fg`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
            <Txt style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{k}</Txt>
          </View>
        ))}
      </View>
      {d.o.completed < d.o.played && <Txt style={tw`mt-3 text-[12px] text-mute`}>Totals count the {plural(d.o.completed, "finished match", "finished matches")}.</Txt>}
    </ScoreHero>
    {d.best ? (
      <Press onPress={() => openPlayer(d.best!.name)}>
        <Card style={tw`flex-row items-center gap-3`}>
          <Disc icon={Crown} lit />
          <View style={tw`flex-1 min-w-0`}>
            <Txt style={lbl}>Best player</Txt>
            <Txt style={tw`text-[17px] font-semibold text-fg`} numberOfLines={1}>{d.best.name}</Txt>
            <Txt style={tw`mt-0.5 text-[13px] leading-5 text-teal`}>{d.why}</Txt>
          </View>
          <ChevronRight size={18} color={C.mute} strokeWidth={2} />
        </Card>
      </Press>
    ) : (
      <Card style={tw`flex-row items-center gap-3`}>
        <Disc icon={Crown} />
        <View style={tw`flex-1`}>
          <Txt style={lbl}>Best player</Txt>
          <Txt style={tw`mt-0.5 text-[13px] leading-5 text-teal`}>Nobody has 3 finished matches yet. Play a few more and the crown goes to someone.</Txt>
        </View>
      </Card>
    )}
    <GhostButton onPress={() => { track(EV.share, { what: "book" }); void sendText(d.summary); }}>
      <View style={tw`flex-row items-center gap-2`}>
        <Share2 size={18} color={C.fg} strokeWidth={2} />
        <Txt style={tw`font-medium text-fg`}>Share the book</Txt>
      </View>
    </GhostButton>
    <WorldCard />
    <WorldBoard />
  </>);
}

function RecordsList({ d }: { d: BookData }) {
  const { go } = useStore();
  const rows = RECORD_ROWS.flatMap((r) => { const rec = d.rec[r.key]; return rec ? [{ r, rec }] : []; });
  if (!rows.length) return <Empty icon={Trophy} title="No records yet" body="Finish a match and the first records get set. Then the fun is breaking them." />;
  const speed = d.speed.filter((b) => b.rows.length);
  return (
    <View>
      {rows.map(({ r, rec }, i) => {
        const big = r.big(rec), detail = recordDetail(r, rec);
        return (
          <Press key={r.key} onPress={() => go("scorecard", rec.matchId)} accessibilityLabel={`${r.label}, open scorecard`} style={row(i === 0)}>
            <Disc icon={RECORD_ICON[r.key]} />
            <View style={tw`flex-1 min-w-0`}>
              <Txt style={lbl}>{r.label}</Txt>
              <View style={tw`flex-row items-baseline gap-1.5`}>
                <Txt style={tw`shrink text-[15px] font-medium text-fg`} numberOfLines={1}>{r.who(rec)}</Txt>
                <Num style={tw`text-[12px] font-medium text-mute`}>{dateText(rec.date)}</Num>
              </View>
              {detail && <Txt style={tw`text-[12px] text-mute`} numberOfLines={2}>{detail}</Txt>}
            </View>
            {big && <Num style={tw`text-[20px] text-fg`}>{big}</Num>}
            <ChevronRight size={16} color={C.mute} strokeWidth={2} />
          </Press>
        );
      })}
      {speed.length > 0 && (
        <View style={tw`mt-5`}>
          <SectionTitle>Fastest to career runs</SectionTitle>
          {speed.map((b, bi) => (
            <View key={b.runs} style={row(bi === 0)}>
              <Num style={tw`w-16 text-[22px] text-sun`}>{b.runs}</Num>
              <View style={tw`flex-1 min-w-0`}>
                {b.rows.map((r, i) => (
                  <Press key={r.name} onPress={() => go("scorecard", r.matchId)} style={tw`flex-row items-baseline justify-between gap-2 py-0.5`}>
                    <Txt style={tw`shrink text-[14px] ${i ? "text-mute" : "font-semibold text-fg"}`} numberOfLines={1}>{i + 1}. {r.name}</Txt>
                    <Num style={tw`text-[12px] ${i ? "text-mute" : "text-fg"}`}>{r.balls} balls · {plural(r.innings, "inning")}</Num>
                  </Press>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Milestones({ d }: { d: BookData }) {
  const { go } = useStore();
  if (!d.feed.length) return <Empty icon={Medal} title="No milestones yet" body="First 25s, fifties, hat-tricks and maidens show up here the moment someone gets one." />;
  return (<>
    <SectionTitle>Latest</SectionTitle>
    <View>
      {d.feed.slice(0, 8).map((f, i) => (
        <Press key={`${f.name}-${f.kind}`} onPress={() => go("scorecard", f.matchId)} style={row(i === 0)}>
          <Disc icon={Medal} lit={f.isNew} />
          <Txt style={tw`flex-1 text-[15px] font-medium text-fg`}>{f.line}</Txt>
          {f.isNew && <View style={tw`rounded-full bg-sun px-2 py-0.5`}><Txt style={tw`text-[11px] font-semibold text-ink`}>New</Txt></View>}
          <Num style={tw`text-[12px] font-medium text-mute`}>{dateText(f.date)}</Num>
        </Press>
      ))}
    </View>
    <View style={tw`mt-3`}><SectionTitle>By player</SectionTitle></View>
    <View>
      {d.ms.map((p, i) => (
        <View key={p.name} style={tw`py-3 ${i ? "border-t border-line" : ""}`}>
          <View style={tw`flex-row items-center gap-3`}>
            <Badge name={p.name} size={32} />
            <Txt style={tw`flex-1 text-[15px] font-semibold text-fg`} numberOfLines={1}>{p.name}</Txt>
            <Num style={tw`text-[12px] font-medium text-mute`}>{p.items.length}</Num>
          </View>
          <View style={tw`mt-2.5 flex-row flex-wrap gap-1.5`}>
            {p.items.map((it) => (
              <Press key={it.kind} onPress={() => go("scorecard", it.matchId)} style={tw`flex-row items-center gap-1.5 rounded-full border border-line bg-key px-3 py-1.5`}>
                <Txt style={tw`text-[13px] font-medium text-fg`}>{it.label}</Txt>
                {it.count > 1 && <Num style={tw`text-[12px] text-teal`}>×{it.count}</Num>}
                <Num style={tw`text-[11px] font-medium text-mute`}>{dateText(it.date)}</Num>
              </Press>
            ))}
          </View>
        </View>
      ))}
    </View>
  </>);
}

function Shame({ d }: { d: BookData }) {
  const { go } = useStore();
  if (!d.o.completed) return <Empty icon={Egg} title="Nothing to tease anyone about" body="Finish a match and the ducks, run-outs and wayward overs start piling up here. All in good fun." />;
  return (<>
    {SHAME.map((g) => {
      const rows = d.shame[g.key], I = SHAME_ICON[g.key];
      return (
        <View key={g.key} style={tw`mb-4`}>
          <View style={tw`flex-row items-center gap-2`}>
            <I size={16} color={C.teal} strokeWidth={2} />
            <Txt style={tw`text-[15px] font-semibold text-fg`}>{g.title}</Txt>
          </View>
          <Txt style={tw`mt-0.5 mb-1 text-[12px] leading-4 text-mute`}>{g.blurb}</Txt>
          {rows.map((r, i) => (
            <Press key={r.name} disabled={!r.matchId} haptic={!!r.matchId} onPress={() => r.matchId && go("scorecard", r.matchId)}
              style={[row(i === 0), { opacity: 1 }]}>
              <Num style={tw`w-5 text-[13px] text-mute`}>{i + 1}</Num>
              <View style={tw`flex-1 min-w-0`}>
                <Txt style={tw`text-[15px] font-medium text-fg`} numberOfLines={1}>{r.name}</Txt>
                {!!r.text && <Num style={tw`text-[11px] font-medium text-mute`} numberOfLines={1}>{r.text}{r.date ? `  ${dateText(r.date)}` : ""}</Num>}
              </View>
              <Num style={tw`text-[17px] text-fg`}>{r.value}</Num>
              <Txt style={tw`w-16 text-[12px] text-mute`} numberOfLines={1}>{g.unit(r.value).replace(/^\d+ /, "")}</Txt>
            </Press>
          ))}
          {!rows.length && <Txt style={tw`py-2 text-[13px] text-teal`}>{g.empty}</Txt>}
        </View>
      );
    })}
  </>);
}

function Pair({ k, now, best }: { k: string; now: number; best: number }) {
  return (
    <View style={tw`w-[74px] items-end`}>
      <Txt style={tw`text-[11px] text-mute`}>{k}</Txt>
      <View style={tw`flex-row items-baseline`}>
        <Num style={tw`text-[17px] text-fg`}>{now}</Num>
        <Num style={tw`text-[12px] font-medium text-mute`}> / {best}</Num>
      </View>
    </View>
  );
}

function Streaks({ d }: { d: BookData }) {
  const { go, openPlayer } = useStore();
  const players = d.players.filter((p) => p.tens.best || p.wickets.best);
  const teams = [...d.teams].sort((a, b) => b.best - a.best || b.current - a.current);
  return (<>
    <SectionTitle>Players</SectionTitle>
    <Txt style={tw`-mt-1 mb-1 text-[12px] leading-4 text-mute`}>Matches in a row with 10 or more runs, and with a wicket. Now / best. Sitting a match out does not break it.</Txt>
    {players.length ? (
      <View>
        {players.map((p, i) => (
          <Press key={p.name} onPress={() => openPlayer(p.name)} style={row(i === 0)}>
            <Num style={tw`w-5 text-[13px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
            <Txt style={tw`flex-1 text-[15px] font-medium text-fg`} numberOfLines={1}>{p.name}</Txt>
            <Pair k="10+ runs" now={p.tens.current} best={p.tens.best} />
            <Pair k="Wickets" now={p.wickets.current} best={p.wickets.best} />
          </Press>
        ))}
      </View>
    ) : <Empty icon={Flame} title="No streaks yet" body="Score 10 or more, or take a wicket, in a finished match to start one." />}
    <View style={tw`mt-4`}><SectionTitle>Saved teams</SectionTitle></View>
    {teams.length ? (
      <View>
        {teams.map((t, i) => (
          <View key={t.name} style={row(i === 0)}>
            <Badge name={t.name} size={32} />
            <View style={tw`flex-1 min-w-0`}>
              <Txt style={tw`text-[15px] font-medium text-fg`} numberOfLines={1}>{t.name}</Txt>
              <Txt style={tw`text-[12px] text-mute`}>{t.current > 1 ? `Won the last ${t.current} in a row` : t.current ? "Won the last match" : "No win streak going"}</Txt>
            </View>
            <View style={tw`items-end`}>
              <Txt style={tw`text-[11px] text-mute`}>Best</Txt>
              <Num style={tw`text-[17px] ${i === 0 && t.best ? "text-sun" : "text-fg"}`}>{t.best}</Num>
            </View>
          </View>
        ))}
      </View>
    ) : <Empty icon={Users} title="No saved teams" body="Save your teams and their winning runs show up here." action={<GhostButton onPress={() => go("teams")}>Go to teams</GhostButton>} />}
  </>);
}

function PickSheet({ title, names, onPick, onClose }: { title: string; names: string[]; onPick: (n: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = names.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet title={title} onClose={onClose}>
      {names.length > 8 && (
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={C.mute} selectionColor={C.sun}
          style={[tw`mb-2 min-h-12 rounded-[16px] border border-line bg-panel px-4 text-[15px]`, { color: C.fg, fontFamily: "Inter_500Medium" }]} />
      )}
      {list.map((n, i) => (
        <Press key={n} onPress={() => { onPick(n); onClose(); }} style={[row(i === 0), tw`min-h-12`]}>
          <Badge name={n} size={32} />
          <Txt style={tw`flex-1 text-[15px] font-medium text-fg`} numberOfLines={1}>{n}</Txt>
        </Press>
      ))}
      {!list.length && <Txt style={tw`py-4 text-center text-[13px] text-mute`}>No one by that name.</Txt>}
    </Sheet>
  );
}

function Pickers({ a, b, setA, setB, names, what, onPair }: { a: string | null; b: string | null; setA: (n: string) => void; setB: (n: string) => void; names: string[]; what: string; onPair: () => void }) {
  const [open, setOpen] = useState<"a" | "b" | null>(null);
  const slot = (v: string | null, k: "a" | "b") => (
    <Press onPress={() => setOpen(k)} accessibilityLabel={v ? `Change ${v}` : `Pick ${what}`}
      style={tw`min-h-14 flex-1 flex-row items-center gap-2 rounded-[18px] border border-line bg-panel px-3`}>
      {v ? <><Badge name={v} size={28} /><Txt style={tw`flex-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{v}</Txt></>
        : <Txt style={tw`text-[14px] text-mute`}>Pick {what}</Txt>}
    </Press>
  );
  return (<>
    <View style={tw`flex-row items-center gap-2`}>
      {slot(a, "a")}
      <IconButton icon={ArrowLeftRight} label="Swap" size={40} onPress={() => { if (a && b) { setA(b); setB(a); } }} />
      {slot(b, "b")}
    </View>
    {open && <PickSheet title={`Pick ${what}`} names={names.filter((n) => n !== (open === "a" ? b : a))}
      onPick={(n) => { (open === "a" ? setA : setB)(n); if (open === "a" ? b : a) onPair(); }} onClose={() => setOpen(null)} />}
  </>);
}

function DuelCard({ x }: { x: Duel }) {
  const stats: [string, string][] = [[`${x.runs}`, `runs off ${plural(x.balls, "ball")}`], [`${x.dismissals}`, x.dismissals === 1 ? "dismissal" : "dismissals"], [x.strikeRate.toFixed(0), "strike rate"]];
  return (
    <Card>
      <Txt style={lbl}>{x.batter} batting to {x.bowler}</Txt>
      {x.balls || x.dismissals ? (
        <View style={tw`mt-3 flex-row`}>
          {stats.map(([v, k], i) => (
            <View key={k} style={tw`flex-1 ${i ? "border-l border-line pl-3" : ""}`}>
              <Num style={tw`text-[24px] text-fg`}>{v}</Num>
              <Txt style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{k}</Txt>
            </View>
          ))}
        </View>
      ) : <Txt style={tw`mt-1 text-[13px] text-teal`}>{x.batter} has not faced {x.bowler} yet.</Txt>}
    </Card>
  );
}

function HeadToHead({ fmt }: { fmt: Fmt }) {
  const { matches, teams } = useStore();
  const names = useMemo(() => playerPool(matches, teams), [matches, teams]);
  const [a, setA] = useState<string | null>(null), [b, setB] = useState<string | null>(null);
  const h = useMemo(() => (a && b ? headToHead(matches, a, b, fmt) : null), [matches, a, b, fmt]);
  if (names.length < 2) return <Empty icon={Swords} title="Need two players" body="Name your players when you set up a match, then pit any two against each other here." />;
  return (<>
    <Pickers a={a} b={b} setA={setA} setB={setB} names={names} what="a player" onPair={() => track(EV.head_to_head)} />
    {h ? <><DuelCard x={h.aBatting} /><DuelCard x={h.bBatting} /></>
      : <Txt style={tw`pt-4 text-center text-[13px] text-mute`}>Pick two players to see who has the upper hand, bat against ball, both ways.</Txt>}
  </>);
}

function RivalryView({ fmt }: { fmt: Fmt }) {
  const { matches, teams, go } = useStore();
  const names = teams.map((t) => t.name);
  const [a, setA] = useState<string | null>(names[0] ?? null), [b, setB] = useState<string | null>(names[1] ?? null);
  const r = useMemo(() => (a && b ? rivalry(matches, a, b, fmt) : null), [matches, a, b, fmt]);
  if (names.length < 2) return <Empty icon={Handshake} title="Save two teams first" body="A rivalry needs two saved teams. Save them on the Teams tab and their record against each other lands here."
    action={<GhostButton onPress={() => go("teams")}>Go to teams</GhostButton>} />;
  const biggest = (x: Rec | null, y: Rec | null) => [x?.text, y?.text].filter(Boolean).join(". ") || "No wins yet";
  const side = (n: string, won: number, lead: boolean) => (
    <View style={tw`flex-1 items-center`}>
      <Txt style={tw`text-[13px] text-teal`} numberOfLines={1}>{n}</Txt>
      <Num style={[tw`text-[44px] ${lead ? "text-sun" : "text-fg"}`, { lineHeight: 50 }]}>{won}</Num>
    </View>
  );
  return (<>
    <Pickers a={a} b={b} setA={setA} setB={setB} names={names} what="a team" onPair={() => track(EV.rivalry)} />
    {r && (r.played ? (<>
      <ScoreHero>
        <View style={tw`flex-row items-center`}>
          {side(r.a, r.wonA, r.wonA > r.wonB)}
          <Txt style={lbl}>wins</Txt>
          {side(r.b, r.wonB, r.wonB > r.wonA)}
        </View>
        <Txt style={tw`mt-2 text-center text-[12px] text-mute`}>{plural(r.played, "match", "matches")} played{r.tied ? `, ${plural(r.tied, "tie")}` : ""}{r.drawn ? `, ${plural(r.drawn, "draw")}` : ""}</Txt>
      </ScoreHero>
      <View style={tw`mt-1`}><SectionTitle>{`Last ${r.last5.length}`}</SectionTitle></View>
      <View>
        {r.last5.map((x, i) => (
          <Press key={x.matchId} onPress={() => go("scorecard", x.matchId)} style={row(i === 0)}>
            {x.winner ? <Badge name={x.winner} size={30} /> : <Disc icon={Handshake} />}
            <Txt style={tw`flex-1 text-[14px] font-medium text-fg`}>{x.text}</Txt>
            <Num style={tw`text-[12px] font-medium text-mute`}>{dateText(x.date)}</Num>
          </Press>
        ))}
      </View>
      <Card>
        <Txt style={lbl}>Biggest win for {r.a}</Txt>
        <Txt style={tw`mt-0.5 text-[14px] text-fg`}>{biggest(r.biggestA.byRuns, r.biggestA.byWickets)}</Txt>
        <Txt style={[lbl, tw`mt-3`]}>Biggest win for {r.b}</Txt>
        <Txt style={tw`mt-0.5 text-[14px] text-fg`}>{biggest(r.biggestB.byRuns, r.biggestB.byWickets)}</Txt>
      </Card>
    </>) : <Txt style={tw`pt-4 text-center text-[13px] leading-5 text-mute`}>{r.a} and {r.b} have not finished a {fmt === "test" ? "Test" : "limited-overs"} match against each other yet. Time to settle it.</Txt>)}
  </>);
}

export default function Book() {
  useEffect(() => { markBookSeen(); }, []);
  const { matches, teams, fmt, go } = useStore();
  const [sec, setSec] = useState<Section>("overview");
  const d = useMemo(() => bookData(matches, teams, fmt), [matches, teams, fmt]);
  return (
    <Page>
      <Header title="Gully Book" back={() => go("home")} />
      <View style={tw`gap-3 px-4 pt-2`}>
        <FmtSwitch value={fmt} set={(v) => useStore.setState({ fmt: v })} />
        <Tabs value={sec} set={(s) => { track(EV.book_section, { section: s }); setSec(s); }} />
        {sec === "overview" && <Overview d={d} fmt={fmt} />}
        {sec === "records" && <RecordsList d={d} />}
        {sec === "milestones" && <Milestones d={d} />}
        {sec === "shame" && <Shame d={d} />}
        {sec === "streaks" && <Streaks d={d} />}
        {sec === "h2h" && <HeadToHead fmt={fmt} />}
        {sec === "rivalry" && <RivalryView fmt={fmt} />}
      </View>
    </Page>
  );
}
