import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ScrollView, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ArrowLeftRight, ChevronLeft, Share2 } from "lucide-react-native";
import { headToHead, rivalry, type Duel, type Rec } from "@shared/records";
import { playerPool, type Fmt } from "@shared/stats";
import {
  bookData, dateText, emptyBook, plural, recordDetail, recordGroups, SECTIONS, SHAME, SHAME_FIRST, shameLead, TOP_METRICS,
  type BookData, type Section, type ShameGroup, type TopMetric,
} from "@shared/screens/book/book";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { sendText } from "@/lib/share";
import { markBookSeen } from "@/ui/guide";
import { fetchTop, fetchWorld, myBoard, renameBoard, showOnBoard, useAccount, type BoardMetric, type BoardRow, type MyBoard } from "@/lib/account";
import type { GullyWorld } from "@shared/globalStats";
import { Badge, C, Card, GhostButton, IconButton, Num, Press, Segmented, Sheet, tw, Txt } from "@/ui/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const lbl = [tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }];
const rowCls = (first: boolean) => tw`flex-row w-full items-center gap-3 ${first ? "" : "border-t border-line"}`;
const fmtN = (v: number) => v.toLocaleString("en-IN");
type Pair = [string, string];

/** One quiet card per section when there is nothing to show yet. */
function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={tw`items-center py-6`}>
      <Txt style={tw`text-[16px] font-semibold text-fg`}>{title}</Txt>
      <Txt style={tw`mt-1 text-center text-[13px] leading-5 text-mute`}>{body}</Txt>
      {action && <View style={tw`mt-4 self-stretch`}>{action}</View>}
    </Card>
  );
}

function More({ open, set, more, less }: { open: boolean; set: (v: boolean) => void; more: string; less: string }) {
  return (
    <Press onPress={() => set(!open)} accessibilityState={{ expanded: open }} style={tw`min-h-11 justify-center self-start px-1`}>
      <Txt style={tw`text-[14px] font-semibold text-sun`}>{open ? less : more}</Txt>
    </Press>
  );
}

function Block({ id, title, y, children }: { id: Section; title: string; y: (id: Section, v: number) => void; children: ReactNode }) {
  return (
    <View onLayout={(e: LayoutChangeEvent) => y(id, e.nativeEvent.layout.y)} style={tw`gap-3 pt-8`}>
      <Txt style={tw`px-1 text-[20px] font-bold text-fg`}>{title}</Txt>
      {children}
    </View>
  );
}

