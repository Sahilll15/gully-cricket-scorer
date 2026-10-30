import { useState } from "react";
import * as E from "../engine/engine";
import type { Ball } from "../engine/types";
import { useMatch, useStore } from "../store";
import { EditBallSheet } from "../sheets";
import { economy, strikeRate } from "../stats";
import { Badge, BallChip, Card, cx, Header, LivePill, Segmented } from "../ui";

export default function Scorecard() {
  const m = useMatch();
  const { go, put } = useStore();
  const [idx, setIdx] = useState(() => Math.max(0, (m?.innings.length ?? 1) - 1));
  const [tab, setTab] = useState<"bat" | "bowl">("bat");
  const [edit, setEdit] = useState<number | null>(null);
  if (!m || !m.innings.length) return null;

  const inn = m.innings[idx], st = E.replay(m, idx), name = (id: string) => E.playerName(m, id);
  const live = m.status === "live" || m.status === "break";
  const head = (side: 0 | 1) => {
    const i = m.innings.findIndex((x) => x.bat === side && !x.superOver);
    return i < 0 ? null : { st: E.replay(m, i) };
  };
  const short = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  const howOut = (o: { kind: string; bowler: string } | null) =>
    !o ? "not out" : o.kind === "run out" || o.kind === "wall out" ? o.kind : o.kind === "bowled" ? `b ${name(o.bowler)}` : `${o.kind}, b ${name(o.bowler)}`;
  let evCursor = 0;

  return (
    <div className="min-h-screen pb-10">
      <Header title="Match Score Board" back={() => go(live ? "live" : "result")} right={live ? <LivePill /> : undefined}>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-center">
          {([0, 1] as const).map((s) => {
            const h = head(s);
            return (
              <div key={s} className={cx("flex flex-col items-center", s === 1 && "col-start-3")}>
                <Badge name={m.teams[s].name} size={56} />
                <p className="mt-2 font-bold text-teal">{m.teams[s].name}</p>
                <p className="text-sm font-medium text-fg tabular-nums">{h ? `${h.st.runs}/${h.st.wickets} (${E.oversText(h.st.legal)} Over)` : "Yet to bat"}</p>
                {h && <p className="text-[11px] text-fg/70">Wide: {h.st.extras.wd} | No Ball: {h.st.extras.nb} | Byes: {h.st.extras.b + h.st.extras.lb}</p>}
              </div>
            );
          }).flatMap((el, i) => i === 0 ? [el, <span key="vs" className="col-start-2 row-start-1 mt-3 text-3xl font-extrabold italic text-teal">VS</span>] : [el])}
        </div>
        {m.toss && <p className="mt-3 text-center text-sm text-fg/70">Toss won by: {m.teams[m.toss.winner].name}, elected to {m.toss.choice}</p>}
      </Header>

      <main className="mx-auto max-w-[480px] px-4 pt-4">
        <Segmented value={idx} set={setIdx} items={m.innings.map((x, i) => {
          const s = E.replay(m, i);
          return { v: i, label: `${x.superOver ? "SO " : ""}${short(m.teams[x.bat].name)} ${s.runs}/${s.wickets}(${E.oversText(s.legal)})` };
        })} />

        <div className="mt-4 flex justify-center gap-6 border-b-2 border-line">
          {(["bat", "bowl"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cx("-mb-0.5 min-h-12 whitespace-nowrap border-b-2 px-1 text-[15px] font-semibold", tab === t ? "border-sun text-sun" : "border-transparent text-mute")}>
              {t === "bat" ? "Batting Summary" : "Bowling Summary"}
            </button>
          ))}
        </div>

        <Card className="mt-3 !p-0 overflow-hidden">
          {tab === "bat" ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-key text-left text-xs text-fg">
                <th className="px-3 py-2.5 font-semibold">Name</th>{["R", "B", "4s", "6s", "SR"].map((h) => <th key={h} className="px-1.5 py-2.5 text-right font-semibold last:pr-3">{h}</th>)}
              </tr></thead>
              <tbody>{st.order.map((id) => { const b = st.bat.get(id)!; return (
                <tr key={id} className="border-t border-line">
                  <td className="px-3 py-2.5"><p className="font-semibold text-fg">{name(id)}{(id === st.striker || id === st.nonStriker) && !b.out && live && idx === m.innings.length - 1 ? " *" : ""}</p>
                    <p className="text-xs text-mute">{howOut(b.out)}</p></td>
                  <td className="px-1.5 text-right font-bold text-fg tabular-nums">{b.runs}</td>
                  <td className="px-1.5 text-right tabular-nums">{b.balls}</td>
                  <td className="px-1.5 text-right tabular-nums">{b.fours}</td>
                  <td className="px-1.5 text-right tabular-nums">{b.sixes}</td>
                  <td className="px-1.5 pr-3 text-right tabular-nums">{strikeRate(b.runs, b.balls).toFixed(0)}</td>
                </tr>); })}</tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-key text-left text-xs text-fg">
                <th className="px-3 py-2.5 font-semibold">Bowler</th>{["O", "M", "R", "W", "Econ"].map((h) => <th key={h} className="px-1.5 py-2.5 text-right font-semibold last:pr-3">{h}</th>)}
              </tr></thead>
              <tbody>{st.bowlOrder.map((id) => { const b = st.bowl.get(id)!; return (
                <tr key={id} className="border-t border-line">
                  <td className="px-3 py-3 font-semibold text-fg">{name(id)}</td>
                  <td className="px-1.5 text-right tabular-nums">{E.oversText(b.legal)}</td>
                  <td className="px-1.5 text-right tabular-nums">{b.maidens}</td>
                  <td className="px-1.5 text-right tabular-nums">{b.runs}</td>
                  <td className="px-1.5 text-right font-bold text-fg tabular-nums">{b.wickets}</td>
                  <td className="px-1.5 pr-3 text-right tabular-nums">{economy(b.runs, b.legal).toFixed(1)}</td>
                </tr>); })}</tbody>
            </table>
          )}
        </Card>

        <Card className="mt-3 text-sm">
          <p className="text-fg"><b>Extras {st.extras.wd + st.extras.nb + st.extras.b + st.extras.lb}</b>
            <span className="text-mute"> (wd {st.extras.wd}, nb {st.extras.nb}, b {st.extras.b}, lb {st.extras.lb})</span></p>
          <p className="mt-1 text-fg"><b>Total {st.runs}/{st.wickets}</b> <span className="text-mute">in {E.oversText(st.legal)} overs, run rate {E.runRate(st.runs, st.legal).toFixed(2)}</span></p>
          {st.fow.length > 0 && <>
            <p className="mt-3 font-semibold text-teal">Fall of wickets</p>
            <p className="mt-1 text-fg/80">{st.fow.map((f) => `${f.score}-${f.wicket} (${name(f.id)}, ${f.over})`).join(", ")}</p>
          </>}
        </Card>

        <Card className="mt-3">
          <p className="mb-2 font-semibold text-teal">Ball by ball <span className="text-xs font-normal text-mute">· tap a ball to correct it</span></p>
          {st.overs.map((balls, o) => (
            <div key={o} className="flex items-center gap-2 border-t border-line py-2 first:border-0">
              <span className="w-12 shrink-0 text-xs font-semibold text-mute">Ov {o + 1}</span>
              <div className="flex flex-wrap gap-1.5">{balls.map((b: Ball, i) => {
                while (inn.events[evCursor]?.t === "swap") evCursor++;
                const at = evCursor++;
                return <BallChip key={i} b={b} size={32} onClick={() => setEdit(at)} />;
              })}</div>
              <span className="ml-auto text-sm font-bold text-fg tabular-nums">{balls.reduce((s, b) => s + E.ballTotal(b, m.rules), 0)}</span>
            </div>
          ))}
          {!st.overs.length && <p className="text-sm text-mute">No balls yet.</p>}
        </Card>
      </main>
      {edit !== null && inn.events[edit]?.t === "ball" && (
        <EditBallSheet ball={inn.events[edit] as Ball} onClose={() => setEdit(null)}
          onSave={(p) => { put(E.editBall(m, idx, edit, p)); setEdit(null); }} />
      )}
    </div>
  );
}
