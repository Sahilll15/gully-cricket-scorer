import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import { fetchTop, fetchWorld, myBoard, renameBoard, showOnBoard, useAccount, type BoardMetric, type BoardRow, type MyBoard } from "../account";
import type { GullyWorld } from "../globalStats";
import { track } from "../track";
import { EV } from "../events";
import { headToHead, rivalry, type Duel, type Rec } from "../records";
import { playerPool, type Fmt } from "../stats";
import { Badge, Card, cx, Segmented, Sheet } from "../ui";
import {
  bookData, dateText, emptyBook, plural, recordDetail, recordGroups, SECTIONS, SHAME, SHAME_FIRST, shameLead, TOP_METRICS,
  type BookData, type Section, type ShameGroup, type TopMetric,
} from "./book/book";

const label = "text-xs font-medium text-mute";
const n = (v: number) => v.toLocaleString("en-IN");
type Pair = [string, string];

/** One quiet card per section when there is nothing to show yet. */
function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm text-mute">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

function More({ open, set, more, less }: { open: boolean; set: (v: boolean) => void; more: string; less: string }) {
  return (
    <button onClick={() => set(!open)} aria-expanded={open} className="press min-h-11 px-1 text-sm font-semibold text-sun">{open ? less : more}</button>
  );
}

function Block({ id, title, refs, children }: { id: Section; title: string; refs: React.MutableRefObject<Partial<Record<Section, HTMLElement>>>; children: ReactNode }) {
  return (
    <section ref={(el) => { if (el) refs.current[id] = el; }} className="scroll-mt-28 space-y-3 pt-8">
      <h2 className="px-1 text-xl font-bold text-fg">{title}</h2>
      {children}
    </section>
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
      <p className={label}>Gully world, all time</p>
      <p className="mt-1 text-5xl font-extrabold leading-none text-fg tabular-nums">{n(w.people)}</p>
      <p className="mt-1 text-sm text-mute">scorers, {n(w.active7)} active this week</p>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
        {tiles.map(([k, v]) => <div key={k}><p className="text-lg font-extrabold text-fg tabular-nums">{n(v)}</p><p className="text-[11px] text-mute">{k}</p></div>)}
      </div>
      {w.best > 0 && <p className="mt-3 text-sm text-fg">Highest individual score: <span className="font-bold text-sun">{n(w.best)}</span></p>}
      <p className="mt-2 text-[11px] text-mute">Runs, sixes and wickets cover the {n(w.reporting)} scorers who have scored matches.</p>
    </Card>
  );
}

const METRICS: [BoardMetric, string][] = [["matches", "Matches"], ["runs", "Runs"], ["sixes", "Sixes"], ["wickets", "Wickets"]];

/** Opt-in world leaderboard of scorers, by nickname. */
function WorldBoard() {
  const phone = useAccount((a) => a.phone ?? a.google?.name ?? null);
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
      <p className={label}>World leaderboard</p>
      <div className="mt-2 flex gap-1 rounded-full border border-line p-1">
        {METRICS.map(([k, l]) => <button key={k} onClick={() => setM(k)} className={cx("press min-h-9 flex-1 rounded-full text-xs font-semibold", m === k ? "bg-sun text-ink" : "text-mute")}>{l}</button>)}
      </div>
      <div className="mt-2">
        {rows.length === 0 && <p className="py-3 text-center text-sm text-mute">The board fills as scorers back up their matches.</p>}
        {rows.map((r, i) => (
          <div key={r.nickname + i} className="flex items-center gap-3 border-t border-line py-2 first:border-0">
            <span className={i === 0 ? "w-6 text-lg font-extrabold text-sun" : "w-6 font-bold text-mute"}>{i + 1}</span>
            <span className={cx("flex-1 truncate font-semibold", r.me ? "text-sun" : "text-fg")}>{r.nickname}</span>
            <span className="text-xl font-extrabold text-fg tabular-nums">{n(r[m])}</span>
          </div>
        ))}
      </div>
      {!phone ? <p className="mt-2 text-xs text-mute">Sign in from Home and your totals join the board under a made-up handle.</p>
        : me ? (
          <p className="mt-2 text-xs text-mute">
            {me.on ? "You appear as" : "Hidden. Your handle is"} <span className="font-semibold text-fg">{me.nickname}</span>.{" "}
            <button onClick={() => { setNick(me.nickname); setOpen(true); }} className="font-semibold text-sun underline">Rename</button>{" · "}
            <button onClick={() => void toggle()} className="font-semibold underline">{me.on ? "Hide me" : "Show me"}</button>
          </p>
        ) : <p className="mt-2 text-xs text-mute">You'll appear after your next backup.</p>}
      {open && (
        <Sheet title="Rename on the leaderboard" onClose={() => setOpen(false)}>
          <p className="text-sm text-mute">Others see this name with your matches, runs, sixes and wickets. Never your number or player names.</p>
          <input aria-label="Leaderboard name" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} className="mt-3 min-h-12 w-full rounded-2xl border border-line bg-panel px-4 text-fg" />
          {err && <p className="mt-2 text-sm text-out">{err}</p>}
          <button onClick={() => void rename()} className="press mt-4 min-h-14 w-full rounded-2xl bg-sun font-bold text-ink">Save</button>
        </Sheet>
      )}
    </Card>
  );
}

