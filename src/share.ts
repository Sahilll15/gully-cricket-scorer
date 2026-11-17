import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { playerOfTheMatch } from "./mvp";
import { poster, type Poster } from "./poster";
import { extrasLine, inningsTitle, scoresheetHtml } from "./scoresheet";
import { track } from "./track";
import { EV, IMAGE_SHARE } from "./events";

const innTitle = (m: Match, i: number) => {
  const st = E.replay(m, i);
  return { team: inningsTitle(m, i), score: `${E.inningsScore(m, i)} (${E.oversText(st.legal, st.bpo)} ov)`, st };
};

/** Solo standings, best first: "1. Asha 34 (12), took 2/10". */
export const soloLines = (m: Match) =>
  E.soloStandings(m).map((r, i) => `${i + 1}. ${r.name} ${r.runs} (${r.balls})${r.wickets ? `, took ${r.wickets}/${r.conceded}` : ""}`);

/** The full scorecard as WhatsApp text: every batter, then that innings' bowling. Solo leads with the standings. */
export function summaryText(m: Match): string {
  const res = E.result(m), potm = playerOfTheMatch(m), name = (id: string) => E.playerName(m, id);
  const innings = m.innings.flatMap((_, i) => {
    const { team, score, st } = innTitle(m, i);
    return [
      "",
      `*${team} ${score}*`,
      ...st.order.map((id) => { const b = st.bat.get(id)!; return `${name(id)} ${b.runs} (${b.balls}), ${E.howOut(m, b)}`; }),
      extrasLine(st),
      st.bowlOrder.length ? `Bowling: ${st.bowlOrder.map((id) => { const w = st.bowl.get(id)!; return `${name(id)} ${E.oversText(w.legal, st.bpo)}-${w.maidens}-${w.runs}-${w.wickets}`; }).join(", ")}` : "",
    ];
  });
  return [
    `Gully cricket, ${E.formatText(m)}`,
    res ? res.text : "Match in progress",
    potm ? `Player of the match: ${potm.name}, ${potm.line}` : "",
    ...(E.isSolo(m) ? ["", "*Standings*", ...soloLines(m)] : []),
    ...innings,
    "",
    "Scored with ai.sahilchalke.com/score",
  ].filter((l, i, a) => l || a[i - 1]).join("\n");
}

const F = (w: number, s: number) => `${w} ${s}px Poppins, system-ui, sans-serif`;
const ORANGE = "#ff8a3d", BG = "#050507", PANEL = "#0d0d12", MUTE = "#9a9aa5", CREAM = "#f1ece4";
const dateLine = (m: Match) => `${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${E.formatText(m)}`;

function canvas(W: number, H: number) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  return { c, g: c.getContext("2d")! };
}
const png = (c: HTMLCanvasElement) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));

