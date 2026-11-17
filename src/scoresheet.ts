import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { matchAwards, mvp } from "./mvp";
import { posterDate } from "./poster";

/** The whole match as a printable A4 page. The web prints it, the app turns it into a PDF with expo-print. */

const esc = (s: string | number) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const table = (head: string[], rows: (string | number)[][], first = 1) => `<table><thead><tr>${head.map((h, i) =>
  `<th${i >= first ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) =>
  `<tr>${r.map((c, i) => `<td${i >= first ? ' class="n"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

/** "Extras 4 (wd 1, nb 1, b 2, lb 0)", then penalty runs and runs taken off for dismissals when there are any. */
export function extrasLine(st: E.State): string {
  const ex = st.extras, more = [st.penalties ? `penalty runs ${st.penalties}` : "", st.deducted ? `${st.deducted} off for dismissals` : ""].filter(Boolean);
  return `Extras ${ex.wd + ex.nb + ex.b + ex.lb} (wd ${ex.wd}, nb ${ex.nb}, b ${ex.b}, lb ${ex.lb})${more.length ? `, ${more.join(", ")}` : ""}`;
}

/** Heading for one innings: the team, or the batter in solo, with the Test innings or super over. */
export function inningsTitle(m: Match, i: number): string {
  const inn = m.innings[i];
  if (E.isSolo(m)) return E.inningsLabel(m, i);
  const tag = inn.superOver ? " (super over)" : E.isTest(m) ? `, ${E.inningsLabel(m, i)}` : "";
  return `${m.teams[inn.bat].name}${tag}`;
}

function inningsBlock(m: Match, i: number): string {
  const st = E.replay(m, i), name = (id: string) => E.playerName(m, id);
  const bat = st.order.map((id) => {
    const b = st.bat.get(id)!;
    return [name(id), E.howOut(m, b), b.runs, b.balls, b.fours, b.sixes, b.balls ? Math.round((b.runs * 100) / b.balls) : 0];
  });
  const bowl = st.bowlOrder.map((id) => {
    const w = st.bowl.get(id)!;
    return [name(id), E.oversText(w.legal, st.bpo), w.maidens, w.runs, w.wickets, w.legal ? ((w.runs * st.bpo) / w.legal).toFixed(1) : "0.0", w.wides, w.noBalls];
  });
  const overs = E.ballByBall(m, i).map((o, k) => `<span class="ov"><b>${k + 1}</b> ${o.map((b) => esc(b.label)).join(" ")}</span>`).join("");
  return `<section>
<h2><span>${esc(inningsTitle(m, i))}</span><span>${esc(E.inningsScore(m, i))} (${esc(E.oversText(st.legal, st.bpo))} ov)</span></h2>
${table(["Batter", "How out", "R", "B", "4s", "6s", "SR"], bat, 2)}
<p>${esc(extrasLine(st))}. Total ${st.runs}/${st.wickets} in ${E.oversText(st.legal, st.bpo)} overs, run rate ${E.runRate(st.runs, st.legal, st.bpo).toFixed(2)}.</p>
${st.fow.length ? `<p><b>Fall of wickets</b> ${esc(st.fow.map((f) => `${f.score}-${f.wicket} (${name(f.id)}, ${f.over})`).join(", "))}</p>` : ""}
${bowl.length ? table(["Bowler", "O", "M", "R", "W", "Econ", "Wd", "Nb"], bowl) : ""}
${overs ? `<p class="overs">${overs}</p>` : ""}
</section>`;
}

const CSS = `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:-apple-system,Roboto,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;background:#fff;margin:0;font-size:11.5px;line-height:1.45}
header{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:12px}h1{font-size:22px;margin:0;letter-spacing:-.3px}.meta{color:#555;margin-top:2px}
.res{font-size:16px;font-weight:700;margin-top:8px}h2{display:flex;justify-content:space-between;font-size:14px;margin:0 0 6px;padding:6px 8px;background:#f1f1ee;border-radius:4px}
h3{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#555;margin:14px 0 6px}section{margin:14px 0;break-inside:avoid}
table{width:100%;border-collapse:collapse;margin:4px 0 6px}th,td{text-align:left;padding:3px 6px;border-bottom:1px solid #ddd}th{font-size:10px;color:#555;font-weight:600}
.n{text-align:right;font-variant-numeric:tabular-nums}p{margin:4px 0}.overs{color:#444;font-size:10.5px}.ov{display:inline-block;margin-right:12px;white-space:nowrap}
.aw{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}.aw div{padding:4px 0;border-bottom:1px solid #eee}.aw b{display:block;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.5px}
footer{margin-top:18px;color:#777;font-size:10px;border-top:1px solid #ddd;padding-top:6px}`;

/** A complete HTML document for the match scoresheet. */
export function scoresheetHtml(m: Match): string {
  const res = E.result(m), solo = E.isSolo(m), awards = matchAwards(m), rows = mvp(m);
  const title = solo ? `Solo, ${m.teams[0].players.length} players` : `${m.teams[0].name} vs ${m.teams[1].name}`;
  const toss = !solo && m.toss ? `Toss: ${m.teams[m.toss.winner].name}, elected to ${m.toss.choice}` : "";
  const standings = solo ? `<h3>Standings</h3>${table(["#", "Player", "R", "B", "SR", "4s", "6s", "Out", "W"], E.soloStandings(m).map((r, i) =>
    [i + 1, r.name, r.runs, r.balls, r.strikeRate.toFixed(0), r.fours, r.sixes, r.outs, r.wickets]), 2)}` : "";
  const aw = awards.length ? `<h3>Awards</h3><div class="aw">${awards.map((a) => `<div><b>${esc(a.title)}</b>${esc(a.name)}, ${esc(a.line)}</div>`).join("")}</div>` : "";
  const mv = rows.length ? `<h3>MVP points</h3>${table(["#", "Player", "Bat", "Bowl", "Field", "Points"], rows.slice(0, 11).map((r, i) =>
    [i + 1, r.name, r.batting, r.bowling, r.fielding, r.points]), 2)}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)} scoresheet</title><style>${CSS}</style></head><body>
<header><h1>${esc(title)}</h1><div class="meta">Gully cricket scoresheet · ${esc(posterDate(m))} · ${esc(E.formatText(m))}${toss ? ` · ${esc(toss)}` : ""}</div>
<div class="res">${esc(res?.text ?? E.testStatus(m) ?? "Match in progress")}</div></header>
${standings}${aw}
${m.innings.map((_, i) => inningsBlock(m, i)).join("\n")}
${mv}
<footer>Scored with ai.sahilchalke.com/score</footer>
</body></html>`;
}
