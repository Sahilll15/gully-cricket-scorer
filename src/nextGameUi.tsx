import { useState } from "react";
import { uniqueNames } from "./kitty";
import {
  atTime, dayOptions, dayText, isOver, minutesOf, nextGameIcs, nextGameText, startOfDay, timeText, type NextGame,
} from "./nextGame";
import { playerPool } from "./stats";
import { useStore } from "./store";
import { track } from "./track";
import { EV } from "./events";
import { Card, ConfirmSheet, cx, PrimaryButton, Sheet } from "./ui";

const field = "min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-fg outline-none focus:border-sun";
const chip = (on: boolean) => cx("press min-h-10 rounded-full border px-3.5 text-sm font-semibold", on ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg");
const Label = ({ t }: { t: string }) => <p className="mb-2 mt-5 text-sm font-semibold text-teal">{t}</p>;
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
  const names = uniqueNames([...who, ...playerPool(matches, teams)]).slice(0, 30);
  const has = (n: string) => who.some((x) => x.toLowerCase() === n.toLowerCase());
  const at = atTime(day, mins), past = at <= Date.now();
  const ok = place.trim() && !past;
  const save = () => { track(EV.next_game_save); setNextGame({ at, place: place.trim(), who, ...(note.trim() ? { note: note.trim() } : {}) }); onClose(); };
  const add = () => { const n = typed.trim(); if (n && !has(n)) setWho([...who, n]); setTyped(""); };
  return (<>
    <Sheet title={game ? "Next game" : "Plan the next game"} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onClick={save}>Save</PrimaryButton>}>
      <p className="mb-2 text-sm font-semibold text-teal">Day</p>
      <div className="flex flex-wrap gap-2">{days.map((d) => <button key={d.at} onClick={() => setDay(d.at)} aria-pressed={day === d.at} className={chip(day === d.at)}>{d.label}</button>)}</div>
      <Label t="Time" />
      <div className="flex items-center justify-between rounded-2xl bg-key p-1.5">
        <button className="press h-12 w-12 rounded-xl bg-panel text-2xl font-bold text-fg" aria-label="Earlier" onClick={() => setMins((mins + 1440 - 30) % 1440)}>−</button>
        <span className="text-2xl font-extrabold tabular-nums text-fg">{timeText(at)}</span>
        <button className="press h-12 w-12 rounded-xl bg-panel text-2xl font-bold text-fg" aria-label="Later" onClick={() => setMins((mins + 30) % 1440)}>+</button>
      </div>
      {past && <p className="mt-2 text-xs text-out">That time has passed. Pick a later one.</p>}
      <Label t="Place" />
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lane 4, the school ground" maxLength={40} className={field} />
      <Label t={`Who's in (${who.length})`} />
      <div className="flex flex-wrap gap-2">
        {names.map((n) => <button key={n} onClick={() => setWho(has(n) ? who.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...who, n])} aria-pressed={has(n)} className={chip(has(n))}>{n}</button>)}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Someone else" maxLength={20} className={cx(field, "flex-1")} />
        <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
      </form>
      <Label t="Note (optional)" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bring the tape ball" maxLength={80} className={field} />
      {game && <button onClick={() => setAskClear(true)} className="press mt-5 min-h-12 w-full rounded-2xl font-semibold text-out">Remove this game</button>}
    </Sheet>
    {askClear && <ConfirmSheet title="Remove the next game?" yes="Remove" danger onYes={() => { setNextGame(null); onClose(); }} onClose={() => setAskClear(false)} />}
  </>);
}

function downloadIcs(g: NextGame) {
  const url = URL.createObjectURL(new Blob([nextGameIcs(g)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = "gully-match.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Home card: the planned game with Share and Add to calendar, or a prompt to plan one. */
export function NextGameCard() {
  const g = useStore((s) => s.nextGame);
  const [open, setOpen] = useState(false);
  const live = g && !isOver(g) ? g : null;
  const sheet = open && <NextGameSheet game={live} onClose={() => setOpen(false)} />;
  if (!live) return (<>
    <button onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-line p-4 text-left">
      <span className="text-2xl">📅</span>
      <span className="flex-1"><span className="block font-bold text-fg">Plan the next game</span>
        <span className="block text-sm text-mute">Day, place and who's in. Share it to the group.</span></span>
      <span className="text-mute">›</span>
    </button>
    {sheet}
  </>);
  return (<>
    <Card>
      <button onClick={() => setOpen(true)} className="block w-full text-left">
        <p className="text-sm font-semibold text-teal">Next game</p>
        <p className="mt-1 text-xl font-extrabold text-fg">{cap(dayText(live.at))}, {timeText(live.at)}</p>
        <p className="text-[15px] text-fg/85">{live.place}</p>
        <p className="mt-1 text-sm text-mute">{live.who.length ? `${live.who.length} in: ${live.who.join(", ")}` : "Nobody in yet"}</p>
        {live.note && <p className="mt-1 text-sm text-fg/80">{live.note}</p>}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => { track(EV.next_game_share); track(EV.share, { what: "next_game" }); window.open("https://wa.me/?text=" + encodeURIComponent(nextGameText(live)), "_blank"); }}
          className="press min-h-11 rounded-2xl bg-sun font-bold text-ink">Share</button>
        <button onClick={() => { track(EV.calendar_add); downloadIcs(live); }} className="press min-h-11 rounded-2xl border-2 border-line font-semibold text-fg">Add to calendar</button>
      </div>
    </Card>
    {sheet}
  </>);
}
