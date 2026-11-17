/** The next game the group plans: when, where and who is in. Kept on this phone only. */
export interface NextGame { at: number; place: string; note?: string; who: string[]; reminderId?: string }

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR = 3600_000;

export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };

/** "7 am", "7:30 pm", "12 pm". */
export function timeText(t: number): string {
  const d = new Date(t), h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** "today", "tomorrow", "Sunday" within the week, "Sun 30 Nov" further out. */
export function dayText(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / (24 * HOUR)), d = new Date(t);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Day chips for the planner: today and the next `n - 1` days, each as the start of that day. */
export function dayOptions(now = Date.now(), n = 8): { at: number; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const at = addDays(startOfDay(now), i), label = dayText(at, now);
    return { at, label: i < 2 ? label[0].toUpperCase() + label.slice(1) : label };
  });
}

/** Minutes after midnight on that day, as a timestamp. Safe across a clock change. */
export const atTime = (day: number, minutes: number) => { const d = new Date(day); d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return d.getTime(); };
export const minutesOf = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };

/** Shown on Home until a few hours after the start, so it can still be shared on the way. */
export const isOver = (g: NextGame, now = Date.now()) => now > g.at + 3 * HOUR;

/** When the reminder goes off, or null if an hour before has already passed. */
export const reminderAt = (g: NextGame, now = Date.now()) => (g.at - HOUR > now ? g.at - HOUR : null);

/** "Gully match Sunday 7 am at Lane 4, 8 in so far", then who and the note on their own lines. */
export function nextGameText(g: NextGame, now = Date.now()): string {
  const n = g.who.length;
  const lines = [`Gully match ${dayText(g.at, now)} ${timeText(g.at)}${g.place.trim() ? ` at ${g.place.trim()}` : ""}, ${n ? `${n} in so far` : "who's in?"}`];
  if (n) lines.push(`In: ${g.who.join(", ")}`);
  if (g.note?.trim()) lines.push(g.note.trim());
  return lines.join("\n");
}

const icsDate = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A calendar file with one two-hour event and a reminder an hour before. */
export function nextGameIcs(g: NextGame, now = Date.now()): string {
  const who = g.who.length ? `In: ${g.who.join(", ")}` : "";
  const desc = [who, g.note?.trim() ?? ""].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gully Scorer//Next game//EN", "BEGIN:VEVENT",
    `UID:${g.at}-${Math.round(now)}@gully-scorer`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(g.at)}`, `DTEND:${icsDate(g.at + 2 * HOUR)}`,
    "SUMMARY:Gully match", ...(g.place.trim() ? [`LOCATION:${icsText(g.place.trim())}`] : []), ...(desc ? [`DESCRIPTION:${icsText(desc)}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Gully match in an hour", "TRIGGER:-PT1H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
