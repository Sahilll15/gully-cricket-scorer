import type { BallInput } from "./engine/types";

export type VoiceCmd =
  | { kind: "ball"; input: Omit<BallInput, "wicket"> }
  | { kind: "out"; extra?: "nb" | "wd" }
  | { kind: "undo" };

const RUNS: Record<number, string[]> = {
  0: ["dot", "zero", "nothing", "khali", "0"],
  1: ["one", "single", "ek", "won", "1"],
  2: ["two", "double", "do", "2"],
  3: ["three", "teen", "3"],
  4: ["four", "boundary", "chauka", "chouka", "chowka", "4"],
  5: ["five", "paanch", "5"],
  6: ["six", "sixer", "chakka", "chhakka", "chaka", "6"],
};
const OUT = ["out", "wicket", "bowled", "caught", "catch", "lbw", "stumped", "run out"];

/** One spoken phrase to one scoring action. English plus common Hindi; ignores anything else. */
export function parse(text: string): VoiceCmd | null {
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `;
  const has = (w: string) => s.includes(` ${w} `);
  if (["undo", "cancel", "galat", "wapas", "go back"].some(has)) return { kind: "undo" };
  if (has("not out")) return null;
  const hit = Object.keys(RUNS).find((r) => RUNS[Number(r)].some(has));
  const runs = hit === undefined ? 0 : Number(hit);
  const out = OUT.some(has);
  if (["no ball", "noball", "nobal", "no bal"].some(has)) return out ? { kind: "out", extra: "nb" } : { kind: "ball", input: { runs, extra: "nb" } };
  if (["wide", "vide", "wild"].some(has)) return out ? { kind: "out", extra: "wd" } : { kind: "ball", input: { runs, extra: "wd" } };
  if (["leg bye", "leg byes", "leg by", "legbye"].some(has)) return { kind: "ball", input: { runs: runs || 1, extra: "lb" } };
  if (["bye", "byes", "by"].some(has)) return { kind: "ball", input: { runs: runs || 1, extra: "b" } };
  if (out) return { kind: "out" };
  if (hit !== undefined) return { kind: "ball", input: { runs } };
  return null;
}

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { results: { length: number; [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

const Ctor = (globalThis as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR });
export const voiceSupported = !!(Ctor.SpeechRecognition || Ctor.webkitSpeechRecognition);

export function listen(onText: (t: string) => void, onError: (e: string) => void) {
  const C = Ctor.SpeechRecognition || Ctor.webkitSpeechRecognition;
  if (!C) return () => {};
  let on = true;
  const rec = new C();
  rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = false;
  rec.onresult = (e) => onText(e.results[e.results.length - 1][0].transcript.trim());
  rec.onend = () => { if (on) try { rec.start(); } catch { /* already running */ } };
  rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { on = false; onError(e.error); } };
  rec.start();
  return () => { on = false; try { rec.stop(); } catch { /* stopped */ } };
}
