import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "../store";
import { fetchTop, fetchWorld, myBoard, renameBoard, showOnBoard, useAccount, type BoardMetric, type BoardRow, type MyBoard } from "../account";
import type { GullyWorld } from "../globalStats";
import { track } from "../track";
import { EV } from "../events";
import { headToHead, rivalry, type Duel, type Rec } from "../records";
import { playerPool, type Fmt } from "../stats";
import { Badge, Card, cx, FmtSwitch, Header, Sheet } from "../ui";
import {
  bookData, dateText, emptyBook, plural, RECORD_ROWS, recordDetail, SECTIONS, SHAME, type BookData, type Section,
} from "./book/book";

const label = "text-xs font-medium text-mute";

function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-2 font-semibold text-fg">{title}</p>
      <p className="text-sm text-mute">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

const Rows = ({ children }: { children: ReactNode }) => <Card className="!p-0 overflow-hidden">{children}</Card>;
const rowCls = "flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-0";

function Tabs({ value, set }: { value: Section; set: (s: Section) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((s) => (
        <button key={s.v} onClick={() => set(s.v)}
          className={cx("press min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold",
            value === s.v ? "border-sun bg-sun text-ink" : "border-line bg-panel text-mute")}>{s.label}</button>
      ))}
    </div>
  );
}

const n = (v: number) => v.toLocaleString("en-IN");

/** All-time totals across every scorer who backs up. Anonymous numbers only. */
function WorldCard() {
  const [w, setW] = useState<GullyWorld | null>(null);
  useEffect(() => { void fetchWorld().then(setW); }, []);
  if (!w) return null;
  const tiles: [string, number][] = [["Matches", w.matches], ["Runs", w.runs], ["Sixes", w.sixes], ["Wickets", w.wickets]];
  return (
    <div className="stadium rounded-3xl p-5">
      <p className={label}>Gully world, all time</p>
      <p className="mt-1 text-5xl font-extrabold leading-none text-fg tabular-nums">{n(w.people)}</p>
      <p className="mt-1 text-sm text-mute">scorers, {n(w.active7)} active this week</p>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-3 text-center">
        {tiles.map(([k, v]) => <div key={k}><p className="text-lg font-extrabold text-fg tabular-nums">{n(v)}</p><p className="text-[11px] text-mute">{k}</p></div>)}
      </div>
      {w.best > 0 && <p className="mt-3 text-sm text-fg">Highest individual score: <span className="font-bold text-sun">{n(w.best)}</span></p>}
      <p className="mt-2 text-[11px] text-mute">Runs, sixes and wickets count the {n(w.reporting)} scorers who have backed up since this card began.</p>
    </div>
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
    <div className="rounded-3xl border border-line bg-panel p-4">
      <p className={label}>World leaderboard</p>
      <div className="mt-2 flex gap-1 rounded-full border border-line p-1">
        {METRICS.map(([k, l]) => <button key={k} onClick={() => setM(k)} className={cx("press min-h-9 flex-1 rounded-full text-xs font-semibold", m === k ? "bg-sun text-ink" : "text-mute")}>{l}</button>)}
      </div>
      <div className="mt-2">
        {rows.length === 0 && <p className="py-3 text-center text-sm text-mute">The board fills as scorers back up their matches.</p>}
        {rows.map((r, i) => (
          <div key={r.nickname + i} className="flex items-center gap-3 border-t border-line py-2 first:border-0">
            <span className={i === 0 ? "w-6 text-lg font-extrabold text-sun" : "w-6 font-bold text-mute"}>{i + 1}</span>
            <span className={cx("flex-1 truncate font-semibold", r.nickname === me?.nickname ? "text-sun" : "text-fg")}>{r.nickname}</span>
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
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} className="mt-3 min-h-12 w-full rounded-2xl border border-line bg-panel px-4 text-fg" />
          {err && <p className="mt-2 text-sm text-out">{err}</p>}
          <button onClick={() => void rename()} className="press mt-4 min-h-14 w-full rounded-2xl bg-sun font-bold text-ink">Save</button>
        </Sheet>
      )}
    </div>
  );
}

