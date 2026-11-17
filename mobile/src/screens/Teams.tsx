import { Children, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as E from "@shared/engine/engine";
import type { SavedTeam } from "@shared/engine/tournament";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { average, bowlAverage, bowlStrikeRate, economy, playerPool, profile, strikeRate } from "@shared/stats";
import { infoLine, ROLES, STYLES, type PlayerInfo } from "@shared/playerInfo";
import { uniqueNames } from "@shared/kitty";
import { knownNames } from "@shared/kittyView";
import { mergeReach } from "@shared/merge";
import { cleanUpi, validUpi } from "@shared/upi";
import {
  filterMatches, fmtFor, kindsPlayed, matchesLine, PROFILE_KINDS, skillCard, startKind, TIER_COLOR, yearsPlayed, type Kind, type SkillCard,
} from "@shared/playerCard";
import { ChevronRight, Merge, Pencil, Share2, X } from "lucide-react-native";
import { Badge, C, Card, ConfirmSheet, GhostButton, Header, Num, Page, Press, PrimaryButton, SectionTitle, Segmented, Sheet, tw, Txt } from "@/ui/ui";

const FONTS = { "400": "Inter_400Regular", "500": "Inter_500Medium", "600": "Inter_600SemiBold", "700": "Inter_700Bold" } as const;

/** Text input; `outline` gives it a hairline border on the card surface that turns lime on focus. */
export function TextField({ style, outline, weight = "400", ...p }: Omit<TextInputProps, "style"> & { style?: StyleProp<TextStyle>; outline?: boolean; weight?: keyof typeof FONTS }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput {...p} placeholderTextColor={C.mute} selectionColor={C.sun}
      onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
      style={[tw`rounded-[16px] px-4 text-[15px]`, outline && tw`border bg-panel`, outline && { borderColor: focus ? C.sun : C.line }, style, { color: C.fg, fontFamily: FONTS[weight] }]} />
  );
}

/** Stand-in for a CSS grid: rows of equal cells, the last row padded so cells keep their width. */
function Grid({ cols, children }: { cols: number; children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={tw`gap-2`}>
      {rows.map((r, i) => (
        <View key={i} style={tw`flex-row gap-2`}>
          {r.map((c, k) => <View key={k} style={tw`flex-1 min-w-0`}>{c}</View>)}
          {Array.from({ length: cols - r.length }, (_, k) => <View key={`pad${k}`} style={tw`flex-1`} />)}
        </View>
      ))}
    </View>
  );
}

function TeamEditor({ team, onClose }: { team: SavedTeam; onClose: () => void }) {
  const { putTeam, removeTeam, openPlayer } = useStore();
  const [t, setT] = useState(team);
  const [v, setV] = useState("");
  const [askDel, setAskDel] = useState(false);
  const save = (next: SavedTeam) => { setT(next); putTeam(next); };
  const add = () => { if (v.trim()) { save({ ...t, players: [...t.players, { id: E.uid(), name: v.trim() }] }); setV(""); } };
  return (<>
    <Sheet title="Edit team" onClose={onClose}>
      <TextField value={t.name} onChangeText={(name) => save({ ...t, name })} maxLength={18} weight="700"
        style={tw`min-h-12 w-full bg-key text-[17px]`} />
      <View style={tw`mt-5`}><SectionTitle>{`Squad (${t.players.length})`}</SectionTitle></View>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {t.players.map((p) => (
          <View key={p.id} style={tw`flex-row min-h-10 items-center gap-1 rounded-full border border-line pl-3.5`}>
            <Press onPress={() => { onClose(); openPlayer(p.name); }}><Txt style={tw`text-sm font-medium`}>{p.name}</Txt></Press>
            <Press onPress={() => save({ ...t, players: t.players.filter((x) => x.id !== p.id) })} accessibilityLabel={`Remove ${p.name}`}
              style={tw`min-h-10 px-2.5 items-center justify-center`}>
              <X size={16} color={C.mute} strokeWidth={2} />
            </Press>
          </View>
        ))}
      </View>
      <View style={tw`mt-3 flex-row gap-2`}>
        <TextField value={v} onChangeText={setV} placeholder="Add a player" maxLength={20} autoFocus outline
          onSubmitEditing={add} submitBehavior="submit" returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press onPress={add} style={tw`min-h-12 rounded-[16px] border border-line bg-panel px-5 items-center justify-center`}>
          <Txt style={tw`font-semibold text-fg`}>Add</Txt>
        </Press>
      </View>
      <Press onPress={() => setAskDel(true)} style={tw`mt-5 min-h-12 w-full rounded-[16px] items-center justify-center`}>
        <Txt style={tw`font-medium text-out`}>Delete team</Txt>
      </Press>
    </Sheet>
    {askDel && <ConfirmSheet title={`Delete ${t.name}?`} body="Past matches keep their scores." yes="Delete" danger
      onYes={() => { track(EV.team_delete); removeTeam(t.id); onClose(); }} onClose={() => setAskDel(false)} />}
  </>);
}

