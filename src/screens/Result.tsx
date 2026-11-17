import { useEffect, useRef, useState } from "react";
import { AdBox } from "../ad";
import { canScore } from "../device";
import * as E from "../engine/engine";
import { useMatch, useStore } from "../store";
import type { Match } from "../engine/types";
import { OpenersSheet, SoloTable, SoloTurnSheet } from "../sheets";
import { canRematch, rematchMatch, tallyText } from "../afterMatch";
import { imageFor, printScoresheet, shareImage, shareText, soloLines, type ImageKind } from "../share";
import { playerOfTheMatch } from "../mvp";
import { AwardsCard } from "../chartsView";
import { Badge, Card, Header, PrimaryButton } from "../ui";
import { SeriesAfterMatch } from "./Series";
import { track } from "../track";
import { EV } from "../events";

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext("2d")!;
    c.width = innerWidth; c.height = innerHeight;
    const colors = ["#ff8a3d", "#ffb27a", "#f1ece4", "#ffffff"];
    const bits = Array.from({ length: 140 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.6, vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 6 + Math.random() * 8,
      col: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0, t = 0;
    const tick = () => {
      g.clearRect(0, 0, c.width, c.height);
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.r += b.vr;
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.col; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore();
      }
      if (++t < 260) raf = requestAnimationFrame(tick); else g.clearRect(0, 0, c.width, c.height);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" />;
}

export default function Result() {
  const m = useMatch();
  const { go, put, undo } = useStore();
  const [superOver, setSuperOver] = useState(false);
  useEffect(() => { if (m && m.status !== "done") go("live"); }, [m, go]);
  if (!m || m.status !== "done") return null;

  if (E.isSolo(m)) return <SoloResult m={m} />;
  const res = E.result(m)!, aw = E.awards(m), potm = playerOfTheMatch(m);
  const winner = res.winner !== null ? m.teams[res.winner].name : null;
  const canSuper = res.tie && m.innings.length === 2;

  return (
    <div className="min-h-screen pb-10">
      {winner && <Confetti />}
      <Header title="Match Summary" back={() => go("home")}>
        <div className="mt-2 flex flex-col items-center text-center">
          {winner ? <Badge name={winner} size={72} /> : <span className="text-5xl">🤝</span>}
          <p className="mt-3 text-[26px] font-extrabold leading-tight text-fg">{res.text}</p>
        </div>
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        {canSuper && canScore(m) && <PrimaryButton tone="navy" onClick={() => setSuperOver(true)}>Play a super over</PrimaryButton>}
        {m.series && <SeriesAfterMatch m={m} />}
        {potm && <PotmCard name={potm.name} line={potm.line} />}
        <div className="grid grid-cols-2 gap-3">
          <Card><p className="text-xs font-semibold text-mute">Top scorer</p><p className="font-bold text-fg">{aw.topScorer?.name ?? "-"}</p><p className="text-teal font-semibold">{aw.topScorer?.line ?? ""}</p></Card>
          <Card><p className="text-xs font-semibold text-mute">Best bowling</p><p className="font-bold text-fg">{aw.bestBowler?.name ?? "-"}</p><p className="text-teal font-semibold">{aw.bestBowler?.line ?? ""}</p></Card>
        </div>
        <AwardsCard m={m} />
        <Sharing m={m} text={() => shareText(m)} textLabel="Send as text" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => go("scorecard")} className="press min-h-12 rounded-2xl bg-panel font-semibold text-teal">Full scorecard</button>
          {canScore(m) && <button onClick={() => undo(m.id)} className="press min-h-12 rounded-2xl bg-panel font-semibold text-mute">↶ Undo last ball</button>}
        </div>
        <a href="/cards/" className="press flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-line bg-panel font-semibold text-teal">Who played best? Make everyone's player card</a>
        <Rematch m={m} />
        {m.series ? null : m.cup ? <PrimaryButton tone="navy" onClick={() => { useStore.setState({ cupId: m.cup!.id }); go("cup"); }}>Back to the tournament</PrimaryButton>
          : <PrimaryButton tone="navy" onClick={() => go("setup")}>Play again, same teams</PrimaryButton>}
        <div className="pt-6"><AdBox /></div>
      </main>
      {superOver && <OpenersSheet match={m} onClose={() => setSuperOver(false)} onStart={(n) => { put(n); setSuperOver(false); go("live"); }} />}
    </div>
  );
}

/** Solo standings as WhatsApp text. */
const soloText = (m: Match) =>
  [`Gully cricket, ${E.formatText(m)}`, E.result(m)?.text ?? "", "", ...soloLines(m), "", "Scored with ai.sahilchalke.com/score"].join("\n");

/** The evening's running score and a one-tap rematch: same teams and rules, straight to the openers. */
function Rematch({ m }: { m: Match }) {
  const { matches, add, put, go } = useStore();
  const [next, setNext] = useState<Match | null>(null);
  const tally = tallyText(matches, m);
  const start = (n: Match) => { track(EV.rematch); add(n); put(n); setNext(null); go("live", n.id); };
  return (
    <>
      {tally && <Card className="text-center"><p className="text-xs font-semibold text-mute">This evening</p><p className="mt-1 font-bold text-fg">{tally}</p></Card>}
      {canRematch(m) && canScore(m) && <PrimaryButton tone="navy" onClick={() => setNext(rematchMatch(m))}>{E.isSolo(m) ? "Rematch, same players and rules" : "Rematch, same teams and rules"}</PrimaryButton>}
      {next && (E.isSolo(next) ? <SoloTurnSheet match={next} onClose={() => setNext(null)} onStart={start} />
        : <OpenersSheet match={next} onClose={() => setNext(null)} onStart={start} />)}
    </>
  );
}