function Overview({ d, fmt }: { d: BookData; fmt: Fmt }) {
  const { openPlayer } = useStore();
  if (!d.o.played) return <><Empty icon="📖" title="The book is empty" body={emptyBook(fmt)} /><WorldCard /><WorldBoard /></>;
  const tiles: [string, number][] = [["Runs", d.o.runs], ["Sixes", d.o.sixes], ["Wickets", d.o.wickets], ["Ducks", d.o.ducks]];
  return (<>
    <div className="header-glow rounded-3xl border border-line p-5 text-center">
      <p className="text-6xl font-extrabold leading-none text-sun tabular-nums">{d.o.played}</p>
      <p className="mt-2 text-sm font-medium text-fg">{d.o.played === 1 ? "match" : "matches"} played{d.o.first ? ` since ${dateText(d.o.first)}` : ""}</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-key px-2 py-2.5">
            <p className="text-xl font-extrabold text-fg tabular-nums">{v}</p>
            <p className="text-[11px] font-medium text-mute">{k}</p>
          </div>
        ))}
      </div>
      {d.o.completed < d.o.played && <p className="mt-3 text-xs text-mute">Totals count the {plural(d.o.completed, "finished match", "finished matches")}.</p>}
    </div>
    {d.best ? (
      <button onClick={() => openPlayer(d.best!.name)} className="press block w-full text-left">
        <Card className="flex items-center gap-3">
          <Badge name={d.best.name} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-sun">Best player</span>
            <span className="block truncate text-lg font-bold text-fg">{d.best.name}</span>
            <span className="block text-sm text-mute">{d.why}</span>
          </span>
          <span className="text-mute">›</span>
        </Card>
      </button>
    ) : <Card><p className={label}>Best player</p><p className="mt-1 text-sm text-fg">Nobody has 3 finished matches yet. Play a few more and the crown goes to someone.</p></Card>}
    <button onClick={() => { track(EV.share, { what: "book" }); window.open("https://wa.me/?text=" + encodeURIComponent(d.summary), "_blank"); }}
      className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Share the book on WhatsApp</button>
    <WorldCard />
    <WorldBoard />
  </>);
}

function Records({ d }: { d: BookData }) {
  const { go } = useStore();
  const rows = RECORD_ROWS.flatMap((row) => { const r = d.rec[row.key]; return r ? [{ row, r }] : []; });
  if (!rows.length) return <Empty icon="🏆" title="No records yet" body="Finish a match and the first records get set. Then the fun is breaking them." />;
  const speed = d.speed.filter((b) => b.rows.length);
  return (
    <>
    <Rows>
      {rows.map(({ row, r }) => {
        const big = row.big(r), detail = recordDetail(row, r);
        return (
          <button key={row.key} onClick={() => go("scorecard", r.matchId)} className={cx("press", rowCls)}>
            <span className="min-w-0 flex-1">
              <span className={cx("block", label)}>{row.label}</span>
              <span className="block truncate font-semibold text-fg">{row.who(r)} <span className="font-normal text-mute">· {dateText(r.date)}</span></span>
              {detail && <span className="block text-xs text-mute">{detail}</span>}
            </span>
            {big && <span className="text-2xl font-extrabold text-fg tabular-nums">{big}</span>}
            <span className="text-mute">›</span>
          </button>
        );
      })}
    </Rows>
    {speed.length > 0 && (
      <div className="mt-5">
        <p className={cx("mb-2", label)}>Fastest to career runs</p>
        <Rows>
          {speed.map((b) => (
            <div key={b.runs} className={rowCls}>
              <span className="w-16 text-2xl font-extrabold text-sun tabular-nums">{b.runs}</span>
              <span className="min-w-0 flex-1">
                {b.rows.map((r, i) => (
                  <button key={r.name} onClick={() => go("scorecard", r.matchId)} className="press flex w-full items-baseline justify-between gap-2 text-left">
                    <span className={cx("truncate", i ? "text-sm text-mute" : "font-semibold text-fg")}>{i + 1}. {r.name}</span>
                    <span className={cx("shrink-0 tabular-nums", i ? "text-sm text-mute" : "font-semibold text-fg")}>{r.balls} balls · {plural(r.innings, "inning")}</span>
                  </button>
                ))}
              </span>
            </div>
          ))}
        </Rows>
      </div>
    )}
    </>
  );
}