/** Selectable name chip: raised outline with lime fill when picked. */
function NameChip({ on, children, onPress }: { on: boolean; children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: on }}
      style={tw`min-h-10 rounded-full border px-3.5 items-center justify-center ${on ? "border-sun bg-sun" : "border-line"}`}>
      <Txt style={tw`text-[14px] font-medium ${on ? "text-ink" : "text-teal"}`}>{children}</Txt>
    </Press>
  );
}

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
      footer={<PrimaryButton disabled={!from || !into} onPress={() => setAsk(true)}>{from && into ? `Merge ${from} into ${into}` : "Merge"}</PrimaryButton>}>
      <Txt style={tw`text-[13px] leading-5 text-mute`}>Same person saved under two names? Merge them and their matches, teams, details and kitty all add up under one name.</Txt>
      {names.length > 8 && <TextField value={q} onChangeText={setQ} placeholder="Search names" maxLength={20} outline style={tw`mt-3 min-h-12`} />}
      <View style={tw`mt-4`}><SectionTitle>Name to drop</SectionTitle></View>
      <View style={tw`flex-row flex-wrap gap-2`}>
        {shown.map((n) => <NameChip key={n} on={from === n} onPress={() => { setFrom(n); if (into === n) setInto(null); }}>{n}</NameChip>)}
      </View>
      {from && <>
        <View style={tw`mt-5`}><SectionTitle>Same person as</SectionTitle></View>
        <View style={tw`flex-row flex-wrap gap-2`}>
          {shown.filter((n) => n !== from).map((n) => <NameChip key={n} on={into === n} onPress={() => setInto(n)}>{n}</NameChip>)}
        </View>
      </>}
      {!names.length && <Txt style={tw`mt-4 text-sm text-mute`}>No players yet.</Txt>}
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
  const create = () => { if (name.trim()) { track(EV.team_save); setEdit(saveTeam(name, [])); setName(""); } };
  return (
    <Page tabs>
      <Header title="My Teams" />
      <View style={tw`gap-3 px-4 pt-4`}>
        <View style={tw`flex-row gap-2`}>
          <TextField value={name} onChangeText={setName} placeholder="New team name" maxLength={18} outline weight="600"
            onSubmitEditing={create} returnKeyType="done" style={tw`min-h-14 flex-1`} />
          <Press onPress={create} style={tw`min-h-14 rounded-[18px] bg-sun px-5 items-center justify-center`}>
            <Txt style={tw`font-semibold text-ink`}>Create</Txt>
          </Press>
        </View>
        <GhostButton onPress={() => setMerging(true)}>
          <View style={tw`flex-row items-center gap-2`}>
            <Merge size={18} color={C.teal} strokeWidth={2} />
            <Txt style={tw`font-medium text-fg`}>Merge players</Txt>
          </View>
        </GhostButton>
        {lastMerge && (
          <Card style={tw`flex-row items-center gap-3 py-3`}>
            <Txt style={tw`flex-1 text-[14px] text-teal`}>Merged <Txt style={tw`font-semibold text-fg`}>{lastMerge.from}</Txt> into <Txt style={tw`font-semibold text-fg`}>{lastMerge.into}</Txt>.</Txt>
            <Press onPress={() => { track(EV.undo_merge); undoMerge(); }} style={tw`min-h-10 rounded-full border border-line px-4 items-center justify-center`}>
              <Txt style={tw`text-[13px] font-medium text-sun`}>Undo merge</Txt>
            </Press>
          </Card>
        )}
        {teams.map((t) => (
          <Press key={t.id} onPress={() => setEdit(t)}>
            <Card>
              <View style={tw`flex-row items-center gap-3`}>
                <Badge name={t.name} size={44} />
                <View style={tw`flex-1 min-w-0`}>
                  <Txt style={tw`text-[17px] font-semibold`} numberOfLines={1}>{t.name}</Txt>
                  {!t.players.length && <Txt style={tw`text-[13px] text-mute`}>No players yet</Txt>}
                </View>
                <ChevronRight size={20} color={C.mute} strokeWidth={2} />
              </View>
              {t.players.length > 0 && (
                <View style={tw`mt-3 flex-row flex-wrap gap-1.5`}>
                  {t.players.map((p) => (
                    <View key={p.id} style={tw`rounded-full border border-line px-3 py-1.5`}><Txt style={tw`text-xs font-medium text-teal`}>{p.name}</Txt></View>
                  ))}
                </View>
              )}
            </Card>
          </Press>
        ))}
        {!teams.length && <Txt style={tw`pt-6 text-center text-sm text-mute`}>Teams you play with are saved here automatically, with their squads.</Txt>}
      </View>
      {edit && <TeamEditor team={edit} onClose={() => setEdit(null)} />}
      {merging && <MergeSheet onClose={() => setMerging(false)} />}
    </Page>
  );
}

