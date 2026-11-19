import { useState } from "react";
import * as E from "../engine/engine";
import type { SavedTeam } from "../engine/tournament";
import { useStore } from "../store";
import { track } from "../track";
import { EV } from "../events";
import { average, bowlAverage, bowlStrikeRate, economy, playerPool, profile, strikeRate } from "../stats";
import { infoLine, ROLES, STYLES, type PlayerInfo } from "../playerInfo";
import { uniqueNames } from "../kitty";
import { knownNames } from "../kittyView";
import { mergeReach } from "../merge";
import { cleanUpi, validUpi } from "../upi";
import {
  filterMatches, fmtFor, kindsPlayed, matchesLine, PROFILE_KINDS, skillCard, skillCardText, startKind, TIER_COLOR, yearsPlayed, type Kind, type SkillCard,
} from "../playerCard";
import { AddFromGroup, GroupsSheet } from "../groupsUi";
import { pickPhoto } from "../photoUi";
import { validPhoto } from "../photo";
import { recapText } from "../season";
import { Badge, BottomNav, Card, ConfirmSheet, cx, Header, PrimaryButton, Segmented, Sheet } from "../ui";

function TeamEditor({ team, onClose }: { team: SavedTeam; onClose: () => void }) {
  const { putTeam, removeTeam, openPlayer } = useStore();
  const [t, setT] = useState(team);
  const [v, setV] = useState("");
  const [askDel, setAskDel] = useState(false);
  const [fromGroup, setFromGroup] = useState(false);
  const save = (next: SavedTeam) => { setT(next); putTeam(next); };
  return (<>
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
      <button onClick={() => setFromGroup(true)} className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Add from a group</button>
      <button onClick={() => setAskDel(true)} className="press mt-5 min-h-12 w-full rounded-2xl font-semibold text-out">Delete team</button>
    </Sheet>
    {fromGroup && <AddFromGroup team={t} onAdd={save} onClose={() => setFromGroup(false)} />}
    {askDel && <ConfirmSheet title={`Delete ${t.name}?`} body="Past matches keep their scores." yes="Delete" danger
      onYes={() => { track(EV.team_delete); removeTeam(t.id); onClose(); }} onClose={() => setAskDel(false)} />}
  </>);
}

