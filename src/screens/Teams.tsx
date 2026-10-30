import { useState } from "react";
import * as E from "../engine/engine";
import type { SavedTeam } from "../engine/tournament";
import { useStore } from "../store";
import { average, economy, profile, strikeRate } from "../stats";
import { Badge, BottomNav, Card, Header, PrimaryButton, Sheet } from "../ui";

function TeamEditor({ team, onClose }: { team: SavedTeam; onClose: () => void }) {
  const { putTeam, removeTeam, openPlayer } = useStore();
  const [t, setT] = useState(team);
  const [v, setV] = useState("");
  const save = (next: SavedTeam) => { setT(next); putTeam(next); };
  return (
    <Sheet title="Edit team" onClose={onClose}>
      <input value={t.name} onChange={(e) => save({ ...t, name: e.target.value })} maxLength={18}
        className="min-h-12 w-full rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none" />
      <p className="mb-2 mt-4 text-sm font-semibold text-teal">Squad ({t.players.length})</p>
      <div className="flex flex-wrap gap-2">
        {t.players.map((p) => (
          <span key={p.id} className="flex min-h-10 items-center gap-1 rounded-full bg-sun-soft pl-3 text-sm font-semibold text-fg">
            <button onClick={() => openPlayer(p.name)} className="underline-offset-2 hover:underline">{p.name}</button>
            <button onClick={() => save({ ...t, players: t.players.filter((x) => x.id !== p.id) })} className="px-3 text-mute" aria-label={`Remove ${p.name}`}>✕</button>
          </span>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { save({ ...t, players: [...t.players, { id: E.uid(), name: v.trim() }] }); setV(""); } }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a player" maxLength={20} autoFocus
          className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />
        <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
      </form>
      <button onClick={() => { if (confirm(`Delete ${t.name}?`)) { removeTeam(t.id); onClose(); } }} className="press mt-5 min-h-12 w-full rounded-2xl font-semibold text-out">Delete team</button>
    </Sheet>
  );
}

export function Teams() {
  const { teams, saveTeam } = useStore();
  const [edit, setEdit] = useState<SavedTeam | null>(null);
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen pb-28">
      <Header title="My Teams" />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { setEdit(saveTeam(name, [])); setName(""); } }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name" maxLength={18}
            className="min-h-14 flex-1 rounded-2xl border-2 border-line bg-panel px-4 font-semibold outline-none focus:border-sun" />
          <button className="press min-h-14 rounded-2xl bg-sun px-5 font-bold text-ink">Create</button>
        </form>
        {teams.map((t) => (
          <button key={t.id} onClick={() => setEdit(t)} className="press block w-full text-left">
            <Card className="flex items-center gap-3">
              <Badge name={t.name} />
              <span className="flex-1"><span className="block font-bold text-fg">{t.name}</span>
                <span className="text-sm text-mute">{t.players.length ? t.players.map((p) => p.name).join(", ") : "No players yet"}</span></span>
              <span className="text-mute">›</span>
            </Card>
          </button>
        ))}
        {!teams.length && <p className="pt-6 text-center text-sm text-mute">Teams you play with are saved here automatically, with their squads.</p>}
      </main>
      {edit && <TeamEditor team={edit} onClose={() => setEdit(null)} />}
      <BottomNav />
    </div>
  );
}

export function PlayerProfile() {
  const { matches, player, go } = useStore();
  if (!player) return null;
  const p = profile(matches, player);
  const stat = (k: string, v: string | number) => (
    <div className="min-w-0 rounded-2xl bg-key px-1 py-3 text-center"><p className="text-xl font-extrabold text-fg tabular-nums">{v}</p><p className="text-[10px] font-medium leading-tight text-mute min-[360px]:text-[11px]">{k}</p></div>
  );
  return (
    <div className="min-h-screen pb-10">
      <Header title="Player" back={() => go("stats")}>
        <div className="mt-2 flex flex-col items-center">
          <Badge name={p.name} size={72} />
          <p className="mt-2 text-2xl font-extrabold text-fg">{p.name}</p>
          <p className="text-sm text-mute">{p.matches} match{p.matches === 1 ? "" : "es"}</p>
        </div>
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Card>
          <p className="mb-3 text-sm font-semibold text-teal">Batting</p>
          <div className="grid grid-cols-4 gap-2">
            {stat("Runs", p.runs)}{stat("Highest", `${p.best}${p.bestNotOut && p.innings ? "*" : ""}`)}{stat("Average", average(p).toFixed(1))}{stat("Strike rate", strikeRate(p.runs, p.balls).toFixed(0))}
            {stat("Innings", p.innings)}{stat("Not outs", p.notOuts)}{stat("Fours", p.fours)}{stat("Sixes", p.sixes)}
            {stat("30s", p.thirties)}{stat("50s", p.fifties)}{stat("Balls", p.balls)}{stat("Matches", p.matches)}
          </div>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-teal">Bowling</p>
          <div className="grid grid-cols-4 gap-2">
            {stat("Wickets", p.wickets)}{stat("Best", p.bowlInnings ? `${p.bestW}/${p.bestR === Infinity ? 0 : p.bestR}` : "-")}{stat("Economy", economy(p.conceded, p.legal).toFixed(1))}{stat("Overs", E.oversText(p.legal))}
          </div>
        </Card>
        {p.recent.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <p className="px-4 pt-3 text-sm font-semibold text-teal">Recent matches</p>
            {p.recent.map((r) => (
              <button key={r.matchId} onClick={() => go("scorecard", r.matchId)} className="press flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left first:border-0">
                <span className="flex-1"><span className="block font-semibold text-fg">vs {r.vs}</span>
                  <span className="text-xs text-mute">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                <span className="text-right text-sm tabular-nums"><span className="block font-bold text-fg">{r.bat || "-"}</span><span className="text-mute">{r.bowl}</span></span>
              </button>
            ))}
          </Card>
        )}
        <PrimaryButton tone="navy" onClick={() => go("stats")}>Back to leaderboard</PrimaryButton>
      </main>
    </div>
  );
}