/** A tall image with every innings: batting with how each batter got out, extras, then the bowling. */
export async function fullScorecardImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, X = 70, R = W - 70, name = (id: string) => E.playerName(m, id);
  const BAT = ["R", "B", "4s", "6s", "SR"], BOWL = ["O", "M", "R", "W", "Econ"], COLS = [630, 720, 800, 875, R];
  const sections = m.innings.map((_, i) => innTitle(m, i));
  const H = 340 + sections.reduce((h, s) => h + 332 + s.st.order.length * 96 + s.st.bowlOrder.length * 70, 0) + 80;
  const { c, g } = canvas(W, H);
  const right = (t: string, x: number, y: number) => { g.textAlign = "right"; g.fillText(t, x, y); g.textAlign = "left"; };
  const head = (label: string, cols: string[], y: number) => {
    g.fillStyle = MUTE; g.font = F(600, 24); g.fillText(label, X, y);
    cols.forEach((h, k) => right(h, COLS[k], y));
  };
  g.fillStyle = BG; g.fillRect(0, 0, W, H);

  g.fillStyle = ORANGE; g.font = F(800, 44); g.fillText("GULLY CRICKET", X, 100);
  g.fillStyle = MUTE; g.font = F(500, 30); g.fillText(dateLine(m), X, 148);
  const res = E.result(m), potm = playerOfTheMatch(m);
  g.fillStyle = ORANGE; g.beginPath(); g.roundRect(X, 180, W - 140, 100, 28); g.fill();
  g.fillStyle = "#111111"; g.font = F(800, 40); g.fillText(clip(g, res?.text ?? "In progress", W - 200), X + 34, 244);
  if (potm) { g.fillStyle = CREAM; g.font = F(500, 28); g.fillText(clip(g, `Player of the match: ${potm.name}, ${potm.line}`, W - 140), X, 320); }

  let y = 340;
  for (const { team, score, st } of sections) {
    g.fillStyle = "#16161d"; g.beginPath(); g.roundRect(X - 20, y, W - 100, 80, 22); g.fill();
    g.fillStyle = "#ffffff"; g.font = F(700, 36); g.fillText(clip(g, team, 560), X, y + 53);
    g.fillStyle = ORANGE; right(score, R, y + 53);
    y += 110 + 30;
    head("Batting", BAT, y); y += 26;
    for (const id of st.order) {
      const b = st.bat.get(id)!;
      g.fillStyle = "#ffffff"; g.font = F(700, 32); g.fillText(clip(g, name(id), 500), X, y + 40);
      g.fillStyle = MUTE; g.font = F(500, 24); g.fillText(clip(g, E.howOut(m, b), 500), X, y + 76);
      g.fillStyle = CREAM; g.font = F(600, 30);
      [b.runs, b.balls, b.fours, b.sixes, b.balls ? Math.round((b.runs * 100) / b.balls) : 0].forEach((v, k) => right(String(v), COLS[k], y + 40));
      y += 96;
    }
    g.fillStyle = MUTE; g.font = F(500, 26);
    g.fillText(clip(g, extrasLine(st), W - 140), X, y + 44);
    y += 70 + 30;
    head("Bowling", BOWL, y); y += 26;
    for (const id of st.bowlOrder) {
      const w = st.bowl.get(id)!;
      g.fillStyle = "#ffffff"; g.font = F(700, 32); g.fillText(clip(g, name(id), 500), X, y + 46);
      g.fillStyle = CREAM; g.font = F(600, 30);
      [E.oversText(w.legal, st.bpo), w.maidens, w.runs, w.wickets, w.legal ? ((w.runs * st.bpo) / w.legal).toFixed(1) : "0.0"].forEach((v, k) => right(String(v), COLS[k], y + 46));
      y += 70;
    }
    y += 40;
  }
  g.fillStyle = MUTE; g.font = F(500, 28); g.fillText("Scored with ai.sahilchalke.com/score", X, H - 40);
  return png(c);
}

/** The highlights rows under the result: player of the match, top scorer, best bowling. */
export function highlightRows(m: Match): [string, string, string][] {
  const aw = E.awards(m), potm = playerOfTheMatch(m), rows: [string, string, string][] = [];
  if (potm) rows.push(["Player of the match", potm.name, `${potm.line.split(" · ").pop()}`]);
  if (aw.topScorer) rows.push(["Top scorer", aw.topScorer.name, aw.topScorer.line]);
  if (aw.bestBowler) rows.push(["Best bowling", aw.bestBowler.name, aw.bestBowler.line]);
  return rows;
}

