import "@/lib/polyfills";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold } from "@expo-google-fonts/jetbrains-mono";
import { Doto_900Black } from "@expo-google-fonts/doto";
import { useStore } from "@/lib/store";
import { navigate, screenOf, setNavRef, stackNames } from "@/lib/nav";
import { initDevice } from "@/lib/device";
import { trackScreen } from "@/lib/track";
import mobileAds from "react-native-google-mobile-ads";
import { startAccountSync } from "@/lib/account";
import { liveSupported, publish } from "@/lib/live";
import { linkOpened } from "@/lib/links";
import { ShareHost } from "@/ui/ShareHost";
import { C } from "@/ui/ui";

void SplashScreen.preventAutoHideAsync();

// Keeps one broadcast channel open per match that is being shared, and pushes every change.
function LivePublisher() {
  const matches = useStore((s) => s.matches);
  const pubs = useRef(new Map<string, ReturnType<typeof publish>>());
  useEffect(() => {
    const want = new Map(matches.filter((m) => m.live).map((m) => [m.live!, m.id]));
    for (const [code, p] of pubs.current) if (!want.has(code)) { p.stop(); pubs.current.delete(code); }
    for (const [code, id] of want) {
      const p = pubs.current.get(code);
      if (p) p.push();
      else {
        const find = () => useStore.getState().matches.find((m) => m.id === id);
        pubs.current.set(code, publish(code, find, (remote) => {
          const cur = find();
          if (cur) useStore.getState().adopt({ ...remote, id: cur.id, cup: cur.cup, live: cur.live, liveKey: cur.liveKey, liveFp: cur.liveFp });
        }));
      }
    }
  }, [matches]);
  useEffect(() => () => { for (const p of pubs.current.values()) p.stop(); pubs.current.clear(); }, []);
  return null;
}

// A corrupt or unreadable saved state never fires onFinishHydration, so don't wait on it forever.
const hydrated = () => new Promise<void>((done) => {
  if (useStore.persist.hasHydrated()) return done();
  const off = useStore.persist.onFinishHydration(() => { off(); done(); });
  setTimeout(() => { off(); done(); }, 4000);
});

export default function Root() {
  const [fonts] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, JetBrainsMono_500Medium, JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold, Doto_900Black });
  const [ready, setReady] = useState(false);
  const resume = useRef<ReturnType<typeof useStore.getState>["screen"]>("home");
  const nav = useNavigationContainerRef();

  useEffect(() => {
    void Promise.all([initDevice(), hydrated()]).then(() => { resume.current = useStore.getState().screen; setReady(true); });
  }, []);
  useEffect(() => { setNavRef(nav); }, [nav]);
  useEffect(() => { void mobileAds().initialize().catch(() => {}); }, []);
  useEffect(() => (ready ? startAccountSync() : undefined), [ready]);

  // Mirror the top route into the store, which screens read for the tab bar and resume-on-reopen.
  useEffect(() => nav.addListener("state", () => {
    const names = stackNames(nav.getRootState() as Parameters<typeof stackNames>[0]);
    const top = names[names.length - 1];
    if (top) { useStore.setState({ screen: screenOf(top) }); trackScreen(screenOf(top)); }
  }), [nav]);

  useEffect(() => {
    if (!ready || !fonts) return;
    void SplashScreen.hideAsync();
    // Let the navigator mount before moving it. Share links are routed by +native-intent.
    const t = setTimeout(() => { if (!linkOpened() && resume.current !== "home") navigate(resume.current); }, 50);
    return () => clearTimeout(t);
  }, [ready, fonts]);

  if (!ready || !fonts) return <View style={{ flex: 1, backgroundColor: C.cream }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.cream }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: C.cream } }} />
        {liveSupported && <LivePublisher />}
        <ShareHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
