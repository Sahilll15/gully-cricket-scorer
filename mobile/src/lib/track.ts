import Constants from "expo-constants";

type Analytics = { logEvent(name: string, params?: Record<string, string | number>): Promise<void>; logScreenView(p: { screen_name: string; screen_class: string }): Promise<void> };
let ga: Analytics | null | undefined;

// Firebase is only built in when google-services.json exists, so look it up lazily and fail quietly.
function analytics(): Analytics | null {
  if (ga !== undefined) return ga;
  ga = null;
  if (!(Constants.expoConfig?.extra as { firebase?: boolean } | undefined)?.firebase) return ga;
  try { ga = (require("@react-native-firebase/analytics") as { default: () => Analytics }).default(); } catch { ga = null; }
  return ga;
}

/** Same event names as the web app's gtag calls, so web and app reports line up. */
export const track = (name: string, params: Record<string, string | number> = {}) => { void analytics()?.logEvent(name, params).catch(() => {}); };
export const trackScreen = (screen: string) => { void analytics()?.logScreenView({ screen_name: screen, screen_class: screen }).catch(() => {}); };