export async function scorecardImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, H = 1350, { c, g } = canvas(W, H);
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  g.fillStyle = PANEL; g.beginPath(); g.roundRect(0, -60, W, 520, 80); g.fill();
  const glow = g.createRadialGradient(W / 2, 0, 40, W / 2, 0, 700); glow.addColorStop(0, "rgba(255,138,61,.28)"); glow.addColorStop(1, "rgba(255,138,61,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, 460);

  g.fillStyle = ORANGE; g.font = F(800, 44); g.fillText("GULLY CRICKET", 70, 100);
  g.fillStyle = MUTE; g.font = F(500, 30); g.fillText(dateLine(m), 70, 148);

  if (E.isSolo(m)) {
    E.soloStandings(m).slice(0, 4).forEach((r, i) => {
      const y = 232 + i * 62;
      g.fillStyle = i === 0 ? ORANGE : MUTE; g.font = F(800, 34); g.fillText(String(i + 1), 70, y);
      g.fillStyle = i === 0 ? "#ffffff" : CREAM; g.font = F(700, 38); g.fillText(clip(g, r.name, 560), 120, y);
      g.textAlign = "right"; g.fillStyle = "#ffffff"; g.font = F(800, 44); g.fillText(String(r.runs), 880, y);
      g.fillStyle = MUTE; g.font = F(500, 26); g.fillText(`${r.balls} b`, W - 70, y); g.textAlign = "left";
    });
  } else if (E.isTest(m)) ([0, 1] as const).forEach((s) => {
    const x = s === 0 ? 70 : 570;
    g.fillStyle = CREAM; g.font = F(700, 36); g.fillText(clip(g, m.teams[s].name, 440), x, 250);
    g.fillStyle = "#ffffff"; g.font = F(800, 64); g.fillText(clip(g, E.sideScore(m, s) ?? "Yet to bat", 440), x - 4, 350);
  });
  else m.innings.slice(0, 2).forEach((inn, i) => {
    const st = E.replay(m, i), x = i === 0 ? 70 : 570;
    g.fillStyle = CREAM; g.font = F(700, 36); g.fillText(clip(g, m.teams[inn.bat].name, 440), x, 250);
    g.fillStyle = "#ffffff"; g.font = F(800, 110); g.fillText(`${st.runs}/${st.wickets}`, x - 4, 370);
    g.font = F(500, 30); g.fillText(`(${E.oversText(st.legal, st.bpo)} overs)`, x, 418);
  });

  const res = E.result(m);
  g.fillStyle = ORANGE; g.beginPath(); g.roundRect(70, 520, W - 140, 150, 36); g.fill();
  g.fillStyle = "#111111"; g.font = F(800, 50);
  g.fillText(clip(g, res?.text ?? "In progress", W - 220), 110, 612);

  let y = 760;
  for (const [label, value, sub] of highlightRows(m)) {
    g.fillStyle = PANEL; g.beginPath(); g.roundRect(70, y, W - 140, 130, 32); g.fill();
    g.fillStyle = MUTE; g.font = F(500, 26); g.fillText(label, 110, y + 50);
    g.fillStyle = "#ffffff"; g.font = F(700, 40); g.fillText(clip(g, value, 560), 110, y + 100);
    g.fillStyle = ORANGE; g.font = F(700, 40); g.textAlign = "right"; g.fillText(sub, W - 110, y + 100); g.textAlign = "left";
    y += 150;
  }

  g.fillStyle = MUTE; g.font = F(500, 28); g.fillText("Scored with ai.sahilchalke.com/score", 70, H - 50);
  return png(c);
}

