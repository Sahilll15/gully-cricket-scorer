import { useEffect, useRef, useState } from "react";
import { Animated, Modal, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Mic, Radio, SlidersHorizontal, type LucideIcon } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { navigate } from "@/lib/nav";
import { C, Press, PrimaryButton, Txt, tw } from "./ui";

const KEY = "gully-onboarded";
const useIntro = create<{ open: boolean }>(() => ({ open: false }));
/** Lets Home reopen the intro from a "How it works" link. */
export const showIntro = () => useIntro.setState({ open: true });

const SLIDES: { icon: LucideIcon; title: string; body: string; chips: string[] }[] = [
  { icon: Mic, title: "Score every ball", body: "Tap the big keypad, or just say it. Made a mistake? Undo any ball.", chips: ["0 to 6", "Wide", "Out", "Undo"] },
  { icon: SlidersHorizontal, title: "Your gully, your rules", body: "Tip and run, tape ball, box cricket, solo. Your rules.", chips: ["Tip and run", "Last man stands", "Solo"] },
  { icon: Radio, title: "Share it live", body: "Friends follow every ball. Phone dying? Move scoring in one tap.", chips: ["Live code", "WhatsApp link"] },
  { icon: BookOpen, title: "Settle the arguments", body: "Gully Book keeps records and bragging rights. Kitty tracks who paid for the ball.", chips: ["Records", "Kitty", "Fair play"] },
];

/** First launch only, and only on a phone with no matches yet. Skippable at any point. */
export function Onboarding() {
  const open = useIntro((x) => x.open);
  const setOpen = (v: boolean) => useIntro.setState({ open: v });
  const [i, setI] = useState(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v || useStore.getState().matches.length) return;
      setOpen(true);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return;
    setI(0); fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [open, fade]);

  const done = (start: boolean) => {
    void AsyncStorage.setItem(KEY, "1").catch(() => {});
    setOpen(false);
    if (start) navigate("setup");
  };
  const last = i === SLIDES.length - 1;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => { if (last) done(true); else scroll.current?.scrollTo({ x: (i + 1) * width, animated: true }); };

  if (!open) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => done(false)}>
      <Animated.View style={[tw`flex-1 bg-cream`, { opacity: fade, paddingTop: insets.top + 8, paddingBottom: Math.max(20, insets.bottom + 8) }]}>
        <View style={tw`h-11 flex-row items-center justify-end px-5`}>
          {!last && <Press onPress={() => done(false)} accessibilityLabel="Skip intro"><Txt style={tw`text-[15px] font-semibold text-mute`}>Skip</Txt></Press>}
        </View>
        <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={tw`flex-1`}>
          {SLIDES.map(({ icon: I, title, body, chips }) => (
            <View key={title} style={[tw`px-7 justify-center`, { width }]}>
              <View style={[tw`h-24 w-24 rounded-3xl items-center justify-center mb-8`, { backgroundColor: C.sunSoft, borderWidth: 1, borderColor: "rgba(255,138,61,0.35)" }]}>
                <I size={44} color={C.sun} strokeWidth={2} />
              </View>
              <Txt style={tw`text-[32px] font-extrabold leading-10`}>{title}</Txt>
              <Txt style={tw`mt-3 text-[17px] leading-7 text-teal`}>{body}</Txt>
              <View style={tw`mt-6 flex-row flex-wrap gap-2`}>
                {chips.map((c) => (
                  <View key={c} style={tw`rounded-full border border-line bg-panel px-3.5 py-2`}><Txt style={tw`text-[13px] font-semibold`}>{c}</Txt></View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={tw`flex-row justify-center gap-2 mb-5`}>
          {SLIDES.map((s, k) => <View key={s.title} style={{ height: 8, width: k === i ? 24 : 8, borderRadius: 4, backgroundColor: k === i ? C.sun : C.line }} />)}
        </View>
        <View style={tw`px-5`}>
          <PrimaryButton onPress={next}>{last ? "Start my first match" : "Next"}</PrimaryButton>
        </View>
      </Animated.View>
    </Modal>
  );
}
