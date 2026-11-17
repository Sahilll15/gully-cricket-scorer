import { useState } from "react";
import { Platform, View } from "react-native";
import * as Notifications from "expo-notifications";
import { Bell, CalendarDays, ChevronRight, Minus, Plus, Share2 } from "lucide-react-native";
import { uniqueNames } from "@shared/kitty";
import {
  atTime, dayOptions, dayText, isOver, minutesOf, nextGameText, reminderAt, startOfDay, timeText, type NextGame,
} from "@shared/nextGame";
import { playerPool } from "@shared/stats";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { sendText } from "@/lib/share";
import { C, Card, ConfirmSheet, GhostButton, Num, Press, PrimaryButton, SectionTitle, Sheet, Txt, tw } from "@/ui/ui";
import { TextField } from "./Teams";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const cancel = (id?: string) => (id ? Notifications.cancelScheduledNotificationAsync(id).catch(() => {}) : Promise.resolve());

/** Asks for permission only here, when a game is saved. Returns the reminder id, or undefined if there is none. */
async function scheduleReminder(g: NextGame): Promise<string | undefined> {
  const when = reminderAt(g);
  if (!when) return undefined;
  try {
    const perm = await Notifications.getPermissionsAsync();
    const ok = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!ok) return undefined;
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("next-game", { name: "Next game", importance: Notifications.AndroidImportance.HIGH });
    return await Notifications.scheduleNotificationAsync({
      content: { title: "Gully match in an hour", body: `${timeText(g.at)}${g.place ? ` at ${g.place}` : ""}. ${g.who.length} in so far.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: "next-game" },
    });
  } catch { return undefined; }
}

function Chip({ on, children, onPress }: { on: boolean; children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: on }}
      style={tw`min-h-10 rounded-full border px-3.5 items-center justify-center ${on ? "border-sun bg-sun" : "border-line"}`}>
      <Txt style={tw`text-[14px] font-medium ${on ? "text-ink" : "text-teal"}`}>{children}</Txt>
    </Press>
  );
}
const Label = ({ t }: { t: string }) => <View style={tw`mt-5`}><SectionTitle>{t}</SectionTitle></View>;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function NextGameSheet({ game, onClose }: { game: NextGame | null; onClose: () => void }) {
  const { matches, teams, setNextGame } = useStore();
  const days = dayOptions();
  const [day, setDay] = useState(() => (game && days.some((d) => d.at === startOfDay(game.at)) ? startOfDay(game.at) : days[1].at));
  const [mins, setMins] = useState(game ? minutesOf(game.at) : 7 * 60);
  const [place, setPlace] = useState(game?.place ?? "");
  const [note, setNote] = useState(game?.note ?? "");
  const [who, setWho] = useState<string[]>(game?.who ?? []);
  const [typed, setTyped] = useState("");
  const [askClear, setAskClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const names = uniqueNames([...who, ...playerPool(matches, teams)]).slice(0, 30);
  const has = (n: string) => who.some((x) => x.toLowerCase() === n.toLowerCase());
  const at = atTime(day, mins), past = at <= Date.now();
  const ok = !!place.trim() && !past;
  const save = async () => {
    setBusy(true);
    const g: NextGame = { at, place: place.trim(), who, ...(note.trim() ? { note: note.trim() } : {}) };
    await cancel(game?.reminderId);
    const reminderId = await scheduleReminder(g);
    track(EV.next_game_save);
    if (reminderId) track(EV.reminder_set);
    setNextGame(reminderId ? { ...g, reminderId } : g);
    onClose();
  };
  const add = () => { const n = typed.trim(); if (n && !has(n)) setWho([...who, n]); setTyped(""); };
  return (<>
    <Sheet title={game ? "Next game" : "Plan the next game"} onClose={onClose}
      footer={<PrimaryButton disabled={!ok || busy} onPress={() => void save()}>Save</PrimaryButton>}>
      <SectionTitle>Day</SectionTitle>
      <View style={tw`flex-row flex-wrap gap-2`}>{days.map((d) => <Chip key={d.at} on={day === d.at} onPress={() => setDay(d.at)}>{d.label}</Chip>)}</View>
      <Label t="Time" />
      <View style={tw`flex-row items-center justify-between rounded-2xl bg-key p-1.5`}>
        <Press style={tw`w-12 h-12 rounded-xl bg-panel items-center justify-center`} onPress={() => setMins((mins + 1440 - 30) % 1440)} accessibilityLabel="Earlier">
          <Minus size={20} color={C.fg} strokeWidth={2.4} />
        </Press>
        <Num style={tw`text-[24px]`}>{timeText(at)}</Num>
        <Press style={tw`w-12 h-12 rounded-xl bg-panel items-center justify-center`} onPress={() => setMins((mins + 30) % 1440)} accessibilityLabel="Later">
          <Plus size={20} color={C.fg} strokeWidth={2.4} />
        </Press>
      </View>
      {past && <Txt style={tw`mt-2 text-xs text-out`}>That time has passed. Pick a later one.</Txt>}
      <Label t="Place" />
      <TextField value={place} onChangeText={setPlace} placeholder="Lane 4, the school ground" maxLength={40} outline style={tw`min-h-12`} />
      <Label t={`Who's in (${who.length})`} />
      <View style={tw`flex-row flex-wrap gap-2`}>
        {names.map((n) => <Chip key={n} on={has(n)} onPress={() => setWho(has(n) ? who.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...who, n])}>{n}</Chip>)}
      </View>
      <View style={tw`mt-3 flex-row gap-2`}>
        <TextField value={typed} onChangeText={setTyped} placeholder="Someone else" maxLength={20} outline onSubmitEditing={add} submitBehavior="submit" returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press onPress={add} style={tw`min-h-12 rounded-[16px] border border-line bg-panel px-5 items-center justify-center`}><Txt style={tw`font-semibold text-fg`}>Add</Txt></Press>
      </View>
      <Label t="Note (optional)" />
      <TextField value={note} onChangeText={setNote} placeholder="Bring the tape ball" maxLength={80} outline style={tw`min-h-12`} />
      <Txt style={tw`mt-4 text-xs text-mute`}>You get a reminder an hour before. The app asks to send notifications when you save.</Txt>
      {game && (
        <Press onPress={() => setAskClear(true)} style={tw`mt-5 min-h-12 w-full rounded-[16px] items-center justify-center`}>
          <Txt style={tw`font-medium text-out`}>Remove this game</Txt>
        </Press>
      )}
    </Sheet>
    {askClear && <ConfirmSheet title="Remove the next game?" yes="Remove" danger
      onYes={() => { void cancel(game?.reminderId); setNextGame(null); onClose(); }} onClose={() => setAskClear(false)} />}
  </>);
}

/** Home card: the planned game with Share, or a prompt to plan one. */
export function NextGameCard() {
  const g = useStore((s) => s.nextGame);
  const [open, setOpen] = useState(false);
  const live = g && !isOver(g) ? g : null;
  const sheet = open && <NextGameSheet game={live} onClose={() => setOpen(false)} />;
  if (!live) return (<>
    <Press onPress={() => setOpen(true)} style={[tw`flex-row w-full items-center gap-3 rounded-[22px] border p-4`, { borderColor: C.line, borderStyle: "dashed" }]}>
      <View style={tw`h-10 w-10 rounded-full border border-line bg-panel items-center justify-center`}><CalendarDays size={20} color={C.teal} strokeWidth={2} /></View>
      <View style={tw`flex-1`}>
        <Txt style={tw`text-[15px] font-semibold text-fg`}>Plan the next game</Txt>
        <Txt style={tw`mt-0.5 text-[13px] text-teal`}>Day, place and who's in. Share it to the group.</Txt>
      </View>
      <ChevronRight size={18} color={C.mute} strokeWidth={2} />
    </Press>
    {sheet}
  </>);
  return (<>
    <Card>
      <Press onPress={() => setOpen(true)} haptic={false}>
        <SectionTitle>Next game</SectionTitle>
        <Txt style={tw`text-[20px] font-semibold text-fg`}>{cap(dayText(live.at))}, <Num style={tw`text-[20px]`}>{timeText(live.at)}</Num></Txt>
        <Txt style={tw`mt-0.5 text-[15px] text-teal`}>{live.place}</Txt>
        <Txt style={tw`mt-1 text-[13px] text-mute`}>{live.who.length ? `${live.who.length} in: ${live.who.join(", ")}` : "Nobody in yet"}</Txt>
        {!!live.note && <Txt style={tw`mt-1 text-[13px] text-teal`}>{live.note}</Txt>}
        {!!live.reminderId && (
          <View style={tw`mt-2 flex-row items-center gap-1.5`}>
            <Bell size={14} color={C.mute} strokeWidth={2} />
            <Txt style={tw`text-xs text-mute`}>Reminder an hour before</Txt>
          </View>
        )}
      </Press>
      <View style={tw`mt-3 flex-row gap-2`}>
        <View style={tw`flex-1`}>
          <GhostButton onPress={() => { track(EV.next_game_share); track(EV.share, { what: "next_game" }); void sendText(nextGameText(live)); }}>
            <View style={tw`flex-row items-center gap-2`}><Share2 size={18} color={C.sun} strokeWidth={2.2} /><Txt style={tw`font-medium text-fg`}>Share</Txt></View>
          </GhostButton>
        </View>
        <View style={tw`flex-1`}><GhostButton onPress={() => setOpen(true)}>Edit</GhostButton></View>
      </View>
    </Card>
    {sheet}
  </>);
}
