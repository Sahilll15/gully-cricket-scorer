import { useEffect, useState } from "react";
import { View } from "react-native";
import * as E from "@shared/engine/engine";
import type { SavedTeam } from "@shared/engine/tournament";
import { boardText, groupBoard, pollText, splitGroup, weeklyNudge, type Span } from "@shared/season";
import { decodeGroup, groupLink, groupShareText, MAX_GROUP_PLAYERS, playersFrom, type PlayerGroup } from "@shared/groups";
import { EV } from "@shared/events";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { copyText, sendText } from "@/lib/share";
import { setWeekly, weeklyOn } from "@/lib/weekly";
import { WEB_BASE } from "@/lib/env";
import { ChevronRight, Copy, Send, X } from "lucide-react-native";
import { C, Card, ConfirmSheet, GhostButton, Press, PrimaryButton, SectionTitle, Sheet, Toggle, tw, Txt } from "@/ui/ui";
import { TextField } from "./Teams";

const ghost = (off: boolean) => tw`flex-1 min-h-12 rounded-[16px] border border-line items-center justify-center ${off ? "opacity-40" : ""}`;

/** Leaderboard, weekly nudge, who-is-in message and a fair split, all for one group. */
function GroupPlay({ group }: { group: PlayerGroup }) {
  const { matches, saveTeam } = useStore();
  const [span, setSpan] = useState<Span>("week");
  const [seed, setSeed] = useState(0);
  const [split, setSplit] = useState(false);
  const rows = groupBoard(matches, group, span);
  const nudge = weeklyNudge(matches, group, WEB_BASE);
  const two = split && group.players.length >= 2 ? splitGroup(matches, group, seed) : null;
  return (<>
    <View style={tw`mt-5`}><SectionTitle>Leaderboard</SectionTitle></View>
    <View style={tw`mb-2 flex-row gap-2`}>
      {(["week", "all"] as const).map((s) => (
        <Press key={s} onPress={() => setSpan(s)} accessibilityState={{ selected: span === s }} style={tw`min-h-10 rounded-full border px-4 items-center justify-center ${span === s ? "border-sun bg-sun" : "border-line"}`}>
          <Txt style={tw`text-sm font-medium ${span === s ? "text-ink" : "text-fg"}`}>{s === "week" ? "This week" : "All time"}</Txt>
        </Press>
      ))}
    </View>
    <View style={tw`rounded-[16px] bg-key px-3`}>
      {rows.slice(0, 5).map((r, i) => (
        <View key={r.name} style={tw`flex-row items-center gap-2 py-2 ${i ? "border-t border-line" : ""}`}>
          <Txt style={tw`w-4 font-bold text-mute`}>{String(i + 1)}</Txt>
          <Txt style={tw`flex-1 font-semibold`} numberOfLines={1}>{r.name}</Txt>
          <Txt style={tw`text-xs text-mute`}>{`${r.runs} runs · ${r.wickets} wkts`}</Txt>
          <Txt style={tw`w-10 text-right font-bold`}>{String(r.points)}</Txt>
        </View>
      ))}
      {!rows.length && <Txt style={tw`py-3 text-sm text-mute`}>{`No matches ${span === "week" ? "this week" : "yet"} with these players.`}</Txt>}
    </View>
    <View style={tw`mt-2 flex-row gap-2`}>
      <Press disabled={!rows.length} style={ghost(!rows.length)} onPress={() => { track(EV.group_board_share, { span }); void sendText(boardText(group, rows, span, WEB_BASE)); }}><Txt style={tw`font-medium`}>Send board</Txt></Press>
      <Press disabled={!nudge} style={ghost(!nudge)} onPress={() => { track(EV.group_board_share, { span: "nudge" }); void sendText(nudge!); }}><Txt style={tw`font-medium`}>Send weekly recap</Txt></Press>
    </View>
    <View style={tw`mt-5`}><SectionTitle>Next game</SectionTitle></View>
    <View style={tw`flex-row gap-2`}>
      <Press disabled={!group.players.length} style={ghost(!group.players.length)} onPress={() => { track(EV.group_poll); void sendText(pollText(group, "this Sunday", WEB_BASE)); }}><Txt style={tw`font-medium`}>Who is in?</Txt></Press>
      <Press disabled={group.players.length < 2} style={ghost(group.players.length < 2)} onPress={() => { track(EV.group_split); setSplit(true); setSeed(seed + (split ? 1 : 0)); }}><Txt style={tw`font-medium`}>{split ? "Reshuffle" : "Split fairly"}</Txt></Press>
    </View>
    {two && (
      <View style={tw`mt-2 rounded-[16px] bg-key p-3`}>
        {[two.a, two.b].map((side, i) => <Txt key={i} style={tw`py-0.5 text-sm text-mute`}><Txt style={tw`font-semibold text-fg`}>{`Team ${i + 1} `}</Txt>{side.join(", ")}</Txt>)}
        {!!two.common && <Txt style={tw`text-xs text-mute`}>{`${two.common} plays for both.`}</Txt>}
        <Press style={tw`mt-2 min-h-11 rounded-[16px] bg-sun items-center justify-center`}
          onPress={() => { saveTeam(`${group.name} 1`, two.a.map((name) => ({ id: E.uid(), name }))); saveTeam(`${group.name} 2`, two.b.map((name) => ({ id: E.uid(), name }))); setSplit(false); }}>
          <Txt style={tw`font-semibold text-ink`}>Save as two teams</Txt>
        </Press>
      </View>
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
  const none = g.players.length === 0;
  return (<>
    <Sheet title="Edit group" onClose={onClose}>
      <TextField value={g.name} onChangeText={(name) => save({ ...g, name: name.slice(0, 24) })} maxLength={24} weight="700" style={tw`min-h-12 w-full bg-key text-[17px]`} />
      <View style={tw`mt-5`}><SectionTitle>{`Players (${g.players.length})`}</SectionTitle></View>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {g.players.map((p) => (
          <View key={p.id} style={tw`flex-row min-h-10 items-center rounded-full border border-line pl-3.5`}>
            <Txt style={tw`text-sm font-medium`}>{p.name}</Txt>
            <Press onPress={() => save({ ...g, players: g.players.filter((x) => x.id !== p.id) })} accessibilityLabel={`Remove ${p.name}`} style={tw`min-h-10 px-2.5 items-center justify-center`}>
              <X size={16} color={C.mute} strokeWidth={2} />
            </Press>
          </View>
        ))}
      </View>
      <View style={tw`mt-3 flex-row gap-2`}>
        <TextField value={v} onChangeText={setV} placeholder="Add players, commas for several" outline onSubmitEditing={add} submitBehavior="submit" returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press onPress={add} style={tw`min-h-12 rounded-[16px] border border-line bg-panel px-5 items-center justify-center`}><Txt style={tw`font-semibold text-fg`}>Add</Txt></Press>
      </View>
      <GroupPlay group={g} />
      <View style={tw`mt-5`}><SectionTitle>Share this group</SectionTitle></View>
      <View style={tw`flex-row gap-2`}>
        <Press disabled={none} onPress={() => { track(EV.group_share, { how: "whatsapp" }); void sendText(groupShareText(g, WEB_BASE)); }}
          style={tw`flex-1 min-h-12 flex-row gap-2 rounded-[16px] bg-sun items-center justify-center ${none ? "opacity-40" : ""}`}>
          <Send size={16} color={C.ink} strokeWidth={2} /><Txt style={tw`font-semibold text-ink`}>Send</Txt>
        </Press>
        <Press disabled={none} onPress={() => { track(EV.group_share, { how: "link" }); void copyText(groupLink(g, WEB_BASE)).then(() => setNote("Link copied")); }}
          style={tw`flex-1 min-h-12 flex-row gap-2 rounded-[16px] border border-line items-center justify-center ${none ? "opacity-40" : ""}`}>
          <Copy size={16} color={C.teal} strokeWidth={2} /><Txt style={tw`font-medium text-fg`}>Copy link</Txt>
        </Press>
      </View>
      <Txt style={tw`mt-2 text-xs text-mute`}>{note || "Anyone who opens the link gets their own copy of this group. Later edits are not synced."}</Txt>
      <Press onPress={() => setAskDel(true)} style={tw`mt-4 min-h-12 w-full rounded-[16px] items-center justify-center`}><Txt style={tw`font-medium text-out`}>Delete group</Txt></Press>
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
  const [weekly, setWeeklyState] = useState(false);
  useEffect(() => { void weeklyOn().then(setWeeklyState); }, []);
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
      <Txt style={tw`text-sm text-mute`}>Save a squad once, then fill any team from it, or send it to a friend.</Txt>
      <View style={tw`mt-3 flex-row gap-2`}>
        <TextField value={name} onChangeText={setName} placeholder="New group, e.g. Sunday boys" maxLength={24} outline onSubmitEditing={create} returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press onPress={create} style={tw`min-h-12 rounded-[16px] bg-sun px-5 items-center justify-center`}><Txt style={tw`font-semibold text-ink`}>Create</Txt></Press>
      </View>
      <View style={tw`mt-3 gap-2`}>
        {groups.map((g) => (
          <Press key={g.id} onPress={() => setEdit(g)}>
            <Card style={tw`flex-row items-center gap-3 py-3`}>
              <View style={tw`flex-1 min-w-0`}>
                <Txt style={tw`font-semibold`} numberOfLines={1}>{g.name} <Txt style={tw`font-normal text-mute`}>· {g.players.length}</Txt></Txt>
                <Txt style={tw`text-[13px] text-mute`} numberOfLines={1}>{g.players.length ? g.players.map((p) => p.name).join(", ") : "No players yet"}</Txt>
              </View>
              <ChevronRight size={20} color={C.mute} strokeWidth={2} />
            </Card>
          </Press>
        ))}
        {!groups.length && <Txt style={tw`py-3 text-center text-sm text-mute`}>No groups yet.</Txt>}
      </View>
      <View style={tw`mt-4`}><SectionTitle>Sunday reminder</SectionTitle></View>
      <Toggle on={weekly} label="Remind me on Sunday evening" hint="One notification a week to check the leaderboard and plan the game."
        set={(v) => { void setWeekly(v).then((now) => { track(EV.weekly_reminder, { on: now ? 1 : 0 }); setWeeklyState(now); }); }} />
      <View style={tw`mt-4`}><SectionTitle>Import a group</SectionTitle></View>
      <View style={tw`flex-row gap-2`}>
        <TextField value={code} onChangeText={(t) => { setCode(t); setMsg(""); }} placeholder="Paste a link or code" outline autoCapitalize="none" autoCorrect={false} onSubmitEditing={doImport} returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press disabled={!code.trim()} onPress={doImport} style={tw`min-h-12 rounded-[16px] border border-line bg-panel px-5 items-center justify-center ${code.trim() ? "" : "opacity-40"}`}>
          <Txt style={tw`font-semibold text-fg`}>Import</Txt>
        </Press>
      </View>
      {!!msg && <Txt style={tw`mt-2 text-sm text-mute`}>{msg}</Txt>}
    </Sheet>
    {edit && <GroupEditor group={edit} onClose={() => setEdit(null)} />}
  </>);
}

/** Opens when a group link was followed, on whatever screen the app is showing. */
export function InviteSheet() {
  const { groupInvite: inv, setGroupInvite, importGroup, setMe, me } = useStore();
  const [who, setWho] = useState<string | null>(null);
  if (!inv) return null;
  const mine = who ?? (me && inv.names.find((n) => n.toLowerCase() === me.toLowerCase())) ?? null;
  return (
    <Sheet title="Add this group?" onClose={() => { setWho(null); setGroupInvite(null); }}
      footer={<PrimaryButton onPress={() => { track(EV.group_import, { via: "link", claimed: mine ? 1 : 0 }); importGroup(inv); if (mine) setMe(mine); setWho(null); }}>{mine ? `Add, I am ${mine}` : "Add to my groups"}</PrimaryButton>}>
      <Txt style={tw`text-lg font-semibold`}>{inv.name}</Txt>
      <Txt style={tw`mt-1 text-sm text-mute`}>{`${inv.names.length} players: ${inv.names.join(", ")}`}</Txt>
      <View style={tw`mt-4`}><SectionTitle>Which one is you? (optional)</SectionTitle></View>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {inv.names.map((n) => (
          <Press key={n} onPress={() => setWho(mine === n ? "" : n)} accessibilityState={{ selected: mine === n }} style={pill(mine === n)}>
            <Txt style={tw`text-sm font-medium ${mine === n ? "text-ink" : "text-fg"}`}>{n}</Txt>
          </Press>
        ))}
      </View>
    </Sheet>
  );
}

const pill = (on: boolean) => tw`min-h-10 rounded-full border px-4 items-center justify-center ${on ? "border-sun bg-sun" : "border-line"}`;

/** Chips that choose one group to fill a new team from. Tap the picked one again to clear it. */
export function GroupChips({ value, set }: { value: string | null; set: (id: string | null) => void }) {
  const groups = useStore((s) => s.groups);
  if (!groups.length) return null;
  return (
    <View style={tw`mt-3`}>
      <Txt style={tw`mb-2 text-xs font-semibold text-teal`}>Fill the new team from a group</Txt>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {groups.map((g) => (
          <Press key={g.id} onPress={() => set(value === g.id ? null : g.id)} accessibilityState={{ selected: value === g.id }} style={pill(value === g.id)}>
            <Txt style={tw`text-sm font-medium ${value === g.id ? "text-ink" : "text-fg"}`}>{`${g.name} · ${g.players.length}`}</Txt>
          </Press>
        ))}
      </View>
    </View>
  );
}

/** Adds some or all of a group's players to a team. */
export function AddFromGroup({ team, onAdd, onClose }: { team: SavedTeam; onAdd: (t: SavedTeam) => void; onClose: () => void }) {
  const groups = useStore((s) => s.groups);
  const [gid, setGid] = useState<string | null>(groups[0]?.id ?? null);
  const group = groups.find((g) => g.id === gid) ?? null;
  const [off, setOff] = useState<string[]>([]);
  const fresh = group ? playersFrom(group, team.players, group.players.map((p) => p.name).filter((n) => !off.includes(n))) : [];
  return (
    <Sheet title="Add from a group" onClose={onClose}
      footer={<PrimaryButton disabled={!fresh.length} onPress={() => { track(EV.group_use, { where: "team" }); onAdd({ ...team, players: [...team.players, ...fresh] }); onClose(); }}>
        {fresh.length ? `Add ${fresh.length} player${fresh.length === 1 ? "" : "s"}` : "Nothing new to add"}</PrimaryButton>}>
      {!groups.length ? <Txt style={tw`text-sm text-mute`}>No groups yet. Make one from the Teams screen.</Txt> : <>
        <View style={tw`flex-row flex-wrap gap-2`}>
          {groups.map((g) => (
            <Press key={g.id} onPress={() => { setGid(g.id); setOff([]); }} accessibilityState={{ selected: gid === g.id }} style={pill(gid === g.id)}>
              <Txt style={tw`text-sm font-medium ${gid === g.id ? "text-ink" : "text-fg"}`}>{g.name}</Txt>
            </Press>
          ))}
        </View>
        {group && <>
          <View style={tw`mt-4`}><SectionTitle>Tap to leave someone out</SectionTitle></View>
          <View style={tw`flex-row flex-wrap gap-2`}>
            {group.players.map((p) => {
              const has = team.players.some((q) => q.name.toLowerCase() === p.name.toLowerCase()), on = !has && !off.includes(p.name);
              return (
                <Press key={p.id} disabled={has} onPress={() => setOff(on ? [...off, p.name] : off.filter((n) => n !== p.name))} accessibilityState={{ selected: on }}
                  style={tw`min-h-10 rounded-full border px-4 items-center justify-center ${on ? "border-sun bg-sun-soft" : "border-line"} ${has ? "opacity-50" : ""}`}>
                  <Txt style={tw`text-sm font-medium ${on ? "text-fg" : "text-mute"}`}>{has ? `${p.name} ✓` : p.name}</Txt>
                </Press>
              );
            })}
          </View>
        </>}
      </>}
    </Sheet>
  );
}