function Summary({ d }: { d: BookData }) {
  const tiles: [string, number][] = [["Matches", d.o.played], ["Runs", d.o.runs], ["Sixes", d.o.sixes], ["Wickets", d.o.wickets], ["Ducks", d.o.ducks]];
  return (
    <Card className="!p-3">
      <div className="grid grid-cols-5 gap-1 text-center">
        {tiles.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <p className="truncate text-lg font-extrabold text-fg tabular-nums">{v}</p>
            <p className="text-[11px] font-medium text-mute">{k}</p>
          </div>
        ))}
      </div>
      {(d.o.first != null || d.o.completed < d.o.played) && (
        <p className="mt-2 text-center text-xs text-mute">
          {d.o.first != null && `Since ${dateText(d.o.first)}. `}
          {d.o.completed < d.o.played && `Totals count the ${plural(d.o.completed, "finished match", "finished matches")}.`}
        </p>
      )}
    </Card>
  );
}

/** Label, big number and holder. The top opens the scorecard, the name opens the player. */
function Tile({ title, big, detail, who, matchId, player }: { title: string; big: string | null; detail?: string | null; who: string; matchId: string; player?: string }) {
  const { go, openPlayer } = useStore();
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-panel">
      <button onClick={() => go("scorecard", matchId)} aria-label={`${title}, open scorecard`} className="press min-w-0 px-3 pt-3 text-left">
        <span className={cx("block", label)}>{title}</span>
        {big && <span className="block truncate text-2xl font-extrabold text-fg tabular-nums">{big}</span>}
        {detail && <span className="block text-xs text-mute">{detail}</span>}
      </button>
      {player ? (
        <button onClick={() => openPlayer(player)} className="press flex min-h-11 min-w-0 items-center gap-2 px-3 pb-2 text-left">
          <Badge name={player} size={20} /><span className="truncate text-sm font-medium text-fg">{who}</span>
        </button>
      ) : <p className="truncate px-3 pb-3 pt-1 text-sm font-medium text-mute">{who}</p>}
    </div>
  );
}