/** All-time totals across every scorer who backs up. Anonymous numbers only. */
function WorldCard() {
  const [w, setW] = useState<GullyWorld | null>(null);
  useEffect(() => { void fetchWorld().then(setW); }, []);
  if (!w) return null;
  const tiles: [string, number][] = [["Matches", w.matches], ["Runs", w.runs], ["Sixes", w.sixes], ["Wickets", w.wickets]];
  return (
    <Card>
      <Txt style={lbl}>Gully world, all time</Txt>
      <Num style={tw`mt-1 text-[44px]`} numberOfLines={1} adjustsFontSizeToFit>{fmtN(w.people)}</Num>
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
      <Txt style={tw`mt-2 text-[11px] text-mute`}>Runs, sixes and wickets cover the {fmtN(w.reporting)} scorers who have scored matches.</Txt>
    </Card>
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
            <Txt style={tw`flex-1 text-[15px] font-semibold ${r.me ? "text-sun" : "text-fg"}`} numberOfLines={1}>{r.nickname}</Txt>
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

function Summary({ d }: { d: BookData }) {
  const tiles: [string, number][] = [["Matches", d.o.played], ["Runs", d.o.runs], ["Sixes", d.o.sixes], ["Wickets", d.o.wickets], ["Ducks", d.o.ducks]];
  return (
    <Card style={tw`p-3`}>
      <View style={tw`flex-row`}>
        {tiles.map(([k, v]) => (
          <View key={k} style={tw`flex-1 items-center`}>
            <Num style={tw`text-[18px]`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
            <Txt style={tw`text-[11px] font-medium text-mute`}>{k}</Txt>
          </View>
        ))}
      </View>
      {(d.o.first != null || d.o.completed < d.o.played) && (
        <Txt style={tw`mt-2 text-center text-[12px] text-mute`}>
          {d.o.first != null ? `Since ${dateText(d.o.first)}. ` : ""}
          {d.o.completed < d.o.played ? `Totals count the ${plural(d.o.completed, "finished match", "finished matches")}.` : ""}
        </Txt>
      )}
    </Card>
  );
}

/** Label, big number and holder. The top opens the scorecard, the name opens the player. */
function Tile({ title, big, detail, who, matchId, player }: { title: string; big: string | null; detail?: string | null; who: string; matchId: string; player?: string }) {
  const { go, openPlayer } = useStore();
  return (
    <View style={[tw`rounded-2xl border border-line bg-panel`, { flexBasis: "48%", flexGrow: 1, maxWidth: "50%" }]}>
      <Press onPress={() => go("scorecard", matchId)} accessibilityLabel={`${title}, open scorecard`} style={tw`px-3 pt-3`}>
        <Txt style={lbl}>{title}</Txt>
        {big && <Num style={tw`text-[24px]`} numberOfLines={1} adjustsFontSizeToFit>{big}</Num>}
        {detail && <Txt style={tw`text-[12px] text-mute`} numberOfLines={2}>{detail}</Txt>}
      </Press>
      {player ? (
        <Press onPress={() => openPlayer(player)} style={tw`min-h-11 flex-row items-center gap-2 px-3 pb-2`}>
          <Badge name={player} size={20} />
          <Txt style={tw`flex-1 text-[13px] font-medium text-fg`} numberOfLines={1}>{who}</Txt>
        </Press>
      ) : <Txt style={tw`px-3 pb-3 pt-1 text-[13px] font-medium text-mute`} numberOfLines={1}>{who}</Txt>}
    </View>
  );
}

function Leaderboard({ d }: { d: BookData }) {
  const { openPlayer } = useStore();
  const [metric, setMetric] = useState<TopMetric>("rating");
  const rows = d.tops[metric];
  const first = rows[0], why = metric === "rating" && d.best && first && d.best.name === first.name ? d.why : null;
  return (
    <View style={tw`gap-2`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`-mx-4`} contentContainerStyle={tw`gap-1.5 px-4`}>
        {TOP_METRICS.map((t) => (
          <Press key={t.v} onPress={() => setMetric(t.v)} accessibilityState={{ selected: metric === t.v }}
            style={tw`min-h-11 items-center justify-center rounded-full border px-4 ${metric === t.v ? "border-raised bg-raised" : "border-line"}`}>
            <Txt style={tw`text-[14px] ${metric === t.v ? "font-semibold text-fg" : "font-medium text-mute"}`}>{t.label}</Txt>
          </Press>
        ))}
      </ScrollView>
      {first ? (<>
        <Press onPress={() => openPlayer(first.name)} style={tw`flex-row items-center gap-3 rounded-2xl bg-sun p-4`}>
          <Num style={[tw`w-7 text-[30px]`, { color: C.ink }]}>1</Num>
          <Badge name={first.name} size={44} />
          <View style={tw`min-w-0 flex-1`}>
            <Txt style={tw`text-[17px] font-bold text-ink`} numberOfLines={1}>{first.name}</Txt>
            <Txt style={[tw`text-[12px] font-medium`, { color: "rgba(17,17,17,0.7)" }]} numberOfLines={2}>{why ?? first.sub}</Txt>
          </View>
          <Num style={[tw`text-[34px]`, { color: C.ink }]}>{first.value}</Num>
        </Press>
        <View>
          {rows.slice(1).map((r, i) => (
            <Press key={r.name} onPress={() => openPlayer(r.name)} style={[rowCls(i === 0), tw`min-h-14 px-1`]}>
              <Num style={tw`w-7 text-[16px] text-mute`}>{r.rank}</Num>
              <Badge name={r.name} size={32} />
              <View style={tw`min-w-0 flex-1`}>
                <Txt style={tw`text-[15px] font-semibold text-fg`} numberOfLines={1}>{r.name}</Txt>
                <Txt style={tw`text-[12px] text-mute`}>{r.sub}</Txt>
              </View>
              <Num style={tw`text-[20px]`}>{r.value}</Num>
            </Press>
          ))}
        </View>
      </>) : <Txt style={tw`py-3 text-center text-[13px] text-mute`}>Nobody on this board yet.</Txt>}
    </View>
  );
}

function Fame({ d, fmt }: { d: BookData; fmt: Fmt }) {
  const { go, openPlayer } = useStore();
  const [fast, setFast] = useState(false);
  if (!d.o.played) return <Empty title="The book is empty" body={emptyBook(fmt)} />;
  const heroes = d.heroes.filter((h) => h.key !== "best" && h.matchId);
  const groups = recordGroups(d.rec);
  const speed = d.speed.filter((b) => b.rows.length);
  return (<>
    <Leaderboard d={d} />
    {heroes.length > 0 && (
      <View style={tw`flex-row flex-wrap gap-2`}>
        {heroes.map((h) => <Tile key={h.key} title={h.label} big={h.big} who={h.who} matchId={h.matchId!} player={h.who} />)}
      </View>
    )}
    {groups.map((g) => (
      <View key={g.title}>
        <Txt style={[...lbl, tw`mb-2 px-1`]}>{g.title}</Txt>
        <View style={tw`flex-row flex-wrap gap-2`}>
          {g.tiles.map(({ row, rec }) => (
            <Tile key={row.key} title={row.label} big={row.big(rec)} detail={recordDetail(row, rec)} who={`${row.who(rec)}, ${dateText(rec.date)}`}
              matchId={rec.matchId} player={row.player ? rec.name : undefined} />
          ))}
        </View>
      </View>
    ))}
    {!groups.length && !heroes.length && <Empty title="No records yet" body="Finish a match and the first records get set. Then the fun is breaking them." />}
    {speed.length > 0 && (<>
      <More open={fast} set={setFast} more="Fastest to career runs" less="Hide fastest to career runs" />
      {fast && (
        <Card style={tw`py-1`}>
          {speed.map((b, bi) => (
            <View key={b.runs} style={[rowCls(bi === 0), tw`items-start py-3`]}>
              <Num style={tw`w-14 text-[22px]`}>{b.runs}</Num>
              <View style={tw`min-w-0 flex-1`}>
                {b.rows.map((r, i) => (
                  <View key={r.name} style={tw`flex-row items-center justify-between gap-2`}>
                    <Press onPress={() => openPlayer(r.name)} style={tw`min-h-9 shrink justify-center`}>
                      <Txt style={tw`text-[14px] ${i ? "text-mute" : "font-semibold text-fg"}`} numberOfLines={1}>{i + 1}. {r.name}</Txt>
                    </Press>
                    <Press onPress={() => go("scorecard", r.matchId)} style={tw`min-h-9 justify-center`}>
                      <Num style={tw`text-[12px] font-medium text-mute`}>{r.balls} balls, {plural(r.innings, "inning")}</Num>
                    </Press>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>
      )}
    </>)}
  </>);
}

function ShameCard({ g, d }: { g: ShameGroup; d: BookData }) {
  const { go, openPlayer } = useStore();
  const [open, setOpen] = useState(false);
  const rows = d.shame[g.key], line = shameLead(g, rows);
  return (
    <Card>
      <Txt style={tw`text-[16px] font-bold text-fg`}>{g.title}</Txt>
      <Txt style={tw`text-[12px] leading-4 text-mute`}>{g.blurb}</Txt>
      {line ? (
        <Press onPress={() => openPlayer(rows[0].name)} style={tw`mt-2 min-h-11 justify-center`}>
          <Txt style={tw`text-[15px] font-semibold text-fg`}>{line}</Txt>
        </Press>
      ) : <Txt style={tw`mt-2 text-[13px] text-mute`}>{g.empty}</Txt>}
      {rows.length > 1 && <More open={open} set={setOpen} more="Show more" less="Show less" />}
      {open && rows.slice(1).map((r, i) => (
        <View key={r.name} style={tw`flex-row items-center gap-3 border-t border-line py-1`}>
          <Num style={tw`w-5 text-[13px] text-mute`}>{i + 2}</Num>
          <View style={tw`min-w-0 flex-1`}>
            <Press onPress={() => openPlayer(r.name)} style={tw`min-h-9 justify-center self-start`}>
              <Txt style={tw`text-[15px] font-medium text-fg`} numberOfLines={1}>{r.name}</Txt>
            </Press>
            {!!r.text && (r.matchId
              ? <Press onPress={() => go("scorecard", r.matchId!)}><Num style={tw`text-[11px] font-medium text-mute`} numberOfLines={1}>{r.text}{r.date ? `, ${dateText(r.date)}` : ""}</Num></Press>
              : <Num style={tw`text-[11px] font-medium text-mute`} numberOfLines={1}>{r.text}{r.date ? `, ${dateText(r.date)}` : ""}</Num>)}
          </View>
          <Txt style={tw`text-[13px] font-semibold text-fg`}>{g.unit(r.value)}</Txt>
        </View>
      ))}
    </Card>
  );
}

function Shame({ d }: { d: BookData }) {
  const [all, setAll] = useState(false);
  if (!d.o.completed) return <Empty title="Nothing to tease anyone about" body="Finish a match and the ducks, run-outs and wayward overs start piling up here. All in good fun." />;
  const groups = SHAME.filter((g) => all || SHAME_FIRST.includes(g.key));
  return (<>
    {groups.map((g) => <ShameCard key={g.key} g={g} d={d} />)}
    <More open={all} set={setAll} more="More groups" less="Fewer groups" />
  </>);
}

function Pairing({ k, now, best }: { k: string; now: number; best: number }) {
  return (
    <View style={tw`w-[72px] items-end`}>
      <Txt style={tw`text-[11px] text-mute`}>{k}</Txt>
      <View style={tw`flex-row items-baseline`}>
        <Num style={tw`text-[17px] text-fg`}>{now}</Num>
        <Num style={tw`text-[12px] font-medium text-mute`}> / {best}</Num>
      </View>
    </View>
  );
}

function Streaks({ d }: { d: BookData }) {
  const { openPlayer } = useStore();
  const [all, setAll] = useState(false);
  const players = d.players.filter((p) => p.tens.best || p.wickets.best);
  const teams = [...d.teams].filter((t) => t.best).sort((a, b) => b.best - a.best || b.current - a.current);
  if (!players.length && !teams.length) return <Empty title="No streaks yet" body="Score 10 or more, or take a wicket, in a finished match to start one. Save your teams to track win streaks." />;
  return (<>
    {players.length > 0 && (
      <Card>
        <Txt style={tw`mb-1 text-[12px] leading-4 text-mute`}>Matches in a row with 10 or more runs, and with a wicket. Now / best. Sitting out a match does not break it.</Txt>
        {(all ? players : players.slice(0, 5)).map((p, i) => (
          <Press key={p.name} onPress={() => openPlayer(p.name)} style={[rowCls(i === 0), tw`min-h-12`]}>
            <Num style={tw`w-5 text-[13px] text-mute`}>{i + 1}</Num>
            <Txt style={tw`flex-1 text-[15px] font-semibold text-fg`} numberOfLines={1}>{p.name}</Txt>
            <Pairing k="10+ runs" now={p.tens.current} best={p.tens.best} />
            <Pairing k="Wickets" now={p.wickets.current} best={p.wickets.best} />
          </Press>
        ))}
        {players.length > 5 && <More open={all} set={setAll} more={`Show all ${players.length}`} less="Show fewer" />}
      </Card>
    )}
    {teams.length > 0 && (
      <View style={tw`flex-row flex-wrap gap-2`}>
        {teams.map((t) => (
          <View key={t.name} style={tw`flex-row items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-1.5 pr-3`}>
            <Badge name={t.name} size={24} />
            <Txt style={tw`text-[14px] font-medium text-fg`}>{t.name}</Txt>
            <Txt style={tw`text-[12px] text-mute`}>best {t.best}{t.current > 1 ? `, now ${t.current}` : ""}</Txt>
          </View>
        ))}
      </View>
    )}
  </>);
}

type Pick = { slots: 1; at: 0 | 1 } | { slots: 2 };

/** The one sheet behind both pickers: tap one name to replace a slot, or two names to set the pair. */
function PickSheet({ title, names, exclude, slots, onDone, onClose }: { title: string; names: string[]; exclude: string[]; slots: 1 | 2; onDone: (picked: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const left = names.filter((x) => !exclude.includes(x) && !chosen.includes(x));
  const list = left.filter((x) => x.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (x: string) => {
    const next = [...chosen, x];
    if (next.length === slots) { onDone(next); onClose(); } else setChosen(next);
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {slots === 2 && <Txt style={tw`mb-2 text-[13px] text-mute`}>{chosen.length ? `${chosen[0]} and ...` : "Tap the first, then the second."}</Txt>}
      {names.length > 8 && (
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={C.mute} selectionColor={C.sun}
          style={[tw`mb-2 min-h-12 rounded-[16px] border border-line bg-panel px-4 text-[15px]`, { color: C.fg, fontFamily: "Poppins_500Medium" }]} />
      )}
      {list.map((x, i) => (
        <Press key={x} onPress={() => pick(x)} style={[rowCls(i === 0), tw`min-h-12 py-2`]}>
          <Badge name={x} size={32} />
          <Txt style={tw`flex-1 text-[15px] font-medium text-fg`} numberOfLines={1}>{x}</Txt>
        </Press>
      ))}
      {!list.length && <Txt style={tw`py-4 text-center text-[13px] text-mute`}>No one by that name.</Txt>}
    </Sheet>
  );
}

function PairRow({ pair, names, what, set }: { pair: Pair | null; names: string[]; what: string; set: (p: Pair) => void }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const slot = (v: string | undefined, at: 0 | 1) => (
    <Press onPress={() => setPick({ slots: 1, at })} accessibilityLabel={v ? `Change ${v}` : `Pick ${what}`}
      style={tw`min-h-14 flex-1 flex-row items-center gap-2 rounded-[18px] border border-line bg-panel px-3`}>
      {v ? <><Badge name={v} size={28} /><Txt style={tw`flex-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{v}</Txt></>
        : <Txt style={tw`text-[14px] text-mute`}>Pick {what}</Txt>}
    </Press>
  );
  const apply = (got: string[]) => {
    if (pick?.slots === 2) set([got[0], got[1]]);
    else if (pick && pair) set(pick.at === 0 ? [got[0], pair[1]] : [pair[0], got[0]]);
  };
  return (<>
    <View style={tw`flex-row items-center gap-2`}>
      {slot(pair?.[0], 0)}
      <IconButton icon={ArrowLeftRight} label="Swap" size={40} onPress={() => { if (pair) set([pair[1], pair[0]]); }} />
      {slot(pair?.[1], 1)}
    </View>
    <Press onPress={() => setPick({ slots: 2 })} style={tw`min-h-11 justify-center self-start px-1`}>
      <Txt style={tw`text-[14px] font-semibold text-sun`}>Pick two {what}s</Txt>
    </Press>
    {pick && <PickSheet title={pick.slots === 2 ? `Pick two ${what}s` : `Pick ${what}`} names={names} slots={pick.slots} onDone={apply} onClose={() => setPick(null)}
      exclude={pick.slots === 1 && pair ? [pair[pick.at === 0 ? 1 : 0]] : []} />}
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
      ) : <Txt style={tw`mt-1 text-[13px] text-mute`}>{x.batter} has not faced {x.bowler} yet.</Txt>}
    </Card>
  );
}

function Rivals({ d, fmt }: { d: BookData; fmt: Fmt }) {
  const { matches, teams, go } = useStore();
  const players = useMemo(() => playerPool(matches, teams), [matches, teams]);
  const teamNames = teams.map((t) => t.name);
  const [duelPick, setDuelPick] = useState<Pair | null>(null), [teamPick, setTeamPick] = useState<Pair | null>(null);
  const duel = duelPick ?? d.duel, rival = teamPick ?? d.rival;
  const h = useMemo(() => (duel ? headToHead(matches, duel[0], duel[1], fmt) : null), [matches, duel, fmt]);
  const r = useMemo(() => (rival ? rivalry(matches, rival[0], rival[1], fmt) : null), [matches, rival, fmt]);
  const canDuel = players.length >= 2, canRival = teamNames.length >= 2;
  if (!canDuel && !canRival) {
    return <Empty title="Nothing to compare yet" body="Name your players when you set up a match, or save two teams, and head to head and rivalries land here."
      action={<GhostButton onPress={() => go("teams")}>Go to teams</GhostButton>} />;
  }
  const biggest = (x: Rec | null, y: Rec | null) => [x?.text, y?.text].filter(Boolean).join(". ") || "No wins yet";
  const side = (n: string, won: number, lead: boolean) => (
    <View style={tw`flex-1 items-center`}>
      <Txt style={tw`text-[13px] text-teal`} numberOfLines={1}>{n}</Txt>
      <Num style={[tw`text-[44px] ${lead ? "text-sun" : "text-fg"}`, { lineHeight: 50 }]}>{won}</Num>
    </View>
  );
  return (<>
    {canDuel && (<>
      <Txt style={[...lbl, tw`px-1`]}>Head to head</Txt>
      <PairRow pair={duel} names={players} what="player" set={(p) => { track(EV.head_to_head); setDuelPick(p); }} />
      {h ? <><DuelCard x={h.aBatting} /><DuelCard x={h.bBatting} /></>
        : <Txt style={tw`text-center text-[13px] text-mute`}>Pick two players to see who has the upper hand, bat against ball, both ways.</Txt>}
    </>)}
    {canRival && (<>
      <Txt style={[...lbl, tw`px-1 pt-3`]}>Team rivalry</Txt>
      <PairRow pair={rival} names={teamNames} what="team" set={(p) => { track(EV.rivalry); setTeamPick(p); }} />
      {r && (r.played ? (<>
        <Card>
          <View style={tw`flex-row items-center`}>
            {side(r.a, r.wonA, r.wonA > r.wonB)}
            <Txt style={lbl}>wins</Txt>
            {side(r.b, r.wonB, r.wonB > r.wonA)}
          </View>
          <Txt style={tw`mt-2 text-center text-[12px] text-mute`}>{plural(r.played, "match", "matches")} played{r.tied ? `, ${plural(r.tied, "tie")}` : ""}{r.drawn ? `, ${plural(r.drawn, "draw")}` : ""}</Txt>
        </Card>
        <Card style={tw`py-1`}>
          {r.last5.map((x, i) => (
            <Press key={x.matchId} onPress={() => go("scorecard", x.matchId)} style={[rowCls(i === 0), tw`py-3`]}>
              {x.winner ? <Badge name={x.winner} size={30} /> : <View style={tw`h-[30px] w-[30px] items-center justify-center rounded-full bg-key`}><Txt style={tw`text-[12px] font-bold text-mute`}>=</Txt></View>}
              <Txt style={tw`flex-1 text-[14px] font-medium text-fg`}>{x.text}</Txt>
              <Num style={tw`text-[12px] font-medium text-mute`}>{dateText(x.date)}</Num>
            </Press>
          ))}
        </Card>
        <Card>
          <Txt style={lbl}>Biggest win for {r.a}</Txt>
          <Txt style={tw`mt-0.5 text-[14px] text-fg`}>{biggest(r.biggestA.byRuns, r.biggestA.byWickets)}</Txt>
          <Txt style={[...lbl, tw`mt-3`]}>Biggest win for {r.b}</Txt>
          <Txt style={tw`mt-0.5 text-[14px] text-fg`}>{biggest(r.biggestB.byRuns, r.biggestB.byWickets)}</Txt>
        </Card>
      </>) : <Txt style={tw`text-center text-[13px] leading-5 text-mute`}>{r.a} and {r.b} have not finished a {fmt === "test" ? "Test" : "limited-overs"} match against each other yet. Time to settle it.</Txt>)}
    </>)}
  </>);
}

function Milestones({ d }: { d: BookData }) {
  const { go, openPlayer } = useStore();
  const [all, setAll] = useState(false);
  if (!d.feed.length) return <Empty title="No milestones yet" body="First 25s, fifties, hat-tricks and maidens show up here the moment someone gets one." />;
  return (<>
    <Card style={tw`py-1`}>
      {d.feed.slice(0, 5).map((f, i) => (
        <View key={`${f.name}-${f.kind}`} style={rowCls(i === 0)}>
          <Press onPress={() => openPlayer(f.name)} accessibilityLabel={f.name} style={tw`min-h-12 justify-center`}><Badge name={f.name} size={28} /></Press>
          <Press onPress={() => go("scorecard", f.matchId)} style={tw`min-h-12 flex-1 flex-row items-center gap-2`}>
            <Txt style={tw`flex-1 text-[15px] font-medium text-fg`}>{f.line}<Txt style={tw`text-[13px] font-normal text-mute`}>, {dateText(f.date)}</Txt></Txt>
            {f.isNew && <View style={tw`rounded-full bg-sun px-2 py-0.5`}><Txt style={tw`text-[11px] font-semibold text-ink`}>New</Txt></View>}
          </Press>
        </View>
      ))}
    </Card>
    <More open={all} set={setAll} more="All milestones by player" less="Hide milestones by player" />
    {all && d.ms.map((p) => (
      <Card key={p.name}>
        <Press onPress={() => openPlayer(p.name)} style={tw`flex-row items-center gap-3`}>
          <Badge name={p.name} size={32} />
          <Txt style={tw`flex-1 text-[15px] font-semibold text-fg`} numberOfLines={1}>{p.name}</Txt>
          <Num style={tw`text-[12px] font-medium text-mute`}>{p.items.length}</Num>
        </Press>
        <View style={tw`mt-2.5 flex-row flex-wrap gap-1.5`}>
          {p.items.map((it) => (
            <Press key={it.kind} onPress={() => go("scorecard", it.matchId)} style={tw`min-h-9 flex-row items-center gap-1.5 rounded-full border border-line bg-key px-3 py-1.5`}>
              <Txt style={tw`text-[13px] font-medium text-fg`}>{it.label}</Txt>
              {it.count > 1 && <Num style={tw`text-[12px] text-sun`}>×{it.count}</Num>}
              <Num style={tw`text-[11px] font-medium text-mute`}>{dateText(it.date)}</Num>
            </Press>
          ))}
        </View>
      </Card>
    ))}
  </>);
}

export default function Book() {
  useEffect(() => { markBookSeen(); }, []);
  const { matches, teams, fmt, go } = useStore();
  const { top, bottom } = useSafeAreaInsets();
  const d = useMemo(() => bookData(matches, teams, fmt), [matches, teams, fmt]);
  const [active, setActive] = useState<Section>("fame");
  const [world, setWorld] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), chips = useRef<ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<Partial<Record<Section, number>>>({}), xs = useRef<Partial<Record<Section, number>>>({});

  const spy = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    let cur: Section = SECTIONS[0].v;
    for (const s of SECTIONS) if ((ys.current[s.v] ?? Infinity) <= contentOffset.y + 40) cur = s.v;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 8) cur = SECTIONS[SECTIONS.length - 1].v;
    setActive((was) => (was === cur ? was : cur));
  };
  useEffect(() => { chips.current?.scrollTo({ x: Math.max(0, (xs.current[active] ?? 0) - 16), animated: true }); }, [active]);

  const jump = (s: Section) => {
    track(EV.book_section, { section: s });
    setActive(s);
    scroll.current?.scrollTo({ y: Math.max(0, (ys.current[s] ?? 0) - 4), animated: true });
  };
  const y = (id: Section, v: number) => { ys.current[id] = v; };

  return (
    <View style={tw`flex-1 bg-cream`}>
      <View style={[tw`border-b border-line bg-cream px-4 pb-2`, { paddingTop: Math.max(8, top + 6) }]}>
        <View style={tw`flex-row items-center gap-2`}>
          <IconButton icon={ChevronLeft} onPress={() => go("home")} label="Back" size={44} />
          <Txt style={tw`text-[16px] font-bold text-fg`}>Gully Book</Txt>
          <View style={tw`min-w-0 flex-1`}>
            <Segmented value={fmt} set={(v) => useStore.setState({ fmt: v })} items={[{ v: "limited", label: "Limited" }, { v: "test", label: "Test" }]} />
          </View>
          <IconButton icon={Share2} label="Share the book" size={44} onPress={() => { if (d.o.played) { track(EV.share, { what: "book" }); void sendText(d.summary); } }} />
        </View>
        <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2`} contentContainerStyle={tw`gap-1.5`}>
          {SECTIONS.map((s) => (
            <Press key={s.v} onPress={() => jump(s.v)} accessibilityState={{ selected: active === s.v }} onLayout={(e: LayoutChangeEvent) => { xs.current[s.v] = e.nativeEvent.layout.x; }}
              style={tw`min-h-11 items-center justify-center rounded-full border px-3.5 ${active === s.v ? "border-sun bg-sun" : "border-line"}`}>
              <Txt style={tw`text-[14px] font-semibold ${active === s.v ? "text-ink" : "text-mute"}`}>{s.label}</Txt>
            </Press>
          ))}
        </ScrollView>
      </View>
      <ScrollView ref={scroll} onScroll={spy} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + bottom }}>
        <View style={tw`gap-3 px-4 pt-3`}>
          {d.o.played > 0 && <Summary d={d} />}
          <Block id="fame" title="Hall of fame" y={y}><Fame d={d} fmt={fmt} /></Block>
          <Block id="shame" title="Hall of shame" y={y}><Shame d={d} /></Block>
          <Block id="streaks" title="Streaks" y={y}><Streaks d={d} /></Block>
          <Block id="rivals" title="Rivals" y={y}><Rivals d={d} fmt={fmt} /></Block>
          <Block id="milestones" title="Milestones" y={y}><Milestones d={d} /></Block>
          <View style={tw`pt-8`}>
            <Press onPress={() => setWorld(!world)} accessibilityState={{ expanded: world }} style={tw`min-h-12 flex-row items-center justify-between rounded-2xl border border-line bg-panel px-4`}>
              <Txt style={tw`text-[15px] font-semibold text-fg`}>Gully world</Txt>
              <Txt style={tw`text-[13px] text-mute`}>{world ? "Hide" : "Show"}</Txt>
            </Press>
            {world && <View style={tw`mt-3 gap-3`}><WorldCard /><WorldBoard /></View>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