function clip(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

/** Largest font size from `start` down to `min` that fits the text in `max` pixels. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, start: number, min: number, max: number) {
  let s = start;
  for (; s > min; s -= 4) { g.font = F(weight, s); if (g.measureText(text).width <= max) break; }
  g.font = F(weight, s);
  return s;
}

/** Same seed, same confetti: a poster looks the same every time it is shared. */
function rng(seed: string) {
  let a = [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 9);
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Brick courses of the gully wall, fading out towards the middle of the poster. */
function wall(g: CanvasRenderingContext2D, W: number, h: number) {
  for (let row = 0, y = 0; y < h; row++, y += 58) {
    g.globalAlpha = 0.9 * (1 - y / h);
    for (let x = row % 2 ? -60 : 0; x < W; x += 124) { g.fillStyle = row % 3 ? "#0e0e14" : "#111119"; g.beginPath(); g.roundRect(x + 3, y + 3, 118, 52, 6); g.fill(); }
  }
  g.globalAlpha = 1;
}

/** Three chalk stumps and bails, the way every gully draws its wicket on the wall. */
function chalkStumps(g: CanvasRenderingContext2D, x: number, y: number, h: number, rand: () => number) {
  g.strokeStyle = "rgba(241,236,228,.16)"; g.lineCap = "round";
  for (let pass = 0; pass < 3; pass++) {
    g.lineWidth = 7 - pass * 2;
    [0, 46, 92].forEach((dx) => { g.beginPath(); g.moveTo(x + dx + rand() * 4, y + rand() * 4); g.lineTo(x + dx + rand() * 4, y + h); g.stroke(); });
    g.beginPath(); g.moveTo(x - 6, y - 8 + rand() * 3); g.lineTo(x + 98, y - 8 + rand() * 3); g.stroke();
  }
}

function performers(g: CanvasRenderingContext2D, p: Poster, y: number, W: number) {
  g.fillStyle = MUTE; g.font = F(600, 26); g.fillText("Top performers", 70, y);
  p.performers.forEach((r, i) => {
    const top = y + 24 + i * 112;
    g.fillStyle = PANEL; g.beginPath(); g.roundRect(70, top, W - 140, 96, 28); g.fill();
    g.fillStyle = i === 0 ? ORANGE : "#1f1f29"; g.beginPath(); g.arc(122, top + 48, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = i === 0 ? "#111111" : CREAM; g.font = F(800, 28); g.textAlign = "center"; g.fillText(String(i + 1), 122, top + 58); g.textAlign = "left";
    g.fillStyle = "#ffffff"; g.font = F(700, 34); g.fillText(clip(g, r.name, 560), 172, top + 46);
    g.fillStyle = MUTE; g.font = F(500, 24); g.fillText(clip(g, r.line, 600), 172, top + 80);
    g.textAlign = "right"; g.fillStyle = ORANGE; g.font = F(800, 40); g.fillText(String(r.points), W - 104, top + 54);
    g.fillStyle = MUTE; g.font = F(500, 20); g.fillText("pts", W - 104, top + 80); g.textAlign = "left";
  });
}

function footer(g: CanvasRenderingContext2D, p: Poster, W: number, H: number) {
  g.fillStyle = CREAM; g.font = F(600, 28); g.fillText(clip(g, p.tagline, 560), 70, H - 56);
  g.textAlign = "right"; g.fillStyle = MUTE; g.font = F(500, 24); g.fillText("ai.sahilchalke.com/score", W - 70, H - 56); g.textAlign = "left";
}

/** Match poster: both teams (or the solo standings), the result and the top three on MVP points. */
export async function matchPosterImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, H = 1350, { c, g } = canvas(W, H), p = poster(m), rand = rng(m.id);
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  wall(g, W, 560);
  const glow = g.createRadialGradient(W / 2, -80, 40, W / 2, -80, 820); glow.addColorStop(0, "rgba(255,138,61,.32)"); glow.addColorStop(1, "rgba(255,138,61,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, 700);
  chalkStumps(g, W - 210, 110, 190, rand);

  g.fillStyle = ORANGE; g.font = F(800, 34); g.fillText("GULLY CRICKET", 70, 96);
  g.fillStyle = "#ffffff"; fit(g, "MATCH DAY", 900, 150, 90, W - 340); g.fillText("MATCH DAY", 62, 240);
  g.fillStyle = MUTE; g.font = F(500, 30); g.fillText(`${p.date} · ${p.format}`, 70, 290);

  const rowH = p.solo ? 92 : 128, top = 340;
  p.rows.forEach((r, i) => {
    const y = top + i * rowH;
    if (!p.solo && i === 1) {
      g.strokeStyle = "rgba(241,236,228,.12)"; g.lineWidth = 2; g.beginPath(); g.moveTo(70, y - 6); g.lineTo(W - 70, y - 6); g.stroke();
      g.fillStyle = BG; g.beginPath(); g.arc(W / 2, y - 6, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ORANGE; g.beginPath(); g.arc(W / 2, y - 6, 30, 0, Math.PI * 2); g.stroke();
      g.fillStyle = ORANGE; g.font = F(800, 24); g.textAlign = "center"; g.fillText("vs", W / 2, y + 2); g.textAlign = "left";
    }
    const [nameY, subY, scoreY] = p.solo ? [y + 44, y + 76, y + 66] : [y + 72, y + 108, y + 86];
    g.fillStyle = r.won ? "#ffffff" : CREAM; g.font = F(700, p.solo ? 38 : 46); g.fillText(clip(g, `${p.solo ? `${i + 1}. ` : ""}${r.name}`, 520), 70, nameY);
    if (r.sub) { g.fillStyle = MUTE; g.font = F(500, 24); g.fillText(r.sub, 70, subY); }
    g.textAlign = "right"; g.fillStyle = r.won ? ORANGE : "#ffffff"; fit(g, r.score, 800, p.solo ? 56 : 92, 40, 420); g.fillText(r.score, W - 70, scoreY); g.textAlign = "left";
  });

  const by = top + p.rows.length * rowH + 30;
  g.fillStyle = ORANGE; g.beginPath(); g.roundRect(70, by, W - 140, 104, 30); g.fill();
  g.fillStyle = "#111111"; g.font = F(800, 40); g.fillText(clip(g, p.result, W - 220), 110, by + 66);

  performers(g, p, by + 170, W);
  footer(g, p, W, H);
  return png(c);
}

/** A trophy in two tones: cup, handles, stem and base. */
function trophy(g: CanvasRenderingContext2D, cx: number, y: number, s: number, lit: boolean) {
  const gold = g.createLinearGradient(cx - s, y, cx + s, y + s * 1.6);
  gold.addColorStop(0, lit ? "#ffb27a" : "#3a3a46"); gold.addColorStop(1, lit ? ORANGE : "#24242d");
  g.fillStyle = gold; g.strokeStyle = gold; g.lineWidth = s * 0.12;
  g.beginPath(); g.arc(cx - s * 0.78, y + s * 0.38, s * 0.3, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
  g.beginPath(); g.arc(cx + s * 0.78, y + s * 0.38, s * 0.3, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx - s * 0.8, y); g.lineTo(cx + s * 0.8, y); g.quadraticCurveTo(cx + s * 0.78, y + s * 1.05, cx, y + s * 1.12);
  g.quadraticCurveTo(cx - s * 0.78, y + s * 1.05, cx - s * 0.8, y); g.fill();
  g.fillRect(cx - s * 0.1, y + s * 1.05, s * 0.2, s * 0.32);
  g.beginPath(); g.roundRect(cx - s * 0.5, y + s * 1.34, s, s * 0.2, s * 0.05); g.fill();
  g.fillStyle = lit ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.08)"; g.beginPath(); g.ellipse(cx - s * 0.36, y + s * 0.34, s * 0.09, s * 0.3, -0.2, 0, Math.PI * 2); g.fill();
}

/** Winner poster: the champions (or the solo winner) under a trophy, the margin and their star player. */
export async function winnerPosterImage(m: Match): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, H = 1350, { c, g } = canvas(W, H), p = poster(m), rand = rng(m.id), won = !!p.winner;
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  wall(g, W, 420);
  const glow = g.createRadialGradient(W / 2, 360, 20, W / 2, 360, 640); glow.addColorStop(0, `rgba(255,138,61,${won ? 0.4 : 0.14})`); glow.addColorStop(1, "rgba(255,138,61,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, 900);
  if (won) for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = 60 + rand() * 640, s = 8 + rand() * 12;
    g.save(); g.translate(x, y); g.rotate(rand() * Math.PI); g.globalAlpha = 0.35 + rand() * 0.5;
    g.fillStyle = [ORANGE, "#ffb27a", CREAM, "#ffffff"][Math.floor(rand() * 4)]; g.fillRect(-s / 2, -s / 4, s, s / 2); g.restore();
  }
  g.globalAlpha = 1;

  g.fillStyle = ORANGE; g.font = F(800, 34); g.fillText("GULLY CRICKET", 70, 96);
  g.textAlign = "right"; g.fillStyle = MUTE; g.font = F(500, 26); g.fillText(p.date, W - 70, 96); g.textAlign = "left";
  trophy(g, W / 2, 180, 170, won);

  g.textAlign = "center";
  const label = won ? (p.solo ? "G U L L Y   K I N G" : "C H A M P I O N S") : "H O N O U R S   E V E N";
  g.fillStyle = ORANGE; g.font = F(700, 30); g.fillText(label, W / 2, 530);
  const big = won ? p.winner! : p.headline;
  g.fillStyle = "#ffffff"; fit(g, big, 900, 140, 64, W - 140); g.fillText(big, W / 2, 660);
  g.fillStyle = CREAM; g.font = F(600, 40); g.fillText(clip(g, won ? p.margin : p.result, W - 140), W / 2, 730);
  g.fillStyle = MUTE; g.font = F(500, 30);
  g.fillText(clip(g, p.rows.slice(0, p.solo ? 3 : 2).map((r) => `${r.name} ${r.score}`).join(p.solo ? "  ·  " : "   v   "), W - 140), W / 2, 790);
  g.textAlign = "left";

  if (p.star) {
    const y = 860;
    g.fillStyle = PANEL; g.beginPath(); g.roundRect(70, y, W - 140, 200, 36); g.fill();
    g.strokeStyle = "rgba(255,138,61,.45)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = ORANGE; g.font = F(600, 26); g.fillText(p.solo ? "Top of the gully" : "Star of the side", 112, y + 56);
    g.fillStyle = "#ffffff"; g.font = F(800, 52); g.fillText(clip(g, p.star.name, 620), 112, y + 122);
    g.fillStyle = MUTE; g.font = F(500, 28); g.fillText(clip(g, p.star.line, 640), 112, y + 166);
    g.textAlign = "right"; g.fillStyle = ORANGE; g.font = F(800, 72); g.fillText(String(p.star.points), W - 112, y + 126);
    g.fillStyle = MUTE; g.font = F(500, 24); g.fillText("MVP points", W - 112, y + 166); g.textAlign = "left";
  }
  chalkStumps(g, 90, H - 250, 120, rand);
  footer(g, p, W, H);
  return png(c);
}

export type ImageKind = "full" | "card" | "match" | "winner";
const FILES: Record<ImageKind, string> = { full: "gully-full-scorecard.png", card: "gully-scorecard.png", match: "gully-match-poster.png", winner: "gully-winner-poster.png" };
const DRAW: Record<ImageKind, (m: Match) => Promise<Blob>> = { full: fullScorecardImage, card: scorecardImage, match: matchPosterImage, winner: winnerPosterImage };

/** The share sheet with the file when the browser can share files, a download otherwise. */
async function shareFile(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement("a"), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareImage(m: Match, kind: ImageKind = "full") {
  track(EV.share, { what: IMAGE_SHARE[kind] });
  await shareFile(await DRAW[kind](m), FILES[kind], E.result(m)?.text ?? "");
}

export const imageFor = (m: Match, kind: ImageKind) => DRAW[kind](m);

export const shareText = (m: Match) => (track(EV.share, { what: "text" }), window.open("https://wa.me/?text=" + encodeURIComponent(summaryText(m)), "_blank"));

/** Prints the scoresheet from a hidden frame, so "Save as PDF" in the print dialog gives the PDF. */
export function printScoresheet(m: Match) {
  track(EV.share, { what: "pdf" });
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const doc = f.contentDocument!;
  doc.open(); doc.write(scoresheetHtml(m)); doc.close();
  setTimeout(() => {
    f.contentWindow?.focus(); f.contentWindow?.print();
    setTimeout(() => f.remove(), 60_000);
  }, 250);
}

/** Saves text as a CSV download. */
export function downloadCsv(text: string, name: string) {
  track(EV.share, { what: "csv" });
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
