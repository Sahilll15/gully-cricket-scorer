import { useState } from "react";
import { decodeGroup, groupLink, groupShareText, MAX_GROUP_PLAYERS, playersFrom, type PlayerGroup } from "./groups";
import * as E from "./engine/engine";
import type { SavedTeam } from "./engine/tournament";
import { boardText, groupBoard, pollText, splitGroup, weeklyNudge, type Span } from "./season";
import { useStore } from "./store";
import { track } from "./track";
import { EV } from "./events";
import { Card, ConfirmSheet, cx, PrimaryButton, Sheet } from "./ui";

const base = () => `${location.origin}${import.meta.env.BASE_URL}`;
const names = (g: PlayerGroup) => g.players.map((p) => p.name).join(", ");
const input = "min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 outline-none focus:border-sun";

const send = (text: string) => window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");

/** Leaderboard, weekly nudge, who-is-in message and a fair split, all for one group. */
function GroupPlay({ group }: { group: PlayerGroup }) {
  const { matches, saveTeam } = useStore();
  const [span, setSpan] = useState<Span>("week");
  const [seed, setSeed] = useState(0);
  const [split, setSplit] = useState(false);
  const rows = groupBoard(matches, group, span);
  const nudge = weeklyNudge(matches, group, base());
  const two = split && group.players.length >= 2 ? splitGroup(matches, group, seed) : null;
  const btn = "press min-h-12 rounded-2xl border-2 border-line font-semibold text-fg disabled:opacity-40";
  return (<>
    <p className="mb-2 mt-5 text-sm font-semibold text-teal">Leaderboard</p>
    <div className="mb-2 flex gap-2">
      {(["week", "all"] as const).map((s) => (
        <button key={s} onClick={() => setSpan(s)} aria-pressed={span === s}
          className={cx("press min-h-10 rounded-full border-2 px-4 text-sm font-semibold", span === s ? "border-sun bg-sun text-ink" : "border-line text-fg")}>{s === "week" ? "This week" : "All time"}</button>
      ))}
    </div>
    <div className="rounded-2xl bg-key px-3 py-1">
      {rows.slice(0, 5).map((r, i) => (
        <p key={r.name} className="flex items-center gap-2 border-t border-line py-2 text-sm first:border-0">
          <span className="w-4 font-bold text-mute">{i + 1}</span><span className="flex-1 truncate font-semibold text-fg">{r.name}</span>
          <span className="text-mute">{r.runs} runs · {r.wickets} wkts</span><b className="w-10 text-right text-fg tabular-nums">{r.points}</b>
        </p>
      ))}
      {!rows.length && <p className="py-3 text-sm text-mute">No matches {span === "week" ? "this week" : "yet"} with these players.</p>}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button disabled={!rows.length} className={btn} onClick={() => { track(EV.group_board_share, { span }); send(boardText(group, rows, span, base())); }}>Send board</button>
      <button disabled={!nudge} className={btn} onClick={() => { track(EV.group_board_share, { span: "nudge" }); send(nudge!); }}>Send weekly recap</button>
    </div>
    <p className="mb-2 mt-5 text-sm font-semibold text-teal">Next game</p>
    <div className="grid grid-cols-2 gap-2">
      <button disabled={!group.players.length} className={btn} onClick={() => { track(EV.group_poll); send(pollText(group, "this Sunday", base())); }}>Who is in?</button>
      <button disabled={group.players.length < 2} className={btn} onClick={() => { track(EV.group_split); setSplit(true); setSeed(seed + (split ? 1 : 0)); }}>{split ? "Reshuffle" : "Split fairly"}</button>
    </div>
    {two && (
      <div className="mt-2 rounded-2xl bg-key p-3 text-sm">
        {[two.a, two.b].map((side, i) => <p key={i} className="py-0.5"><b className="text-fg">Team {i + 1}</b> <span className="text-mute">{side.join(", ")}</span></p>)}
        {two.common && <p className="text-xs text-mute">{two.common} plays for both.</p>}
        <button className="press mt-2 min-h-11 w-full rounded-2xl bg-sun font-bold text-ink"
          onClick={() => { saveTeam(`${group.name} 1`, two.a.map((name) => ({ id: E.uid(), name }))); saveTeam(`${group.name} 2`, two.b.map((name) => ({ id: E.uid(), name }))); setSplit(false); }}>Save as two teams</button>
      </div>
    )}
  </>);
}