function Choice<T extends string>({ items, value, set }: { items: readonly (readonly [T, string])[]; value: T | undefined; set: (v: T | undefined) => void }) {
  return (
    <View style={tw`flex-row flex-wrap gap-2`}>
      {items.map(([v, label]) => (
        <Press key={v} onPress={() => set(value === v ? undefined : v)} accessibilityState={{ selected: value === v }}
          style={tw`min-h-11 rounded-full border px-4 items-center justify-center ${value === v ? "border-sun bg-sun" : "border-line"}`}>
          <Txt style={tw`text-sm font-medium ${value === v ? "text-ink" : "text-teal"}`}>{label}</Txt>
        </Press>
      ))}
    </View>
  );
}

function InfoEditor({ name, info, onClose }: { name: string; info: PlayerInfo; onClose: () => void }) {
  const { setInfo } = useStore();
  const [i, setI] = useState(info);
  const [upi, setUpi] = useState(info.upi ?? "");
  const put = (patch: Partial<PlayerInfo>) => setI({ ...i, ...patch });
  const label = (t: string, first = false) => <View style={tw`${first ? "" : "mt-4"}`}><SectionTitle>{t}</SectionTitle></View>;
  const upiOk = !upi.trim() || validUpi(upi);
  const save = () => { track(EV.player_details_save); setInfo(name, { ...i, upi: upi.trim() ? cleanUpi(upi) : undefined }); onClose(); };
  return (
    <Sheet title={`About ${name}`} onClose={onClose}
      footer={<PrimaryButton disabled={!upiOk} onPress={save}>Save</PrimaryButton>}>
      {label("Role", true)}
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
      <TextField value={upi} onChangeText={setUpi} placeholder="name@okaxis" autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        maxLength={60} outline style={tw`min-h-12`} />
      <Txt style={tw`mt-1.5 text-xs ${upiOk ? "text-mute" : "text-out"}`}>{upiOk ? "Lets the kitty show a QR when someone owes them. Stays on this phone." : "A UPI ID looks like name@bank."}</Txt>
    </Sheet>
  );
}

