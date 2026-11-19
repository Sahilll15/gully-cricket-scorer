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

/** Same event names as the web app's gtag calls, so web and app reports line up. */
export const track = (name: string, params: Params = {}) => { const m = analytics(); if (m) void m.logEvent(inst, name, params).catch(() => {}); };
export const trackScreen = (screen: string) => { const m = analytics(); if (m) void m.logScreenView(inst, { screen_name: screen, screen_class: screen }).catch(() => {}); };