function Milestones({ d }: { d: BookData }) {
  const { go } = useStore();
  if (!d.feed.length) return <Empty icon="🎖️" title="No milestones yet" body="First 25s, fifties, hat-tricks and maidens show up here the moment someone gets one." />;
  return (<>
    <p className="px-1 pt-1 font-bold text-fg">Latest</p>
    <Rows>
      {d.feed.slice(0, 8).map((f) => (
        <button key={`${f.name}-${f.kind}`} onClick={() => go("scorecard", f.matchId)} className={cx("press", rowCls)}>
          <span className="min-w-0 flex-1 font-semibold text-fg">{f.line}<span className="font-normal text-mute">, {dateText(f.date)}</span></span>
          {f.isNew && <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold text-ink">New</span>}
        </button>
      ))}
    </Rows>
    <p className="px-1 pt-3 font-bold text-fg">By player</p>
    {d.ms.map((p) => (
      <Card key={p.name}>
        <div className="mb-3 flex items-center gap-3">
          <Badge name={p.name} size={36} />
          <span className="flex-1 font-semibold text-fg">{p.name}</span>
          <span className="text-sm text-mute">{plural(p.items.length, "badge")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.items.map((it) => (
            <button key={it.kind} onClick={() => go("scorecard", it.matchId)}
              className="press rounded-full bg-key px-3 py-1.5 text-left text-sm font-semibold text-fg">
              {it.label}{it.count > 1 && <span className="text-sun"> ×{it.count}</span>}
              <span className="font-normal text-mute"> · {dateText(it.date)}</span>
            </button>
          ))}
        </div>
      </Card>
    ))}
  </>);
}

function Shame({ d }: { d: BookData }) {
  const { go } = useStore();
  if (!d.o.completed) return <Empty icon="🦆" title="Nothing to tease anyone about" body="Finish a match and the ducks, run-outs and wayward overs start piling up here. All in good fun." />;
  return (<>
    {SHAME.map((g) => {
      const rows = d.shame[g.key];
      return (
        <Card key={g.key} className="!p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="font-bold text-fg">{g.title}</p>
            <p className="text-xs text-mute">{g.blurb}</p>
          </div>
          {rows.map((r, i) => {
            const tap = r.matchId ? () => go("scorecard", r.matchId) : undefined;
            return (
              <button key={r.name} onClick={tap} disabled={!tap} className={cx("press disabled:cursor-default", rowCls)}>
                <span className="w-6 font-bold text-mute">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-fg">{r.name}</span>
                  {r.text && <span className="block text-xs text-mute">{r.text}{r.date ? `, ${dateText(r.date)}` : ""}</span>}
                </span>
                <span className="text-sm font-semibold text-fg tabular-nums">{g.unit(r.value)}</span>
              </button>
            );
          })}
          {!rows.length && <p className="border-t border-line px-4 py-3 text-sm text-mute">{g.empty}</p>}
        </Card>
      );
    })}
  </>);
}

const Streak = ({ k, now, best }: { k: string; now: number; best: number }) => (
  <span className="w-20 text-right">
    <span className="block text-[11px] text-mute">{k}</span>
    <span className="font-bold text-fg tabular-nums">{now}</span><span className="text-xs text-mute"> / {best}</span>
  </span>
);

function Streaks({ d }: { d: BookData }) {
  const { go, openPlayer } = useStore();
  const players = d.players.filter((p) => p.tens.best || p.wickets.best);
  return (<>
    <p className="px-1 pt-1 font-bold text-fg">Players</p>
    <p className="px-1 text-xs text-mute">Matches in a row with 10 or more runs, and with at least one wicket. Now / best. Sitting out a match does not break it.</p>
    {players.length ? (
      <Rows>
        {players.map((p, i) => (
          <button key={p.name} onClick={() => openPlayer(p.name)} className={cx("press", rowCls)}>
            <span className={i === 0 ? "w-6 text-lg font-extrabold text-sun" : "w-6 font-bold text-mute"}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-fg">{p.name}</span>
            <Streak k="10+ runs" now={p.tens.current} best={p.tens.best} />
            <Streak k="Wickets" now={p.wickets.current} best={p.wickets.best} />
          </button>
        ))}
      </Rows>
    ) : <Empty icon="🔥" title="No streaks yet" body="Score 10 or more, or take a wicket, in a finished match to start one." />}
    <p className="px-1 pt-3 font-bold text-fg">Saved teams</p>
    {d.teams.length ? (
      <Rows>
        {[...d.teams].sort((a, b) => b.best - a.best || b.current - a.current).map((t, i) => (
          <div key={t.name} className={rowCls}>
            <Badge name={t.name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg">{t.name}</span>
              <span className="text-xs text-mute">{t.current > 1 ? `Won the last ${t.current} in a row` : t.current ? "Won the last match" : "No win streak going"}</span>
            </span>
            <span className={cx("text-right text-sm font-semibold tabular-nums", i === 0 && t.best ? "text-sun" : "text-fg")}>best {t.best}</span>
          </div>
        ))}
      </Rows>
    ) : <Empty icon="👥" title="No saved teams" body="Save your teams and their winning runs show up here."
      action={<button onClick={() => go("teams")} className="press min-h-12 rounded-2xl border-2 border-line px-5 font-semibold text-fg">Go to teams</button>} />}
  </>);
}

function PickSheet({ title, names, onPick, onClose }: { title: string; names: string[]; onPick: (n: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = names.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet title={title} onClose={onClose}>
      {names.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" autoFocus
        className="mb-3 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />}
      <div className="pb-4">
        {list.map((n) => (
          <button key={n} onClick={() => { onPick(n); onClose(); }} className="press flex min-h-12 w-full items-center gap-3 border-t border-line py-2 text-left first:border-0">
            <Badge name={n} size={34} /><span className="font-semibold text-fg">{n}</span>
          </button>
        ))}
        {!list.length && <p className="py-4 text-center text-sm text-mute">No one by that name.</p>}
      </div>
    </Sheet>
  );
}

function Pickers({ a, b, setA, setB, names, what, onPair }: { a: string | null; b: string | null; setA: (n: string) => void; setB: (n: string) => void; names: string[]; what: string; onPair: () => void }) {
  const [open, setOpen] = useState<"a" | "b" | null>(null);
  const slot = (v: string | null, k: "a" | "b") => (
    <button onClick={() => setOpen(k)} className="press flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-line bg-panel px-3 text-left">
      {v ? <><Badge name={v} size={30} /><span className="truncate font-semibold text-fg">{v}</span></> : <span className="text-mute">Pick {what}</span>}
    </button>
  );
  return (<>
    <div className="flex items-center gap-2">
      {slot(a, "a")}
      <button onClick={() => { if (a && b) { setA(b); setB(a); } }} disabled={!a || !b} aria-label="Swap"
        className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-key font-bold text-fg disabled:opacity-35">⇄</button>
      {slot(b, "b")}
    </div>
    {open && <PickSheet title={`Pick ${what}`} names={names.filter((n) => n !== (open === "a" ? b : a))}
      onPick={(n) => { (open === "a" ? setA : setB)(n); if (open === "a" ? b : a) onPair(); }} onClose={() => setOpen(null)} />}
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

function HeadToHead({ fmt }: { fmt: Fmt }) {
  const { matches, teams } = useStore();
  const names = useMemo(() => playerPool(matches, teams), [matches, teams]);
  const [a, setA] = useState<string | null>(null), [b, setB] = useState<string | null>(null);
  const h = useMemo(() => (a && b ? headToHead(matches, a, b, fmt) : null), [matches, a, b, fmt]);
  if (names.length < 2) return <Empty icon="⚔️" title="Need two players" body="Name your players when you set up a match, then pit any two against each other here." />;
  return (<>
    <Pickers a={a} b={b} setA={setA} setB={setB} names={names} what="a player" onPair={() => track(EV.head_to_head)} />
    {h ? (<><DuelCard x={h.aBatting} /><DuelCard x={h.bBatting} /></>)
      : <p className="pt-4 text-center text-sm text-mute">Pick two players to see who has the upper hand, bat against ball, both ways.</p>}
  </>);
}

function RivalryView({ fmt }: { fmt: Fmt }) {
  const { matches, teams, go } = useStore();
  const names = teams.map((t) => t.name);
  const [a, setA] = useState<string | null>(names[0] ?? null), [b, setB] = useState<string | null>(names[1] ?? null);
  const r = useMemo(() => (a && b ? rivalry(matches, a, b, fmt) : null), [matches, a, b, fmt]);
  if (names.length < 2) return <Empty icon="🤝" title="Save two teams first" body="A rivalry needs two saved teams. Save them on the Teams tab and their record against each other lands here."
    action={<button onClick={() => go("teams")} className="press min-h-12 rounded-2xl border-2 border-line px-5 font-semibold text-fg">Go to teams</button>} />;
  const biggest = (x: Rec | null, y: Rec | null) => [x?.text, y?.text].filter(Boolean).join(". ") || "No wins yet";
  return (<>
    <Pickers a={a} b={b} setA={setA} setB={setB} names={names} what="a team" onPair={() => track(EV.rivalry)} />
    {r && (r.played ? (<>
      <Card>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="min-w-0"><p className="truncate font-semibold text-teal">{r.a}</p><p className={cx("text-5xl font-extrabold tabular-nums", r.wonA > r.wonB ? "text-sun" : "text-fg")}>{r.wonA}</p></div>
          <p className="text-mute">wins</p>
          <div className="min-w-0"><p className="truncate font-semibold text-teal">{r.b}</p><p className={cx("text-5xl font-extrabold tabular-nums", r.wonB > r.wonA ? "text-sun" : "text-fg")}>{r.wonB}</p></div>
        </div>
        <p className="mt-3 text-center text-sm text-mute">{plural(r.played, "match", "matches")} played{r.tied ? `, ${plural(r.tied, "tie")}` : ""}{r.drawn ? `, ${plural(r.drawn, "draw")}` : ""}</p>
      </Card>
      <p className="px-1 pt-1 font-bold text-fg">Last {r.last5.length}</p>
      <Rows>
        {r.last5.map((x) => (
          <button key={x.matchId} onClick={() => go("scorecard", x.matchId)} className={cx("press", rowCls)}>
            {x.winner ? <Badge name={x.winner} size={32} />
              : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-key text-xs font-bold text-mute">=</span>}
            <span className="min-w-0 flex-1 text-sm font-medium text-fg">{x.text}</span>
            <span className="shrink-0 text-xs text-mute">{dateText(x.date)}</span>
          </button>
        ))}
      </Rows>
      <Card>
        <p className={label}>Biggest win for {r.a}</p>
        <p className="text-sm text-fg">{biggest(r.biggestA.byRuns, r.biggestA.byWickets)}</p>
        <p className={cx("mt-3", label)}>Biggest win for {r.b}</p>
        <p className="text-sm text-fg">{biggest(r.biggestB.byRuns, r.biggestB.byWickets)}</p>
      </Card>
    </>) : <p className="pt-4 text-center text-sm text-mute">{r.a} and {r.b} have not finished a {fmt === "test" ? "Test" : "limited-overs"} match against each other yet. Time to settle it.</p>)}
  </>);
}

export default function Book() {
  const { matches, teams, fmt, go } = useStore();
  const [sec, setSec] = useState<Section>("overview");
  const d = useMemo(() => bookData(matches, teams, fmt), [matches, teams, fmt]);
  return (
    <div className="min-h-screen pb-10">
      <Header title="Gully Book" back={() => go("home")} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <FmtSwitch value={fmt} set={(v) => useStore.setState({ fmt: v })} />
        <Tabs value={sec} set={(s) => { track(EV.book_section, { section: s }); setSec(s); }} />
        {sec === "overview" && <Overview d={d} fmt={fmt} />}
        {sec === "records" && <Records d={d} />}
        {sec === "milestones" && <Milestones d={d} />}
        {sec === "shame" && <Shame d={d} />}
        {sec === "streaks" && <Streaks d={d} />}
        {sec === "h2h" && <HeadToHead fmt={fmt} />}
        {sec === "rivalry" && <RivalryView fmt={fmt} />}
      </main>
    </div>
  );
}