/** The premium card: rating, tier, role and three numbers, tinted by tier. Also the shared image. */
function SkillCardView({ c }: { c: SkillCard }) {
  const col = TIER_COLOR[c.tier];
  return (
    <View style={[tw`rounded-[24px] overflow-hidden border-2`, { borderColor: col, backgroundColor: C.panel }]}>
      <LinearGradient colors={[`${col}40`, `${col}00`]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <View style={tw`p-5`}>
        <View style={tw`flex-row items-start justify-between`}>
          <View>
            <Num style={[tw`text-[60px]`, { color: col, lineHeight: 64 }]}>{c.score}</Num>
            <Txt style={[tw`text-[14px] font-semibold`, { color: col }]}>{c.tier}</Txt>
          </View>
          <Badge name={c.name} size={60} />
        </View>
        <Txt style={tw`mt-4 text-[24px] font-semibold`} numberOfLines={1}>{c.name}</Txt>
        <Txt style={tw`text-[13px] text-teal`}>{c.role}</Txt>
        <View style={[tw`mt-4 flex-row pt-3`, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }]}>
          {c.stats.map((x) => (
            <View key={x.label} style={tw`flex-1 items-center`}>
              <Num style={tw`text-[20px]`} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Num>
              <Txt style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{x.label}</Txt>
            </View>
          ))}
        </View>
        <Txt style={tw`mt-4 text-[11px] text-mute`}>Gully Scorer player card</Txt>
      </View>
    </View>
  );
}

