import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const TAG = "gully-weekly";

/** The Sunday evening reminder, if it is on. Found by its tag so nothing else has to remember an id. */
export async function weeklyOn(): Promise<boolean> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.some((n) => (n.content.data as { tag?: string } | undefined)?.tag === TAG);
  } catch { return false; }
}

/** Turns the reminder on or off. Asks for permission only when turning it on; returns whether it is on now. */
export async function setWeekly(on: boolean): Promise<boolean> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) if ((n.content.data as { tag?: string } | undefined)?.tag === TAG) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    if (!on) return false;
    const perm = await Notifications.getPermissionsAsync();
    const ok = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!ok) return false;
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("weekly", { name: "Sunday reminder", importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.scheduleNotificationAsync({
      content: { title: "Game this Sunday?", body: "Check your group's leaderboard and plan the next game.", data: { tag: TAG } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId: "weekly" },
    });
    return true;
  } catch { return false; }
}
