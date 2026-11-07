import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { track } from "./track";

const innTitle = (m: Match, i: number) => {
  const inn = m.innings[i], st = E.replay(m, i);
  return { team: `${m.teams[inn.bat].name}${inn.superOver ? " (super over)" : ""}`, score: `${st.runs}/${st.wickets} (${E.oversText(st.legal)} ov)`, st };
};
const extrasTotal = (st: E.State) => st.extras.wd + st.extras.nb + st.extras.b + st.extras.lb;

/** The full scorecard as WhatsApp text: every batter, then that innings' bowling. */
export function summaryText(m: Match): string {
  const res = E.result(m), aw = E.awards(m), name = (id: string) => E.playerName(m, id);
  const innings = m.innings.flatMap((_, i) => {
    const { team, score, st } = innTitle(m, i);
    return [
      "",
      `*${team} ${score}*`,
      ...st.order.map((id) => { const b = st.bat.get(id)!; return `${name(id)} ${b.runs} (${b.balls}), ${E.howOut(m, b)}`; }),
      `Extras ${extrasTotal(st)}`,
      st.bowlOrder.length ? `Bowling: ${st.bowlOrder.map((id) => { const w = st.bowl.get(id)!; return `${name(id)} ${E.oversText(w.legal)}-${w.maidens}-${w.runs}-${w.wickets}`; }).join(", ")}` : "",
    ];
  });
  return [
    `Gully cricket, ${m.rules.overs} overs`,
    res ? res.text : "Match in progress",
    aw.potm ? `Player of the match: ${aw.potm.name}, ${aw.potm.line}` : "",
    ...innings,
    "",
    "Scored with ai.sahilchalke.com/score",
  ].filter((l, i, a) => l || a[i - 1]).join("\n");
}

/** A tall image with every innings: batting with how each batter got out, extras, then the bowling. */
export async function fullScorecardImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, X = 70, R = W - 70, name = (id: string) => E.playerName(m, id);
  const BAT = ["R", "B", "4s", "6s", "SR"], BOWL = ["O", "M", "R", "W", "Econ"], COLS = [630, 720, 800, 875, R];
  const sections = m.innings.map((_, i) => innTitle(m, i));
  const H = 340 + sections.reduce((h, s) => h + 332 + s.st.order.length * 96 + s.st.bowlOrder.length * 70, 0) + 80;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const F = (w: number, s: number) => `${w} ${s}px Poppins, system-ui, sans-serif`;
  const right = (t: string, x: number, y: number) => { g.textAlign = "right"; g.fillText(t, x, y); g.textAlign = "left"; };
  const head = (label: string, cols: string[], y: number) => {
    g.fillStyle = "#9a9aa5"; g.font = F(600, 24); g.fillText(label, X, y);
    cols.forEach((h, k) => right(h, COLS[k], y));
  };
  g.fillStyle = "#050507"; g.fillRect(0, 0, W, H);

  g.fillStyle = "#ff8a3d"; g.font = F(800, 44); g.fillText("GULLY CRICKET", X, 100);
  g.fillStyle = "#9a9aa5"; g.font = F(500, 30);
  g.fillText(`${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${m.rules.overs} overs`, X, 148);
  const res = E.result(m), aw = E.awards(m);
  g.fillStyle = "#ff8a3d"; g.beginPath(); g.roundRect(X, 180, W - 140, 100, 28); g.fill();
  g.fillStyle = "#111111"; g.font = F(800, 40); g.fillText(clip(g, res?.text ?? "In progress", W - 200), X + 34, 244);
  if (aw.potm) { g.fillStyle = "#f1ece4"; g.font = F(500, 28); g.fillText(clip(g, `Player of the match: ${aw.potm.name}, ${aw.potm.line}`, W - 140), X, 320); }

  let y = 340;
  for (const { team, score, st } of sections) {
    g.fillStyle = "#16161d"; g.beginPath(); g.roundRect(X - 20, y, W - 100, 80, 22); g.fill();
    g.fillStyle = "#ffffff"; g.font = F(700, 36); g.fillText(clip(g, team, 560), X, y + 53);
    g.fillStyle = "#ff8a3d"; right(score, R, y + 53);
    y += 110 + 30;
    head("Batting", BAT, y); y += 26;
    for (const id of st.order) {
      const b = st.bat.get(id)!;
      g.fillStyle = "#ffffff"; g.font = F(700, 32); g.fillText(clip(g, name(id), 500), X, y + 40);
      g.fillStyle = "#9a9aa5"; g.font = F(500, 24); g.fillText(clip(g, E.howOut(m, b), 500), X, y + 76);
      g.fillStyle = "#f1ece4"; g.font = F(600, 30);
      [b.runs, b.balls, b.fours, b.sixes, b.balls ? Math.round((b.runs * 100) / b.balls) : 0].forEach((v, k) => right(String(v), COLS[k], y + 40));
      y += 96;
    }
    const ex = st.extras;
    g.fillStyle = "#9a9aa5"; g.font = F(500, 26);
    g.fillText(`Extras ${extrasTotal(st)} (wd ${ex.wd}, nb ${ex.nb}, b ${ex.b}, lb ${ex.lb})`, X, y + 44);
    y += 70 + 30;
    head("Bowling", BOWL, y); y += 26;
    for (const id of st.bowlOrder) {
      const w = st.bowl.get(id)!;
      g.fillStyle = "#ffffff"; g.font = F(700, 32); g.fillText(clip(g, name(id), 500), X, y + 46);
      g.fillStyle = "#f1ece4"; g.font = F(600, 30);
      [E.oversText(w.legal), w.maidens, w.runs, w.wickets, w.legal ? ((w.runs * 6) / w.legal).toFixed(1) : "0.0"].forEach((v, k) => right(String(v), COLS[k], y + 46));
      y += 70;
    }
    y += 40;
  }
  g.fillStyle = "#9a9aa5"; g.font = F(500, 28); g.fillText("Scored with ai.sahilchalke.com/score", X, H - 40);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