export function PlayerProfile() {
  const { matches, player, go, fmt, infos } = useStore();
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<Kind>(() => startKind(kindsPlayed(matches, player ?? ""), fmt));
  const [year, setYear] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<ComponentRef<typeof View> | null>(null);
  const wide = useWindowDimensions().width >= 360;
  if (!player) return null;
  const years = yearsPlayed(matches, player, kind);
  const pool = filterMatches(matches, kind, year);
  const p = profile(pool, player, fmtFor(kind));
  const info = infos[player.trim().toLowerCase()] ?? {};
  const line = infoLine(info);
  const card = skillCard(pool, player, kind, info);
  const pick = (k: Kind) => { setKind(k); setYear(null); if (k !== "solo") useStore.setState({ fmt: k }); };
  const share = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(cardRef as never, { format: "png", quality: 1, width: 1080, result: "tmpfile" });
      track(EV.share, { what: "skill_card" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share player card" });
    } catch { /* cancelled or capture failed */ }
    setSharing(false);
  };
  const num = (v: number | null, d = 1) => (v === null ? "-" : v.toFixed(d));
  const stat = (k: string, v: string | number) => (
    <View style={tw`px-1 py-2 items-center`}>
      <Num style={tw`text-[20px]`} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
      <Txt style={tw`mt-0.5 ${wide ? "text-[11px]" : "text-[10px]"} font-medium leading-tight text-mute text-center`}>{k}</Txt>
    </View>
  );
  return (
    <Page>
      <Header title="Player" back={() => go("stats")}>
        <View style={tw`mt-2 items-center`}>
          <Badge name={p.name} size={72} />
          <Txt style={tw`mt-3 text-[24px] font-semibold text-center`}>{p.name}</Txt>
          <Txt style={tw`mt-0.5 text-center text-[13px] text-teal`}>{line || "Role and bowling style not set"}</Txt>
          <View style={tw`mt-5 w-full flex-row`}>
            {([["Runs", p.runs], ["Wickets", p.wickets], ["Matches", p.matches]] as const).map(([k, v], i) => (
              <View key={k} style={tw`flex-1 items-center ${i ? "border-l border-line" : ""}`}>
                <Num style={tw`text-[30px] ${i ? "text-fg" : "text-sun"}`}>{v}</Num>
                <Txt style={tw`mt-0.5 text-[12px] font-medium text-mute`}>{k}</Txt>
              </View>
            ))}
          </View>
          <Press onPress={() => setEditing(true)} style={tw`mt-5 min-h-10 flex-row gap-2 rounded-full border border-line px-4 items-center justify-center`}>
            <Pencil size={16} color={C.teal} strokeWidth={2} />
            <Txt style={tw`text-sm font-medium text-fg`}>Edit player details</Txt>
          </Press>
        </View>
      </Header>
      <View style={tw`gap-3 px-4 pt-4`}>
        <Segmented value={kind} set={pick} items={PROFILE_KINDS} />
        {years.length > 1 && (
          <View style={tw`flex-row flex-wrap justify-center gap-2`}>
            {[null, ...years].map((y) => <NameChip key={y ?? "all"} on={year === y} onPress={() => setYear(y)}>{y === null ? "All years" : String(y)}</NameChip>)}
          </View>
        )}
        <Txt style={tw`text-center text-sm text-mute`}>{matchesLine(p.matches, kind, year)}</Txt>
        {card.matches > 0 && <>
          <View ref={cardRef} collapsable={false} style={{ backgroundColor: C.cream }}><SkillCardView c={card} /></View>
          <GhostButton disabled={sharing} onPress={() => void share()}>
            <View style={tw`flex-row items-center gap-2`}>
              <Share2 size={18} color={C.teal} strokeWidth={2} />
              <Txt style={tw`font-medium text-fg`}>{sharing ? "One sec…" : "Share card"}</Txt>
            </View>
          </GhostButton>
        </>}
        <Card>
          <SectionTitle>Batting</SectionTitle>
          <Grid cols={4}>
            {stat("Runs", p.runs)}{stat("Highest", `${p.best}${p.bestNotOut && p.innings ? "*" : ""}`)}{stat("Average", average(p).toFixed(1))}{stat("Strike rate", strikeRate(p.runs, p.balls).toFixed(0))}
            {stat("Innings", p.innings)}{stat("Not outs", p.notOuts)}{stat("Fours", p.fours)}{stat("Sixes", p.sixes)}
            {stat("30s", p.thirties)}{stat("50s", p.fifties)}{stat("Balls", p.balls)}{stat("Matches", p.matches)}
          </Grid>
        </Card>
        <Card>
          <SectionTitle>Bowling</SectionTitle>
          <Grid cols={4}>
            {stat("Overs", E.oversText(p.legal))}{stat("Runs", p.conceded)}{stat("Wickets", p.wickets)}{stat("Best", p.bowlInnings ? `${p.bestW}/${p.bestR === Infinity ? 0 : p.bestR}` : "-")}
            {stat("Economy", economy(p.conceded, p.legal).toFixed(1))}{stat("Average", num(bowlAverage(p)))}{stat("Strike rate", num(bowlStrikeRate(p)))}{stat("Maidens", p.maidens)}
            {stat("Wides", p.wides)}{stat("No-balls", p.noBalls)}
          </Grid>
          <Txt style={tw`mt-2 text-xs text-mute`}>Bowling strike rate is balls bowled per wicket.</Txt>
        </Card>
        <Card>
          <SectionTitle>Fielding</SectionTitle>
          <Grid cols={3}>{stat("Catches", p.catches)}{stat("Run outs", p.runOuts)}{stat("Stumpings", p.stumpings)}</Grid>
          <Txt style={tw`mt-2 text-xs text-mute`}>Counted when you name the fielder on the wicket.</Txt>
        </Card>
        {p.recent.length > 0 && (
          <Card style={tw`p-0 overflow-hidden`}>
            <View style={tw`px-4 pt-3`}><SectionTitle>Recent matches</SectionTitle></View>
            {p.recent.map((r) => (
              <Press key={r.matchId} onPress={() => go("scorecard", r.matchId)}
                style={tw`flex-row w-full items-center gap-3 border-t border-line px-4 py-3`}>
                <View style={tw`flex-1`}>
                  <Txt style={tw`text-[15px] font-medium`}>vs {r.vs}</Txt>
                  <Txt style={tw`text-xs text-mute`}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Txt>
                </View>
                <View style={tw`items-end`}>
                  <Num style={tw`text-[16px]`}>{r.bat || "-"}</Num>
                  <Num style={tw`text-[13px] text-mute`}>{r.bowl}</Num>
                </View>
              </Press>
            ))}
          </Card>
        )}
        <PrimaryButton tone="navy" onPress={() => go("stats")}>Back to leaderboard</PrimaryButton>
      </View>
      {editing && <InfoEditor name={p.name} info={info} onClose={() => setEditing(false)} />}
    </Page>
  );
}