function Leaderboard({ d }: { d: BookData }) {
  const { openPlayer } = useStore();
  const [metric, setMetric] = useState<TopMetric>("rating");
  const rows = d.tops[metric];
  const first = rows[0], why = metric === "rating" && d.best && first && d.best.name === first.name ? d.why : null;
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TOP_METRICS.map((t) => (
          <button key={t.v} onClick={() => setMetric(t.v)} aria-pressed={metric === t.v}
            className={cx("press min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold", metric === t.v ? "border-raised bg-raised text-fg" : "border-line text-mute")}>{t.label}</button>
        ))}
      </div>
      {first ? (<>
        <button onClick={() => openPlayer(first.name)} className="press flex w-full items-center gap-3 rounded-2xl bg-sun p-4 text-left text-ink">
          <span className="w-7 text-3xl font-extrabold tabular-nums">1</span>
          <Badge name={first.name} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold">{first.name}</span>
            <span className="block text-xs font-medium text-ink/70">{why ?? first.sub}</span>
          </span>
          <span className="text-4xl font-extrabold tabular-nums">{first.value}</span>
        </button>
        <div>
          {rows.slice(1).map((r) => (
            <button key={r.name} onClick={() => openPlayer(r.name)} className="press flex min-h-14 w-full items-center gap-3 border-t border-line px-1 text-left first:border-0">
              <span className="w-7 text-base font-bold text-mute tabular-nums">{r.rank}</span>
              <Badge name={r.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{r.name}</span>
                <span className="block text-xs text-mute">{r.sub}</span>
              </span>
              <span className="text-xl font-extrabold text-fg tabular-nums">{r.value}</span>
            </button>
          ))}
        </div>
      </>) : <p className="py-3 text-center text-sm text-mute">Nobody on this board yet.</p>}
    </div>
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
      <div className="grid grid-cols-2 gap-2">
        {heroes.map((h) => <Tile key={h.key} title={h.label} big={h.big} who={h.who} matchId={h.matchId!} player={h.who} />)}
      </div>
    )}
    {groups.map((g) => (
      <div key={g.title}>
        <p className={cx("mb-2 px-1", label)}>{g.title}</p>
        <div className="grid grid-cols-2 gap-2">
          {g.tiles.map(({ row, rec }) => (
            <Tile key={row.key} title={row.label} big={row.big(rec)} detail={recordDetail(row, rec)} who={`${row.who(rec)}, ${dateText(rec.date)}`}
              matchId={rec.matchId} player={row.player ? rec.name : undefined} />
          ))}
        </div>
      </div>
    ))}
    {!groups.length && !heroes.length && <Empty title="No records yet" body="Finish a match and the first records get set. Then the fun is breaking them." />}
    {speed.length > 0 && (<>
      <More open={fast} set={setFast} more="Fastest to career runs" less="Hide fastest to career runs" />
      {fast && (
        <Card className="!p-0 overflow-hidden">
          {speed.map((b) => (
            <div key={b.runs} className="flex gap-3 border-t border-line px-4 py-3 first:border-0">
              <span className="w-14 text-2xl font-extrabold text-fg tabular-nums">{b.runs}</span>
              <div className="min-w-0 flex-1">
                {b.rows.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between gap-2">
                    <button onClick={() => openPlayer(r.name)} className={cx("press min-h-9 truncate text-left text-sm", i ? "text-mute" : "font-semibold text-fg")}>{i + 1}. {r.name}</button>
                    <button onClick={() => go("scorecard", r.matchId)} className="press min-h-9 shrink-0 text-xs text-mute tabular-nums">{r.balls} balls, {plural(r.innings, "inning")}</button>
                  </div>
                ))}
              </div>
            </div>
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
      <p className="font-bold text-fg">{g.title}</p>
      <p className="text-xs text-mute">{g.blurb}</p>
      {line ? (
        <button onClick={() => openPlayer(rows[0].name)} className="press mt-2 min-h-11 text-left font-semibold text-fg">{line}</button>
      ) : <p className="mt-2 text-sm text-mute">{g.empty}</p>}
      {rows.length > 1 && <More open={open} set={setOpen} more="Show more" less="Show less" />}
      {open && rows.slice(1).map((r, i) => (
        <div key={r.name} className="flex items-center gap-3 border-t border-line py-1">
          <span className="w-5 text-sm font-bold text-mute tabular-nums">{i + 2}</span>
          <div className="min-w-0 flex-1">
            <button onClick={() => openPlayer(r.name)} className="press block min-h-9 max-w-full truncate text-left font-medium text-fg">{r.name}</button>
            {r.text && (r.matchId
              ? <button onClick={() => go("scorecard", r.matchId!)} className="press block text-left text-xs text-mute">{r.text}{r.date ? `, ${dateText(r.date)}` : ""}</button>
              : <p className="text-xs text-mute">{r.text}{r.date ? `, ${dateText(r.date)}` : ""}</p>)}
          </div>
          <span className="text-sm font-semibold text-fg tabular-nums">{g.unit(r.value)}</span>
        </div>
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

const Streak = ({ k, now, best }: { k: string; now: number; best: number }) => (
  <span className="w-[72px] text-right">
    <span className="block text-[11px] text-mute">{k}</span>
    <span className="font-bold text-fg tabular-nums">{now}</span><span className="text-xs text-mute"> / {best}</span>
  </span>
);

function Streaks({ d }: { d: BookData }) {
  const { openPlayer } = useStore();
  const [all, setAll] = useState(false);
  const players = d.players.filter((p) => p.tens.best || p.wickets.best);
  const teams = [...d.teams].filter((t) => t.best).sort((a, b) => b.best - a.best || b.current - a.current);
  if (!players.length && !teams.length) return <Empty title="No streaks yet" body="Score 10 or more, or take a wicket, in a finished match to start one. Save your teams to track win streaks." />;
  return (<>
    {players.length > 0 && (
      <Card className="!pb-2">
        <p className="text-xs text-mute">Matches in a row with 10 or more runs, and with a wicket. Now / best. Sitting out a match does not break it.</p>
        {(all ? players : players.slice(0, 5)).map((p, i) => (
          <button key={p.name} onClick={() => openPlayer(p.name)} className="press flex min-h-12 w-full items-center gap-3 border-t border-line text-left first:border-0">
            <span className="w-5 text-sm font-bold text-mute tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-fg">{p.name}</span>
            <Streak k="10+ runs" now={p.tens.current} best={p.tens.best} />
            <Streak k="Wickets" now={p.wickets.current} best={p.wickets.best} />
          </button>
        ))}
        {players.length > 5 && <More open={all} set={setAll} more={`Show all ${players.length}`} less="Show fewer" />}
      </Card>
    )}
    {teams.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <span key={t.name} className="flex items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-1.5 pr-3">
            <Badge name={t.name} size={24} kind="team" />
            <span className="text-sm font-medium text-fg">{t.name}</span>
            <span className="text-xs text-mute">best {t.best}{t.current > 1 ? `, now ${t.current}` : ""}</span>
          </span>
        ))}
      </div>
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
      {slots === 2 && <p className="mb-2 text-sm text-mute">{chosen.length ? `${chosen[0]} and ...` : "Tap the first, then the second."}</p>}
      {names.length > 8 && <input aria-label="Search players" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" autoFocus
        className="mb-3 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />}
      <div className="pb-4">
        {list.map((x) => (
          <button key={x} onClick={() => pick(x)} className="press flex min-h-12 w-full items-center gap-3 border-t border-line py-2 text-left first:border-0">
            <Badge name={x} size={34} /><span className="font-semibold text-fg">{x}</span>
          </button>
        ))}
        {!list.length && <p className="py-4 text-center text-sm text-mute">No one by that name.</p>}
      </div>
    </Sheet>
  );
}

function PairRow({ pair, names, what, set }: { pair: Pair | null; names: string[]; what: string; set: (p: Pair) => void }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const slot = (v: string | undefined, at: 0 | 1) => (
    <button onClick={() => setPick({ slots: 1, at })} aria-label={v ? `Change ${v}` : `Pick ${what}`}
      className="press flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-panel px-3 text-left">
      {v ? <><Badge name={v} size={28} /><span className="truncate text-sm font-semibold text-fg">{v}</span></> : <span className="text-sm text-mute">Pick {what}</span>}
    </button>
  );
  const apply = (got: string[]) => {
    if (pick?.slots === 2) set([got[0], got[1]]);
    else if (pick && pair) set(pick.at === 0 ? [got[0], pair[1]] : [pair[0], got[0]]);
  };
  return (<>
    <div className="flex items-center gap-2">
      {slot(pair?.[0], 0)}
      <button onClick={() => pair && set([pair[1], pair[0]])} disabled={!pair} aria-label="Swap"
        className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-key font-bold text-fg disabled:opacity-35">⇄</button>
      {slot(pair?.[1], 1)}
    </div>
    <button onClick={() => setPick({ slots: 2 })} className="press min-h-11 px-1 text-sm font-semibold text-sun">Pick two {what}s</button>
    {pick && <PickSheet title={pick.slots === 2 ? `Pick two ${what}s` : `Pick ${what}`} names={names} slots={pick.slots} onDone={apply} onClose={() => setPick(null)}
      exclude={pick.slots === 1 && pair ? [pair[pick.at === 0 ? 1 : 0]] : []} />}
  </>);
}

function DuelCard({ x }: { x: Duel }) {
  return (
    <Card>
      <p className={label}>{x.batter} batting to {x.bowler}</p>
      {x.balls || x.dismissals ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[[`${x.runs}`, `runs off ${plural(x.balls, "ball")}`], [`${x.dismissals}`, x.dismissals === 1 ? "dismissal" : "dismissals"], [x.strikeRate.toFixed(0), "strike rate"]].map(([v, k]) => (
            <div key={k} className="rounded-2xl bg-key px-2 py-2.5">
              <p className="text-2xl font-extrabold text-fg tabular-nums">{v}</p>
              <p className="text-[11px] font-medium text-mute">{k}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-1 text-sm text-mute">{x.batter} has not faced {x.bowler} yet.</p>}
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
      action={<button onClick={() => go("teams")} className="press min-h-12 rounded-2xl border-2 border-line px-5 font-semibold text-fg">Go to teams</button>} />;
  }
  const biggest = (x: Rec | null, y: Rec | null) => [x?.text, y?.text].filter(Boolean).join(". ") || "No wins yet";
  return (<>
    {canDuel && (<>
      <p className={cx("px-1", label)}>Head to head</p>
      <PairRow pair={duel} names={players} what="player" set={(p) => { track(EV.head_to_head); setDuelPick(p); }} />
      {h ? <><DuelCard x={h.aBatting} /><DuelCard x={h.bBatting} /></>
        : <p className="text-center text-sm text-mute">Pick two players to see who has the upper hand, bat against ball, both ways.</p>}
    </>)}
    {canRival && (<>
      <p className={cx("px-1 pt-3", label)}>Team rivalry</p>
      <PairRow pair={rival} names={teamNames} what="team" set={(p) => { track(EV.rivalry); setTeamPick(p); }} />
      {r && (r.played ? (<>
        <Card>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div className="min-w-0"><p className="truncate font-semibold text-teal">{r.a}</p><p className={cx("text-5xl font-extrabold tabular-nums", r.wonA > r.wonB ? "text-sun" : "text-fg")}>{r.wonA}</p></div>
            <p className="text-mute">wins</p>
            <div className="min-w-0"><p className="truncate font-semibold text-teal">{r.b}</p><p className={cx("text-5xl font-extrabold tabular-nums", r.wonB > r.wonA ? "text-sun" : "text-fg")}>{r.wonB}</p></div>
          </div>
          <p className="mt-3 text-center text-sm text-mute">{plural(r.played, "match", "matches")} played{r.tied ? `, ${plural(r.tied, "tie")}` : ""}{r.drawn ? `, ${plural(r.drawn, "draw")}` : ""}</p>
        </Card>
        <Card className="!p-0 overflow-hidden">
          {r.last5.map((x) => (
            <button key={x.matchId} onClick={() => go("scorecard", x.matchId)} className="press flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0">
              {x.winner ? <Badge name={x.winner} size={32} kind="team" />
                : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-key text-xs font-bold text-mute">=</span>}
              <span className="min-w-0 flex-1 text-sm font-medium text-fg">{x.text}</span>
              <span className="shrink-0 text-xs text-mute">{dateText(x.date)}</span>
            </button>
          ))}
        </Card>
        <Card>
          <p className={label}>Biggest win for {r.a}</p>
          <p className="text-sm text-fg">{biggest(r.biggestA.byRuns, r.biggestA.byWickets)}</p>
          <p className={cx("mt-3", label)}>Biggest win for {r.b}</p>
          <p className="text-sm text-fg">{biggest(r.biggestB.byRuns, r.biggestB.byWickets)}</p>
        </Card>
      </>) : <p className="text-center text-sm text-mute">{r.a} and {r.b} have not finished a {fmt === "test" ? "Test" : "limited-overs"} match against each other yet. Time to settle it.</p>)}
    </>)}
  </>);
}

function Milestones({ d }: { d: BookData }) {
  const { go, openPlayer } = useStore();
  const [all, setAll] = useState(false);
  if (!d.feed.length) return <Empty title="No milestones yet" body="First 25s, fifties, hat-tricks and maidens show up here the moment someone gets one." />;
  return (<>
    <Card className="!p-0 overflow-hidden">
      {d.feed.slice(0, 5).map((f) => (
        <div key={`${f.name}-${f.kind}`} className="flex items-center gap-1 border-t border-line pl-3 first:border-0">
          <button onClick={() => openPlayer(f.name)} aria-label={f.name} className="press grid min-h-12 place-items-center pr-2"><Badge name={f.name} size={28} /></button>
          <button onClick={() => go("scorecard", f.matchId)} className="press flex min-h-12 min-w-0 flex-1 items-center gap-2 pr-4 text-left">
            <span className="min-w-0 flex-1 font-semibold text-fg">{f.line}<span className="font-normal text-mute">, {dateText(f.date)}</span></span>
            {f.isNew && <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold text-ink">New</span>}
          </button>
        </div>
      ))}
    </Card>
    <More open={all} set={setAll} more="All milestones by player" less="Hide milestones by player" />
    {all && d.ms.map((p) => (
      <Card key={p.name}>
        <button onClick={() => openPlayer(p.name)} className="press mb-3 flex w-full items-center gap-3 text-left">
          <Badge name={p.name} size={36} />
          <span className="flex-1 font-semibold text-fg">{p.name}</span>
          <span className="text-sm text-mute">{plural(p.items.length, "badge")}</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {p.items.map((it) => (
            <button key={it.kind} onClick={() => go("scorecard", it.matchId)} className="press min-h-9 rounded-full bg-key px-3 py-1.5 text-left text-sm font-semibold text-fg">
              {it.label}{it.count > 1 && <span className="text-sun"> ×{it.count}</span>}
              <span className="font-normal text-mute"> · {dateText(it.date)}</span>
            </button>
          ))}
        </div>
      </Card>
    ))}
  </>);
}

export default function Book() {
  const { matches, teams, fmt, go } = useStore();
  const d = useMemo(() => bookData(matches, teams, fmt), [matches, teams, fmt]);
  const [active, setActive] = useState<Section>("fame");
  const [world, setWorld] = useState(false);
  const refs = useRef<Partial<Record<Section, HTMLElement>>>({});
  const chips = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spy = () => {
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur: Section = SECTIONS[0].v;
      for (const s of SECTIONS) { const el = refs.current[s.v]; if (el && el.getBoundingClientRect().top <= 130) cur = s.v; }
      setActive(end ? SECTIONS[SECTIONS.length - 1].v : cur);
    };
    spy();
    window.addEventListener("scroll", spy, { passive: true });
    return () => window.removeEventListener("scroll", spy);
  }, []);

  useEffect(() => {
    const row = chips.current, el = row?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (row && el) row.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  const jump = (s: Section) => {
    track(EV.book_section, { section: s });
    setActive(s);
    refs.current[s]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const share = () => { track(EV.share, { what: "book" }); window.open("https://wa.me/?text=" + encodeURIComponent(d.summary), "_blank"); };

  return (
    <div className="min-h-screen pb-10">
      <div className="sticky top-0 z-30 border-b border-line bg-cream/95 px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-center gap-2">
            <button onClick={() => go("home")} aria-label="Back" className="press grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-key text-xl font-bold text-fg">←</button>
            <h1 className="shrink-0 text-base font-bold text-fg">Gully Book</h1>
            <div className="min-w-0 flex-1">
              <Segmented value={fmt} set={(v) => useStore.setState({ fmt: v })} items={[{ v: "limited", label: "Limited" }, { v: "test", label: "Test" }]} />
            </div>
            <button onClick={share} disabled={!d.o.played} aria-label="Share the book on WhatsApp"
              className="press min-h-11 shrink-0 rounded-2xl bg-key px-3 text-sm font-semibold text-fg disabled:opacity-40">Share</button>
          </div>
          <div ref={chips} className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((s) => (
              <button key={s.v} onClick={() => jump(s.v)} aria-pressed={active === s.v}
                className={cx("press min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-semibold", active === s.v ? "border-sun bg-sun text-ink" : "border-line text-mute")}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-3">
        {d.o.played > 0 && <Summary d={d} />}
        <Block id="fame" title="Hall of fame" refs={refs}><Fame d={d} fmt={fmt} /></Block>
        <Block id="shame" title="Hall of shame" refs={refs}><Shame d={d} /></Block>
        <Block id="streaks" title="Streaks" refs={refs}><Streaks d={d} /></Block>
        <Block id="rivals" title="Rivals" refs={refs}><Rivals d={d} fmt={fmt} /></Block>
        <Block id="milestones" title="Milestones" refs={refs}><Milestones d={d} /></Block>
        <div className="pt-8">
          <button onClick={() => setWorld(!world)} aria-expanded={world} className="press flex min-h-12 w-full items-center justify-between rounded-2xl border border-line bg-panel px-4 text-left">
            <span className="font-semibold text-fg">Gully world</span>
            <span className="text-sm text-mute">{world ? "Hide" : "Show"}</span>
          </button>
          {world && <div className="mt-3 space-y-3"><WorldCard /><WorldBoard /></div>}
        </div>
      </main>
    </div>
  );
}
