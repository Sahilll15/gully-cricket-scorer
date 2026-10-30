import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { track } from "./track";

export function summaryText(m: Match): string {
  const lines = m.innings.map((inn, i) => {
    const st = E.replay(m, i);
    return `${m.teams[inn.bat].name}${inn.superOver ? " (super over)" : ""}: ${st.runs}/${st.wickets} (${E.oversText(st.legal)} ov)`;
  });
  const res = E.result(m), aw = E.awards(m);
  return [
    `Gully cricket, ${m.rules.overs} overs`,
    ...lines,
    res ? res.text : "Match in progress",
    aw.potm ? `Player of the match: ${aw.potm.name}, ${aw.potm.line}` : "",
    "",
    "Scored with ai.sahilchalke.com/score",
  ].filter((l, i, a) => l || a[i - 1]).join("\n");
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

export async function shareImage(m: Match) {
  track("scorecard_share");
  const blob = await scorecardImage(m);
  const file = new File([blob], "gully-scorecard.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: E.result(m)?.text ?? "" }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
}

export const shareText = (m: Match) => window.open("https://wa.me/?text=" + encodeURIComponent(summaryText(m)), "_blank");