export async function scorecardImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const F = (w: number, s: number) => `${w} ${s}px Poppins, system-ui, sans-serif`;
  g.fillStyle = "#050507"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#0d0d12"; g.beginPath(); g.roundRect(0, -60, W, 520, 80); g.fill();
  const glow = g.createRadialGradient(W / 2, 0, 40, W / 2, 0, 700); glow.addColorStop(0, "rgba(255,138,61,.28)"); glow.addColorStop(1, "rgba(255,138,61,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, 460);

  g.fillStyle = "#ff8a3d"; g.font = F(800, 44); g.fillText("GULLY CRICKET", 70, 100);
  g.fillStyle = "#9a9aa5"; g.font = F(500, 30);
  g.fillText(`${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${m.rules.overs} overs`, 70, 148);

  const main = m.innings.slice(0, 2);
  main.forEach((inn, i) => {
    const st = E.replay(m, i), x = i === 0 ? 70 : 570;
    g.fillStyle = "#f1ece4"; g.font = F(700, 36); g.fillText(clip(g, m.teams[inn.bat].name, 440), x, 250);
    g.fillStyle = "#ffffff"; g.font = F(800, 110); g.fillText(`${st.runs}/${st.wickets}`, x - 4, 370);
    g.font = F(500, 30); g.fillText(`(${E.oversText(st.legal)} overs)`, x, 418);
  });

  const res = E.result(m), aw = E.awards(m);
  g.fillStyle = "#ff8a3d"; g.beginPath(); g.roundRect(70, 520, W - 140, 150, 36); g.fill();
  g.fillStyle = "#111111"; g.font = F(800, 50);
  g.fillText(clip(g, res?.text ?? "In progress", W - 220), 110, 612);

  let y = 760;
  const row = (label: string, value: string, sub: string) => {
    g.fillStyle = "#0d0d12"; g.beginPath(); g.roundRect(70, y, W - 140, 130, 32); g.fill();
    g.fillStyle = "#9a9aa5"; g.font = F(500, 26); g.fillText(label, 110, y + 50);
    g.fillStyle = "#ffffff"; g.font = F(700, 40); g.fillText(clip(g, value, 560), 110, y + 100);
    g.fillStyle = "#ff8a3d"; g.font = F(700, 40); g.textAlign = "right"; g.fillText(sub, W - 110, y + 100); g.textAlign = "left";
    y += 150;
  };
  if (aw.potm) row("Player of the match", aw.potm.name, aw.potm.line);
  if (aw.topScorer) row("Top scorer", aw.topScorer.name, aw.topScorer.line);
  if (aw.bestBowler) row("Best bowling", aw.bestBowler.name, aw.bestBowler.line);

  g.fillStyle = "#9a9aa5"; g.font = F(500, 28); g.fillText("Scored with ai.sahilchalke.com/score", 70, H - 50);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

function clip(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

export async function shareImage(m: Match, kind: "full" | "card" = "full") {
  track("scorecard_share", { kind });
  const blob = await (kind === "full" ? fullScorecardImage(m) : scorecardImage(m));
  const file = new File([blob], kind === "full" ? "gully-full-scorecard.png" : "gully-scorecard.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: E.result(m)?.text ?? "" }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
}

export const shareText = (m: Match) => window.open("https://wa.me/?text=" + encodeURIComponent(summaryText(m)), "_blank");
