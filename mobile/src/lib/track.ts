import Constants from "expo-constants";

type Params = Record<string, string | number>;
type Mod = {
  getAnalytics(): unknown;
  logEvent(a: unknown, name: string, params?: Params): Promise<void>;
  logScreenView(a: unknown, p: { screen_name: string; screen_class: string }): Promise<void>;
};
let mod: Mod | null | undefined;
let inst: unknown;

// Firebase is only built in when google-services.json exists, so look it up lazily and fail quietly.
function analytics(): Mod | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (!(Constants.expoConfig?.extra as { firebase?: boolean } | undefined)?.firebase) return mod;
  try {
    const m = require("@react-native-firebase/analytics") as Mod;
    inst = m.getAnalytics();
    mod = m;
  } catch { mod = null; }
  return mod;
}

/** Analytics must never throw into a button handler: a bad call used to close the app. Some calls return nothing instead of a promise. */
const safely = (call: () => unknown) => { try { void Promise.resolve(call()).catch(() => {}); } catch { /* analytics only */ } };

/** Firebase accepts only strings and numbers; anything else is dropped or turned into 0 or 1. */
const clean = (p: Record<string, unknown>): Params => {
  const out: Params = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 100);
    else if (typeof v === "boolean") out[k] = v ? 1 : 0;
  }
  return out;
};

/** Same event names as the web app's gtag calls, so web and app reports line up. */
export const track = (name: string, params: Record<string, unknown> = {}) => { const m = analytics(); if (m) safely(() => m.logEvent(inst, name, clean(params))); };
export const trackScreen = (screen: string) => { const m = analytics(); if (m) safely(() => m.logScreenView(inst, { screen_name: screen, screen_class: screen })); };
