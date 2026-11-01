import { useEffect, useRef, useState } from "react";
import * as E from "../engine/engine";
import { useMatch, useStore } from "../store";
import { OpenersSheet } from "../sheets";
import { scorecardImage, shareImage, shareText } from "../share";
import { Badge, Card, Header, PrimaryButton } from "../ui";

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
  const [preview, setPreview] = useState<string | null>(null);
  const [superOver, setSuperOver] = useState(false);
  useEffect(() => {
    if (!m || m.status !== "done") return;
    let url = "";
    scorecardImage(m).then((b) => { url = URL.createObjectURL(b); setPreview(url); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [m]);
  useEffect(() => { if (m && m.status !== "done") go("live"); }, [m, go]);
  if (!m || m.status !== "done") return null;

  const res = E.result(m)!, aw = E.awards(m);
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
        {canSuper && <PrimaryButton tone="navy" onClick={() => setSuperOver(true)}>Play a super over</PrimaryButton>}
        {aw.potm && (
          <Card className="flex items-center gap-4 !bg-raised text-white">
            <Badge name={aw.potm.name} size={56} />
            <div><p className="text-xs font-semibold text-sun">PLAYER OF THE MATCH</p><p className="text-xl font-bold">{aw.potm.name}</p><p className="text-sm text-white/75">{aw.potm.line}</p></div>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Card><p className="text-xs font-semibold text-mute">Top scorer</p><p className="font-bold text-fg">{aw.topScorer?.name ?? "-"}</p><p className="text-teal font-semibold">{aw.topScorer?.line ?? ""}</p></Card>
          <Card><p className="text-xs font-semibold text-mute">Best bowling</p><p className="font-bold text-fg">{aw.bestBowler?.name ?? "-"}</p><p className="text-teal font-semibold">{aw.bestBowler?.line ?? ""}</p></Card>
        </div>
        {preview && <img src={preview} alt="Scorecard to share" className="w-full rounded-3xl shadow-[0_10px_30px_-14px_rgba(0,0,0,.4)]" />}
        <PrimaryButton onClick={() => shareImage(m)}>Send scorecard on WhatsApp</PrimaryButton>
        <button onClick={() => shareText(m)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Send as text</button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => go("scorecard")} className="press min-h-12 rounded-2xl bg-panel font-semibold text-teal">Full scorecard</button>
          <button onClick={() => undo(m.id)} className="press min-h-12 rounded-2xl bg-panel font-semibold text-mute">↶ Undo last ball</button>
        </div>
        {m.cup ? <PrimaryButton tone="navy" onClick={() => { useStore.setState({ cupId: m.cup!.id }); go("cup"); }}>Back to the tournament</PrimaryButton>
          : <PrimaryButton tone="navy" onClick={() => go("setup")}>Play again, same teams</PrimaryButton>}
      </main>
      {superOver && <OpenersSheet match={m} onClose={() => setSuperOver(false)} onStart={(n) => { put(n); setSuperOver(false); go("live"); }} />}
    </div>
  );
}