function PotmCard({ name, line }: { name: string; line: string }) {
  return (
    <Card className="flex items-center gap-4 !bg-raised text-white">
      <Badge name={name} size={56} />
      <div><p className="text-xs font-semibold text-sun">PLAYER OF THE MATCH</p><p className="text-xl font-bold">{name}</p><p className="text-sm text-white/75">{line}</p></div>
    </Card>
  );
}

/** A drawn share image as an object URL, freed when the match changes or the screen closes. */
function useImage(m: Match, kind: ImageKind) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u = "", live = true;
    imageFor(m, kind).then((b) => { if (!live) return; u = URL.createObjectURL(b); setUrl(u); });
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [m, kind]);
  return url;
}

function PosterTile({ m, kind, label }: { m: Match; kind: ImageKind; label: string }) {
  const url = useImage(m, kind);
  return (
    <button onClick={() => shareImage(m, kind)} className="press overflow-hidden rounded-2xl border-2 border-line bg-panel text-left">
      {url ? <img src={url} alt={label} className="aspect-[4/5] w-full object-cover" /> : <span className="block aspect-[4/5] w-full bg-key" />}
      <span className="block px-3 py-2.5 text-sm font-semibold text-fg">{label} <span className="text-mute">›</span></span>
    </button>
  );
}

/** Highlights preview and every way to send the match: images, text, posters and the PDF scoresheet. */
function Sharing({ m, text, textLabel }: { m: Match; text: () => void; textLabel: string }) {
  const preview = useImage(m, "card");
  return (
    <>
      {preview && <img src={preview} alt="Scorecard to share" className="w-full rounded-3xl shadow-[0_10px_30px_-14px_rgba(0,0,0,.4)]" />}
      <PrimaryButton onClick={() => shareImage(m, "full")}>Send full scorecard on WhatsApp</PrimaryButton>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => shareImage(m, "card")} className="press min-h-12 rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Send highlights</button>
        <button onClick={text} className="press min-h-12 rounded-2xl border-2 border-line bg-panel font-semibold text-fg">{textLabel}</button>
      </div>
      <p className="pt-2 text-sm font-semibold text-teal">Posters <span className="text-xs font-normal text-mute">· tap one to send it</span></p>
      <div className="grid grid-cols-2 gap-2">
        <PosterTile m={m} kind="match" label="Match poster" />
        <PosterTile m={m} kind="winner" label="Winner poster" />
      </div>
      <button onClick={() => printScoresheet(m)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Save scoresheet as PDF</button>
    </>
  );
}

function SoloResult({ m }: { m: Match }) {
  const { go, undo } = useStore();
  const res = E.result(m)!, rows = E.soloStandings(m), potm = playerOfTheMatch(m);
  const winner = rows.find((r) => r.id === res.winnerId);
  const bowlers = rows.filter((r) => r.bowled > 0).sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded);
  function again() {
    const names = m.teams[0].players.map((p) => p.name);
    useStore.setState({ lastSetup: { a: "", b: "", na: names, nb: [], size: names.length, rules: m.rules, common: "" } });
    go("setup");
  }
  return (
    <div className="min-h-screen pb-10">
      {winner && <Confetti />}
      <Header title="Match Summary" back={() => go("home")}>
        <div className="mt-2 flex flex-col items-center text-center">
          {winner ? <Badge name={winner.name} size={72} /> : <span className="text-5xl">🤝</span>}
          <p className="mt-3 text-[26px] font-extrabold leading-tight text-fg">{res.text}</p>
          <p className="mt-1 text-sm text-mute">{E.formatText(m)}</p>
        </div>
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        {potm && <PotmCard name={potm.name} line={potm.line} />}
        <p className="pt-1 text-sm font-semibold text-teal">Standings</p>
        <Card className="!p-0 overflow-hidden"><SoloTable match={m} full highlight={res.winnerId} /></Card>
        <p className="pt-2 text-sm font-semibold text-teal">Bowling</p>
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-key text-left text-xs text-fg">
              <th className="px-3 py-2.5 font-semibold">Bowler</th>{["O", "W", "R", "Econ"].map((h) => <th key={h} className="px-1.5 py-2.5 text-right font-semibold last:pr-3">{h}</th>)}
            </tr></thead>
            <tbody>{bowlers.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2.5 font-semibold text-fg">{r.name}</td>
                <td className="px-1.5 text-right tabular-nums">{E.oversText(r.bowled, E.ballsPerOver(m.rules))}</td>
                <td className="px-1.5 text-right font-bold text-fg tabular-nums">{r.wickets}</td>
                <td className="px-1.5 text-right tabular-nums">{r.conceded}</td>
                <td className="px-1.5 pr-3 text-right tabular-nums">{E.runRate(r.conceded, r.bowled, E.ballsPerOver(m.rules)).toFixed(1)}</td>
              </tr>))}</tbody>
          </table>
        </Card>
        <AwardsCard m={m} />
        <Sharing m={m} text={() => { track(EV.share, { what: "text" }); window.open("https://wa.me/?text=" + encodeURIComponent(soloText(m)), "_blank"); }} textLabel="Send standings as text" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => go("scorecard")} className="press min-h-12 rounded-2xl bg-panel font-semibold text-teal">Full scorecard</button>
          {canScore(m) && <button onClick={() => undo(m.id)} className="press min-h-12 rounded-2xl bg-panel font-semibold text-mute">↶ Undo last ball</button>}
        </div>
        <Rematch m={m} />
        <PrimaryButton tone="navy" onClick={again}>Play again, same players</PrimaryButton>
        <div className="pt-6"><AdBox /></div>
      </main>
    </div>
  );
}