const chip = (on: boolean) => cx("press min-h-11 rounded-full border px-4 text-sm font-semibold", on ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg");

/** Two names that are the same person: pick the one to drop, then the one to keep. */
function MergeSheet({ onClose }: { onClose: () => void }) {
  const { matches, teams, kitty, infos, mergePlayers } = useStore();
  const names = uniqueNames([...playerPool(matches, teams), ...knownNames(teams, matches, kitty)]);
  const [from, setFrom] = useState<string | null>(null);
  const [into, setInto] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState(false);
  const shown = names.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  const reach = from ? mergeReach({ matches, teams, infos, kitty }, from) : null;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (<>
    <Sheet title="Merge players" onClose={onClose}
      footer={<PrimaryButton disabled={!from || !into} onClick={() => setAsk(true)}>{from && into ? `Merge ${from} into ${into}` : "Merge"}</PrimaryButton>}>
      <p className="text-sm text-mute">Same person saved under two names? Merge them and their matches, teams, details and kitty all add up under one name.</p>
      {names.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names" maxLength={20}
        className="mt-3 min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun" />}
      <p className="mb-2 mt-4 text-sm font-semibold text-teal">Name to drop</p>
      <div className="flex flex-wrap gap-2">
        {shown.map((n) => <button key={n} onClick={() => { setFrom(n); if (into === n) setInto(null); }} aria-pressed={from === n} className={chip(from === n)}>{n}</button>)}
      </div>
      {from && <>
        <p className="mb-2 mt-5 text-sm font-semibold text-teal">Same person as</p>
        <div className="flex flex-wrap gap-2">
          {shown.filter((n) => n !== from).map((n) => <button key={n} onClick={() => setInto(n)} aria-pressed={into === n} className={chip(into === n)}>{n}</button>)}
        </div>
      </>}
      {!names.length && <p className="mt-4 text-sm text-mute">No players yet.</p>}
    </Sheet>
    {ask && from && into && reach && (
      <ConfirmSheet title={`Merge ${from} into ${into}?`} yes="Merge"
        body={`${from} becomes ${into} in ${plural(reach.matches, "match", "matches")}, ${plural(reach.teams, "team", "teams")} and ${plural(reach.kitty, "kitty entry", "kitty entries")}. Their player details are combined. You can undo this merge.`}
        onYes={() => { track(EV.merge_players); mergePlayers(from, into); onClose(); }} onClose={() => setAsk(false)} />
    )}
  </>);
}

export function Teams() {
  const { teams, saveTeam, lastMerge, undoMerge } = useStore();
  const [edit, setEdit] = useState<SavedTeam | null>(null);
  const [name, setName] = useState("");
  const [merging, setMerging] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  return (
    <div className="min-h-screen pb-28">
      <Header title="My Teams" />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { track(EV.team_save); setEdit(saveTeam(name, [])); setName(""); } }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name" maxLength={18}
            className="min-h-14 flex-1 rounded-2xl border-2 border-line bg-panel px-4 font-semibold outline-none focus:border-sun" />
          <button className="press min-h-14 rounded-2xl bg-sun px-5 font-bold text-ink">Create</button>
        </form>
        <button onClick={() => setGroupsOpen(true)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Player groups</button>
        <button onClick={() => setMerging(true)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Merge players</button>
        {lastMerge && (
          <Card className="flex items-center gap-3 !py-3">
            <span className="flex-1 text-sm text-fg">Merged <b>{lastMerge.from}</b> into <b>{lastMerge.into}</b>.</span>
            <button onClick={() => { track(EV.undo_merge); undoMerge(); }} className="press min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-sun">Undo merge</button>
          </Card>
        )}
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
      {merging && <MergeSheet onClose={() => setMerging(false)} />}
      {groupsOpen && <GroupsSheet onClose={() => setGroupsOpen(false)} />}
      <BottomNav />
    </div>
  );
}

function Choice<T extends string>({ items, value, set }: { items: readonly (readonly [T, string])[]; value: T | undefined; set: (v: T | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([v, label]) => (
        <button key={v} onClick={() => set(value === v ? undefined : v)} aria-pressed={value === v}
          className={cx("press min-h-11 rounded-full border px-4 text-sm font-semibold", value === v ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>{label}</button>
      ))}
    </div>
  );
}

function InfoEditor({ name, info, onClose }: { name: string; info: PlayerInfo; onClose: () => void }) {
  const { setInfo } = useStore();
  const [i, setI] = useState(info);
  const [upi, setUpi] = useState(info.upi ?? "");
  const put = (patch: Partial<PlayerInfo>) => setI({ ...i, ...patch });
  const label = (t: string) => <p className="mb-2 mt-4 text-sm font-semibold text-teal first:mt-0">{t}</p>;
  const upiOk = !upi.trim() || validUpi(upi);
  const save = () => { track(EV.player_details_save); setInfo(name, { ...i, upi: upi.trim() ? cleanUpi(upi) : undefined }); onClose(); };
  return (
    <Sheet title={`About ${name}`} onClose={onClose}
      footer={<PrimaryButton disabled={!upiOk} onClick={save}>Save</PrimaryButton>}>
      {label("Photo")}
      <div className="flex items-center gap-3">
        {validPhoto(i.photo) ? <img src={i.photo} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10" /> : <Badge name={name} size={64} />}
        <button onClick={() => { void pickPhoto().then((p) => { if (p) { track(EV.player_photo_set); put({ photo: p }); } }); }}
          className="press min-h-11 rounded-full border-2 border-line px-4 text-sm font-semibold text-fg">{i.photo ? "Change photo" : "Add photo"}</button>
        {i.photo && <button onClick={() => put({ photo: undefined })} className="press min-h-11 px-2 text-sm font-semibold text-out">Remove</button>}
      </div>
      {label("Role")}
      <Choice items={ROLES} value={i.role} set={(role) => put({ role })} />
      {label("Bats")}
      <Choice items={[["R", "Right-handed"], ["L", "Left-handed"]] as const} value={i.hand} set={(hand) => put({ hand })} />
      {label("Bowls with")}
      <Choice items={[["R", "Right arm"], ["L", "Left arm"]] as const} value={i.arm} set={(arm) => put({ arm })} />
      {label("Bowling type")}
      <Choice items={[["pace", "Pace"], ["spin", "Spin"]] as const} value={i.bowl} set={(bowl) => put({ bowl, style: undefined })} />
      {i.bowl && <>
        {label("Kind (optional)")}
        <Choice items={STYLES[i.bowl].map((x) => [x, x] as const)} value={i.style} set={(style) => put({ style })} />
      </>}
      {label("UPI ID (optional)")}
      <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@okaxis" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60}
        className="min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-fg outline-none focus:border-sun" />
      <p className={cx("mt-1.5 text-xs", upiOk ? "text-mute" : "text-out")}>{upiOk ? "Lets the kitty show a QR when someone owes them. Stays on this phone." : "A UPI ID looks like name@bank."}</p>
    </Sheet>
  );
}

/** The premium card: rating, tier, role and three numbers, tinted by tier. */
function SkillCardView({ c }: { c: SkillCard }) {
  const col = TIER_COLOR[c.tier];
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 p-5" style={{ borderColor: col, background: `linear-gradient(155deg, ${col}33, #101012 60%)` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-6xl font-extrabold leading-none tabular-nums" style={{ color: col }}>{c.score}</p>
          <p className="mt-1 text-sm font-bold" style={{ color: col }}>{c.tier}</p>
        </div>
        <Badge name={c.name} size={60} />
      </div>
      <p className="mt-4 truncate text-2xl font-extrabold text-fg">{c.name}</p>
      <p className="text-sm text-fg/75">{c.role}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        {c.stats.map((x) => (
          <div key={x.label} className="text-center"><p className="text-xl font-extrabold tabular-nums text-fg">{x.value}</p><p className="text-[11px] font-medium text-mute">{x.label}</p></div>
        ))}
      </div>
    </div>
  );
}

export function PlayerProfile() {
  const { matches, player, go, fmt, infos } = useStore();
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<Kind>(() => startKind(kindsPlayed(matches, player ?? ""), fmt));
  const [year, setYear] = useState<number | null>(null);
  if (!player) return null;
  const years = yearsPlayed(matches, player, kind);
  const pool = filterMatches(matches, kind, year);
  const p = profile(pool, player, fmtFor(kind));
  const info = infos[player.trim().toLowerCase()] ?? {};
  const line = infoLine(info);
  const card = skillCard(pool, player, kind, info);
  const pick = (k: Kind) => { setKind(k); setYear(null); if (k !== "solo") useStore.setState({ fmt: k }); };
  const share = () => { track(EV.share, { what: "skill_card" }); window.open("https://wa.me/?text=" + encodeURIComponent(skillCardText(card)), "_blank"); };
  const recapYear = year ?? new Date().getFullYear();
  const recap = recapText(matches, player, recapYear, `${location.origin}${import.meta.env.BASE_URL}`);
  const shareYear = () => { track(EV.recap_share, { year: recapYear }); window.open("https://wa.me/?text=" + encodeURIComponent(recap!), "_blank"); };
  const num = (v: number | null, d = 1) => (v === null ? "-" : v.toFixed(d));
  const stat = (k: string, v: string | number) => (
    <div className="min-w-0 rounded-2xl bg-key px-1 py-3 text-center"><p className="text-xl font-extrabold text-fg tabular-nums">{v}</p><p className="text-[10px] font-medium leading-tight text-mute min-[360px]:text-[11px]">{k}</p></div>
  );
  return (
    <div className="min-h-screen pb-10">
      <Header title="Player" back={() => go("stats")}>
        <div className="mt-2 flex flex-col items-center">
          <Badge name={p.name} size={72} />
          <p className="mt-2 text-2xl font-extrabold text-fg">{p.name}</p>
          <p className="text-center text-sm text-fg/80">{line || "Role and bowling style not set"}</p>
          <button onClick={() => setEditing(true)} className="press mt-2 min-h-10 rounded-full border border-line bg-key px-4 text-sm font-semibold text-sun">✎ Edit player details</button>
        </div>
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Segmented value={kind} set={pick} items={PROFILE_KINDS} />
        {years.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {[null, ...years].map((y) => (
              <button key={y ?? "all"} onClick={() => setYear(y)} aria-pressed={year === y} className={cx(chip(year === y), "min-h-10")}>{y ?? "All years"}</button>
            ))}
          </div>
        )}
        <p className="text-center text-sm text-mute">{matchesLine(p.matches, kind, year)}</p>
        {card.matches > 0 && <>
          <SkillCardView c={card} />
          <button onClick={share} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Share card</button>
          {recap && <button onClick={shareYear} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Share my {recapYear}</button>}
        </>}
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
            {stat("Overs", E.oversText(p.legal))}{stat("Runs", p.conceded)}{stat("Wickets", p.wickets)}{stat("Best", p.bowlInnings ? `${p.bestW}/${p.bestR === Infinity ? 0 : p.bestR}` : "-")}
            {stat("Economy", economy(p.conceded, p.legal).toFixed(1))}{stat("Average", num(bowlAverage(p)))}{stat("Strike rate", num(bowlStrikeRate(p)))}{stat("Maidens", p.maidens)}
            {stat("Wides", p.wides)}{stat("No-balls", p.noBalls)}
          </div>
          <p className="mt-2 text-xs text-mute">Bowling strike rate is balls bowled per wicket.</p>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-teal">Fielding</p>
          <div className="grid grid-cols-3 gap-2">{stat("Catches", p.catches)}{stat("Run outs", p.runOuts)}{stat("Stumpings", p.stumpings)}</div>
          <p className="mt-2 text-xs text-mute">Counted when you name the fielder on the wicket.</p>
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
      {editing && <InfoEditor name={p.name} info={info} onClose={() => setEditing(false)} />}
    </div>
  );
}