function GroupEditor({ group, onClose }: { group: PlayerGroup; onClose: () => void }) {
  const { putGroup, removeGroup } = useStore();
  const [g, setG] = useState(group);
  const [v, setV] = useState("");
  const [note, setNote] = useState("");
  const [askDel, setAskDel] = useState(false);
  const save = (next: PlayerGroup) => { setG(next); putGroup(next); };
  const add = () => {
    const have = new Set(g.players.map((p) => p.name.toLowerCase()));
    const fresh = v.split(/[,\n]/).map((n) => n.trim().replace(/\s+/g, " ").slice(0, 20)).filter((n) => n && !have.has(n.toLowerCase()));
    const uniq = [...new Map(fresh.map((n) => [n.toLowerCase(), n])).values()].slice(0, MAX_GROUP_PLAYERS - g.players.length);
    if (uniq.length) { track(EV.group_save); save({ ...g, players: [...g.players, ...uniq.map((name) => ({ id: E.uid(), name }))] }); }
    setV("");
  };
  const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text).then(() => setNote(`${what} copied`)); };
  const canShare = g.players.length > 0;
  return (<>
    <Sheet title="Edit group" onClose={onClose}>
      <input aria-label="Group name" value={g.name} onChange={(e) => save({ ...g, name: e.target.value.slice(0, 24) })} maxLength={24}
        className="min-h-12 w-full rounded-2xl bg-key px-4 text-lg font-bold text-fg outline-none" />
      <p className="mb-2 mt-4 text-sm font-semibold text-teal">Players ({g.players.length})</p>
      <div className="flex flex-wrap gap-2">
        {g.players.map((p) => (
          <span key={p.id} className="flex min-h-10 items-center gap-1 rounded-full bg-sun-soft pl-3 text-sm font-semibold text-fg">
            {p.name}
            <button onClick={() => save({ ...g, players: g.players.filter((x) => x.id !== p.id) })} className="px-3 text-mute" aria-label={`Remove ${p.name}`}>✕</button>
          </span>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input aria-label="Add players" value={v} onChange={(e) => setV(e.target.value)} placeholder="Add players, commas for several" className={cx(input, "flex-1")} />
        <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
      </form>
      <GroupPlay group={g} />
      <p className="mb-2 mt-5 text-sm font-semibold text-teal">Share this group</p>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={!canShare} onClick={() => { track(EV.group_share, { how: "whatsapp" }); window.open("https://wa.me/?text=" + encodeURIComponent(groupShareText(g, base())), "_blank"); }}
          className="press min-h-12 rounded-2xl bg-sun font-bold text-ink disabled:opacity-40">WhatsApp</button>
        <button disabled={!canShare} onClick={() => { track(EV.group_share, { how: "link" }); copy(groupLink(g, base()), "Link"); }}
          className="press min-h-12 rounded-2xl border-2 border-line font-semibold text-fg disabled:opacity-40">Copy link</button>
      </div>
      <p className="mt-2 text-xs text-mute">{note || "They get a copy. Edits don't sync."}</p>
      <button onClick={() => setAskDel(true)} className="press mt-4 min-h-12 w-full rounded-2xl font-semibold text-out">Delete group</button>
    </Sheet>
    {askDel && <ConfirmSheet title={`Delete ${g.name}?`} body="Teams already made from it keep their players." yes="Delete" danger
      onYes={() => { removeGroup(g.id); onClose(); }} onClose={() => setAskDel(false)} />}
  </>);
}

/** All saved groups, plus create and import. Opened from the Teams screen. */
export function GroupsSheet({ onClose }: { onClose: () => void }) {
  const { groups, saveGroup, importGroup } = useStore();
  const [edit, setEdit] = useState<PlayerGroup | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const create = () => { if (name.trim()) { track(EV.group_save); setEdit(saveGroup(name)); setName(""); } };
  const doImport = () => {
    const inv = decodeGroup(code);
    if (!inv) { setMsg("That is not a group code or link."); return; }
    track(EV.group_import);
    const r = importGroup(inv);
    setCode(""); setMsg(`Added ${r.group.name}.`);
  };
  return (<>
    <Sheet title="Player groups" onClose={onClose}>
      <p className="text-sm text-mute">Save a squad once. Reuse it for any team.</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <input aria-label="New group name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New group, e.g. Sunday boys" maxLength={24} className={cx(input, "flex-1")} />
        <button className="press min-h-12 rounded-2xl bg-sun px-5 font-bold text-ink">Create</button>
      </form>
      <div className="mt-3 space-y-2">
        {groups.map((g) => (
          <button key={g.id} onClick={() => setEdit(g)} className="press block w-full text-left">
            <Card className="!py-3"><p className="font-bold text-fg">{g.name} <span className="font-normal text-mute">· {g.players.length}</span></p>
              <p className="truncate text-sm text-mute">{g.players.length ? names(g) : "No players yet"}</p></Card>
          </button>
        ))}
        {!groups.length && <p className="py-3 text-center text-sm text-mute">No groups yet.</p>}
      </div>
      <p className="mb-2 mt-4 text-sm font-semibold text-teal">Import a group</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); doImport(); }}>
        <input aria-label="Link or code" value={code} onChange={(e) => { setCode(e.target.value); setMsg(""); }} placeholder="Paste a link or code" className={cx(input, "flex-1")} />
        <button disabled={!code.trim()} className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white disabled:opacity-40">Import</button>
      </form>
      {msg && <p className="mt-2 text-sm text-mute">{msg}</p>}
    </Sheet>
    {edit && <GroupEditor group={edit} onClose={() => setEdit(null)} />}
  </>);
}

/** Opens when a group link was followed (or a code pasted elsewhere), on whatever screen the app is showing. */
export function InviteSheet() {
  const { groupInvite: inv, setGroupInvite, importGroup, setMe, me, go } = useStore();
  const [who, setWho] = useState<string | null>(null);
  if (!inv) return null;
  const mine = who ?? (me && inv.names.find((n) => n.toLowerCase() === me.toLowerCase())) ?? null;
  return (
    <Sheet title="Add this group?" onClose={() => { setWho(null); setGroupInvite(null); }}
      footer={<PrimaryButton onClick={() => { track(EV.group_import, { via: "link", claimed: mine ? 1 : 0 }); importGroup(inv); if (mine) setMe(mine); setWho(null); go("teams"); }}>{mine ? `Add, I am ${mine}` : "Add to my groups"}</PrimaryButton>}>
      <p className="text-lg font-bold text-fg">{inv.name}</p>
      <p className="mt-1 text-sm text-mute">{inv.names.length} players: {inv.names.join(", ")}</p>
      <p className="mb-2 mt-4 text-sm font-semibold text-teal">Which one is you? <span className="font-normal text-mute">(optional)</span></p>
      <div className="flex flex-wrap gap-2">
        {inv.names.map((n) => (
          <button key={n} onClick={() => setWho(mine === n ? "" : n)} aria-pressed={mine === n}
            className={cx("press min-h-10 rounded-full border-2 px-4 text-sm font-semibold", mine === n ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>{n}</button>
        ))}
      </div>
    </Sheet>
  );
}

/** Chips that choose one group to fill a new team from. Tap the picked one again to clear it. */
export function GroupChips({ value, set }: { value: string | null; set: (id: string | null) => void }) {
  const groups = useStore((s) => s.groups);
  if (!groups.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-teal">Fill the new team from a group</p>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g.id} onClick={() => set(value === g.id ? null : g.id)} aria-pressed={value === g.id}
            className={cx("press min-h-10 rounded-full border-2 px-4 text-sm font-semibold", value === g.id ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>
            {g.name} · {g.players.length}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Adds some or all of a group's players to a team. */
export function AddFromGroup({ team, onAdd, onClose }: { team: SavedTeam; onAdd: (t: SavedTeam) => void; onClose: () => void }) {
  const groups = useStore((s) => s.groups);
  const [gid, setGid] = useState<string | null>(groups[0]?.id ?? null);
  const group = groups.find((g) => g.id === gid) ?? null;
  const [picked, setPicked] = useState<string[]>([]);
  const fresh = group ? playersFrom(group, team.players, picked) : [];
  return (
    <Sheet title="Add from a group" onClose={onClose}
      footer={<PrimaryButton disabled={!fresh.length} onClick={() => { track(EV.group_use, { where: "team" }); onAdd({ ...team, players: [...team.players, ...fresh] }); onClose(); }}>
        {fresh.length ? `Add ${fresh.length} player${fresh.length === 1 ? "" : "s"}` : "Tap players to select them"}</PrimaryButton>}>
      {!groups.length ? <p className="text-sm text-mute">No groups yet. Make one from the Teams screen.</p> : <>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => { setGid(g.id); setPicked([]); }} aria-pressed={gid === g.id}
              className={cx("press min-h-10 rounded-full border-2 px-4 text-sm font-semibold", gid === g.id ? "border-sun bg-sun text-ink" : "border-line bg-panel text-fg")}>{g.name}</button>
          ))}
        </div>
        {group && <>
          <p className="mb-2 mt-4 text-sm font-semibold text-teal">Tap the players to add</p>
          <div className="flex flex-wrap gap-2">
            {group.players.map((p) => {
              const has = team.players.some((q) => q.name.toLowerCase() === p.name.toLowerCase()), on = !has && picked.includes(p.name);
              return (
                <button key={p.id} disabled={has} onClick={() => setPicked(on ? picked.filter((n) => n !== p.name) : [...picked, p.name])} aria-pressed={on}
                  className={cx("press min-h-10 rounded-full border-2 px-4 text-sm font-semibold", on ? "border-sun bg-sun-soft text-fg" : "border-line text-mute", has && "opacity-50")}>
                  {p.name}{has ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </>}
      </>}
    </Sheet>
  );
}
