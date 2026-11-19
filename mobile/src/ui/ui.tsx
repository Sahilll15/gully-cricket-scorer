import { isValidElement, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  AccessibilityInfo, Animated, Easing, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type PressableProps, type ScrollViewInstance, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { create } from "twrnc";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Ball } from "@shared/engine/types";
import { ballLabel } from "@shared/engine/engine";
import { BarChart3, ChevronLeft, History as HistoryIcon, House, Trophy, Users, X, type LucideIcon } from "lucide-react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useStore, type Screen } from "@/lib/store";
import { photoOf } from "@shared/photo";
import { ChalkRing } from "./gully";

/** Same palette as the web app: black ground, orange as the only accent. */
export const C = {
  sun: "#ff8a3d", ember: "#e0701f", sunSoft: "#2a1a0f", cream: "#050507", panel: "#0d0d12", key: "#17171f", raised: "#1f1f29",
  teal: "#f1ece4", fg: "#ffffff", ink: "#111111", mute: "#9a9aa5", line: "#24242d", out: "#ff4d4d", six: "#ff8a3d", four: "#f1ece4", win: "#ff8a3d",
};

export const tw = create({
  theme: {
    extend: {
      colors: {
        sun: C.sun, "sun-soft": C.sunSoft, cream: C.cream, panel: C.panel, key: C.key, raised: C.raised,
        teal: C.teal, fg: C.fg, ink: C.ink, mute: C.mute, line: C.line, out: C.out, six: C.six, four: C.four, ember: C.ember, win: C.win,
      },
    },
  },
});

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const FONT: Record<string, string> = {
  "400": "Poppins_400Regular", normal: "Poppins_400Regular", "500": "Poppins_500Medium", "600": "Poppins_600SemiBold",
  "700": "Poppins_700Bold", bold: "Poppins_700Bold", "800": "Poppins_800ExtraBold", "900": "Poppins_800ExtraBold",
};

/** Text in Poppins, like the web app. Android ignores fontWeight on custom fonts, so the weight picks the font file instead. */
export function Txt({ style, ...p }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, ...rest } = flat;
  return <Text {...p} style={[{ color: C.fg, fontFamily: FONT[String(fontWeight ?? "400")] ?? FONT["400"] }, rest]} />;
}

const MONO: Record<string, string> = { "400": "Poppins_500Medium", "500": "Poppins_500Medium", "600": "Poppins_600SemiBold", "700": "Poppins_700Bold", "800": "Poppins_800ExtraBold", "900": "Poppins_800ExtraBold" };

/** Numbers in bold Poppins, as on the web. */
export function Num({ style, ...p }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, ...rest } = flat;
  return <Text {...p} style={[{ color: C.fg, fontFamily: MONO[String(fontWeight ?? "700")] ?? MONO["700"], includeFontPadding: false }, rest]} />;
}
/** Kept for screens that put numbers in Display; it is the mono numeral face now. */
export const Display = Num;

/** The big live score, bold white like the web app. */
export function Board({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ color: C.fg, fontFamily: "Poppins_800ExtraBold", includeFontPadding: false }, style]} />;
}

/** Kept so screens compile; the web app has no backdrop art. */
export function Beams(_: { height?: number }) {
  return null;
}

/** Ring that fills as the chase closes in; the middle shows what is still needed. */
export function ChaseRing({ done, size = 118, children }: { done: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 7, len = 2 * Math.PI * r, f = Math.max(0, Math.min(1, done));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#24242d" strokeWidth={9} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.sun} strokeWidth={9} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - f)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

/** Bars of runs per over; the current over is outlined, the best over is lit. */
export function RunWorm({ overs, current, height = 34 }: { overs: number[]; current?: number; height?: number }) {
  const max = Math.max(6, ...overs);
  const best = overs.indexOf(Math.max(...overs));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height }}>
      {overs.map((r, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(3, (r / max) * height), borderRadius: 4,
          backgroundColor: i === current ? C.sunSoft : i === best && r > 0 ? C.sun : "#24242d",
          borderWidth: i === current ? 1 : 0, borderColor: C.sun, borderStyle: "dashed" }} />
      ))}
    </View>
  );
}

export const buzz = (kind: "tap" | "heavy" | "warn" = "tap") => {
  if (kind === "heavy") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  else if (kind === "warn") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else void Haptics.selectionAsync();
};

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that shrinks a little while held, like the web app's .press class. Style sits on the Pressable so flex-1 works. */
export function Press({ style, children, disabled, onPress, haptic = true, ...p }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children?: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return (
    <APressable {...p} disabled={disabled} onPressIn={() => to(0.95)} onPressOut={() => to(1)}
      onPress={(e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => { if (haptic) buzz(); onPress?.(e); }}
      accessibilityRole={p.accessibilityRole ?? "button"}
      style={[disabled ? { opacity: 0.4 } : null, style, { transform: [{ scale }] }]}>
      {children}
    </APressable>
  );
}

/** Web .header-glow: panel ground, orange glow at the top, rounded bottom edge. */
export function Glow({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.panel, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, borderBottomWidth: 1, borderColor: C.line, overflow: "hidden" }, style]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="hg" cx="50%" cy="0%" rx="70%" ry="90%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={C.sun} stopOpacity="0.22" />
            <Stop offset="1" stopColor={C.sun} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hg)" />
      </Svg>
      {children}
    </View>
  );
}

export function IconButton({ icon: I, onPress, label, tone = "key", size = 44 }: { icon: LucideIcon; onPress?: () => void; label: string; tone?: "key" | "sun" | "glass"; size?: number }) {
  const bg = tone === "sun" ? C.sun : tone === "glass" ? "rgba(255,255,255,0.08)" : C.key;
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size > 40 ? 16 : size, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <I size={Math.round(size * 0.48)} color={tone === "sun" ? C.ink : C.fg} strokeWidth={2.4} />
    </Press>
  );
}

export function Header({ title, back, right, children }: { title: string; back?: () => void; right?: ReactNode; children?: ReactNode }) {
  const top = useSafeAreaInsets().top;
  return (
    <Glow style={[tw`px-4 pb-5`, { paddingTop: Math.max(14, top + 6) }]}>
      <View style={tw`flex-row items-center gap-3 h-12`}>
        {back ? <IconButton icon={ChevronLeft} onPress={back} label="Back" size={44} /> : <View style={tw`w-11`} />}
        <Txt style={tw`flex-1 text-center text-[18px] font-bold text-fg`} numberOfLines={1}>{title}</Txt>
        <View style={tw`min-w-11 flex-row justify-end`}>{right}</View>
      </View>
      {children}
    </Glow>
  );
}

/** Web .stadium card: floodlit corners above, orange glow below. */
export function ScoreHero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle>; wall?: boolean }) {
  return (
    <View style={[{ borderRadius: 24, overflow: "hidden", backgroundColor: "#12121a", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, style]}>
      <LinearGradient colors={["#1a1a22", "#0b0b10"]} style={StyleSheet.absoluteFill} />
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="sh" cx="50%" cy="125%" rx="80%" ry="70%" fx="50%" fy="125%">
            <Stop offset="0" stopColor={C.sun} stopOpacity="0.35" />
            <Stop offset="1" stopColor={C.sun} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sl" cx="12%" cy="0%" rx="55%" ry="45%" fx="12%" fy="0%">
            <Stop offset="0" stopColor="#fff" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#fff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sr" cx="88%" cy="0%" rx="55%" ry="45%" fx="88%" fy="0%">
            <Stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#fff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sh)" />
        <Rect width="100%" height="100%" fill="url(#sl)" />
        <Rect width="100%" height="100%" fill="url(#sr)" />
      </Svg>
      <View style={tw`p-4`}>{children}</View>
    </View>
  );
}

/** Small uppercase muted label above a group, with an optional action on the right. */
export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={tw`flex-row items-center justify-between mb-2 mt-1`}>
      <Txt style={[tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }]}>{children}</Txt>
      {action}
    </View>
  );
}

export function LiveDot({ size = 8 }: { size?: number }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size, backgroundColor: C.sun, opacity: o, shadowColor: C.sun, shadowOpacity: 1, shadowRadius: 6 }} />;
}

export const LivePill = () => (
  <View style={tw`flex-row items-center gap-1.5`}>
    <LiveDot size={7} /><Txt style={tw`text-[12px] font-medium text-sun`}>Live</Txt>
  </View>
);

export function Badge({ name, size = 44 }: { name: string; size?: number }) {
  const photo = useStore((s) => photoOf(s.infos, name));
  if (photo) return <Image source={{ uri: photo }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size, borderWidth: 1, borderColor: "#24242d" }} />;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: "#1c1c24", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#24242d" }}>
      <Txt style={{ fontSize: size * 0.34, fontWeight: "600", color: C.fg }}>{initials}</Txt>
    </View>
  );
}

const OUT_TINT = "#2b1311";

/** Wickets are ringed in red chalk on a dark red tint instead of a flat pill. */
export function BallChip({ b, onPress, size = 36 }: { b: Ball; onPress?: () => void; size?: number }) {
  const tone = b.wicket ? ["", "text-out"] : b.extra === "wd" || b.extra === "nb" ? ["border border-dashed border-mute", "text-teal"]
    : b.extra ? ["bg-key", "text-teal"] : b.runs === 6 ? ["bg-sun", "text-ink"] : b.runs === 4 ? ["border border-sun", "text-sun"] : ["bg-key", "text-fg"];
  return (
    <Press onPress={onPress} disabled={!onPress} haptic={!!onPress}
      style={[tw`rounded-full px-2 items-center justify-center ${tone[0]}`, { minWidth: size, height: size }, b.wicket ? { backgroundColor: OUT_TINT } : null, !onPress && { opacity: 1 }]}>
      {b.wicket ? <ChalkRing color={C.out} /> : null}
      <Num style={[tw`${tone[1]}`, { fontSize: size * 0.36 }]}>{ballLabel(b)}</Num>
    </Press>
  );
}

/** Bottom sheet: slides up over a dim backdrop; tapping the backdrop or Android back closes it. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose?: () => void; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets(), bottom = insets.bottom;
  const { height: win } = useWindowDimensions();
  const [kb, setKb] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null), content = useRef<ComponentRef<typeof View>>(null);
  // A Modal is its own window and is not resized by the keyboard, so lift the sheet by hand and scroll the focused field into view.
  const reveal = () => {
    const input = TextInput.State.currentlyFocusedInput?.();
    if (input && content.current) input.measureLayout(content.current as never, (_x: number, y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 24), animated: true }), () => {});
  };
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => { setKb(e.endCoordinates.height); setTimeout(() => revealRef.current(), 120); });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const room = win - insets.top - 12 - kb;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose?.()}>
      <View style={[tw`flex-1 justify-end`, { paddingBottom: kb }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[tw`rounded-t-[28px] border-t border-line`, { maxHeight: kb ? room : win * 0.88, backgroundColor: C.panel }]}>
          <ScrollView ref={scroll} style={[tw`px-5`, { flexShrink: 1 }]} contentContainerStyle={{ paddingTop: 12, paddingBottom: footer ? 16 : kb ? 16 : Math.max(16, bottom + 8) }}
            keyboardShouldPersistTaps="handled" bounces={false} onTouchEnd={() => { if (kb) setTimeout(() => revealRef.current(), 200); }}>
            <View ref={content} collapsable={false}>
              <View style={tw`self-center mb-3 h-1.5 w-12 rounded-full bg-line`} />
              <View style={tw`mb-4 flex-row items-center justify-between`}>
                <Txt style={tw`flex-1 text-[19px] font-semibold`}>{title}</Txt>
                {onClose && (
                  <IconButton icon={X} onPress={onClose} label="Close" size={40} />
                )}
              </View>
              {children}
            </View>
          </ScrollView>
          {footer && <View style={[tw`border-t border-line px-5 pt-3`, { backgroundColor: "#0d0d12" }, { paddingBottom: kb ? 12 : Math.max(16, bottom + 8) }]}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

export function Pill({ active, children, onPress, disabled }: { active?: boolean; children: ReactNode; onPress?: () => void; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled}
      style={tw`min-h-11 rounded-full border px-4 items-center justify-center ${active ? "border-sun bg-sun" : "border-line"}`}>
      <Txt style={tw`font-medium text-[14px] ${active ? "text-ink" : "text-teal"}`}>{children}</Txt>
    </Press>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[tw`rounded-3xl border border-line bg-panel p-4`, style]}>{children}</View>;
}

/** Labels like `Retire {name}` arrive as arrays; React Native needs every string inside a Txt. */
const isText = (c: ReactNode) => !isValidElement(c) && (typeof c === "string" || typeof c === "number" || Array.isArray(c));

export function PrimaryButton({ children, onPress, disabled, tone = "sun" }: { children: ReactNode; onPress?: () => void; disabled?: boolean; tone?: "sun" | "navy" }) {
  return (
    <Press onPress={onPress} disabled={disabled}
      style={[tw`w-full min-h-14 rounded-2xl items-center justify-center px-4 ${tone === "sun" ? "bg-sun" : "bg-raised"}`, tone === "sun" ? { elevation: 8, shadowColor: C.sun, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } } : null]}>
      {isText(children) ? <Txt style={tw`text-[17px] font-bold ${tone === "sun" ? "text-ink" : "text-fg"}`}>{children}</Txt> : children}
    </Press>
  );
}

/** Outline button used for second choices next to a PrimaryButton. */
export function GhostButton({ children, onPress, disabled, danger }: { children: ReactNode; onPress?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} style={tw`min-h-14 rounded-[18px] border ${danger ? "border-out" : "border-line"} bg-panel items-center justify-center px-4`}>
      {isText(children) ? <Txt style={tw`font-medium ${danger ? "text-out" : "text-fg"}`}>{children}</Txt> : children}
    </Press>
  );
}

export function Stepper({ value, set, min = 1, max = 50 }: { value: number; set: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={tw`flex-row items-center justify-between rounded-2xl bg-key p-1.5`}>
      <Press style={tw`w-12 h-12 rounded-xl bg-panel items-center justify-center`} onPress={() => set(Math.max(min, value - 1))} accessibilityLabel="Less">
        <Txt style={tw`text-2xl font-bold`}>−</Txt>
      </Press>
      <Num style={tw`text-[26px]`}>{value}</Num>
      <Press style={tw`w-12 h-12 rounded-xl bg-panel items-center justify-center`} onPress={() => set(Math.min(max, value + 1))} accessibilityLabel="More">
        <Txt style={tw`text-2xl font-bold`}>+</Txt>
      </Press>
    </View>
  );
}

export function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) {
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(x, { toValue: on ? 1 : 0, duration: 150, useNativeDriver: true }).start(); }, [on, x]);
  return (
    <Pressable onPress={() => { buzz(); set(!on); }} style={tw`flex-row w-full items-center gap-3 py-3`} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={tw`flex-1`}>
        <Txt style={tw`font-medium text-[15px]`}>{label}</Txt>
        {hint && <Txt style={tw`text-xs text-mute`}>{hint}</Txt>}
      </View>
      <View style={tw`h-7 w-12 rounded-full ${on ? "bg-sun" : "bg-raised"}`}>
        <Animated.View style={[tw`absolute top-1 left-1 h-5 w-5 rounded-full ${on ? "bg-ink" : "bg-mute"}`, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
      </View>
    </Pressable>
  );
}

const NAV: { s: Screen; label: string; icon: LucideIcon }[] = [
  { s: "home", label: "Home", icon: House },
  { s: "cups", label: "Cups", icon: Trophy },
  { s: "teams", label: "Teams", icon: Users },
  { s: "stats", label: "Stats", icon: BarChart3 },
  { s: "history", label: "History", icon: HistoryIcon },
];

/** Tab bar like the web app, in the page flow so ads and lists never slide under it: icon over label, the active tab is an orange pill. */
export function BottomNav() {
  const { screen, go } = useStore();
  const bottom = useSafeAreaInsets().bottom;
  const still = useReduceMotion();
  const [w, setW] = useState(0);
  const slot = w / NAV.length;
  const at = Math.max(0, NAV.findIndex((n) => n.s === screen));
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!slot) return;
    Animated.timing(x, { toValue: at * slot, duration: still ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [at, slot, still, x]);
  return (
    <View style={[tw`bg-cream px-4 pt-2`, { paddingBottom: Math.max(16, bottom + 6) }]}>
      <View style={[tw`rounded-full border border-line bg-panel px-2 py-1.5`, { elevation: 16, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }]}>
        {/* The orange pill slides under the active tab; the tabs themselves stay put. */}
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={tw`flex-row items-center`}>
          {slot > 0 && <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: slot, borderRadius: 24, backgroundColor: C.sun, transform: [{ translateX: x }] }} />}
          {NAV.map(({ s, label, icon: I }) => {
            const on = screen === s;
            return (
              <Press key={s} onPress={() => go(s)} accessibilityLabel={label} accessibilityState={{ selected: on }}
                style={{ flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 2 }}>
                <I size={18} color={on ? C.ink : C.teal} strokeWidth={2.2} />
                <Txt numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: on ? C.ink : C.teal }}>{label}</Txt>
              </Press>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function Segmented<T extends string | number>({ items, value, set }: { items: { v: T; label: ReactNode }[]; value: T; set: (v: T) => void }) {
  return (
    <View style={tw`flex-row gap-1 rounded-full border border-line bg-panel p-1`}>
      {items.map((it) => (
        <Press key={String(it.v)} onPress={() => set(it.v)} style={tw`min-h-11 flex-1 rounded-full px-3 items-center justify-center ${value === it.v ? "bg-sun" : ""}`}>
          {isText(it.label)
            ? <Txt numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={tw`text-sm font-semibold ${value === it.v ? "text-ink" : "text-mute"}`}>{it.label}</Txt> : it.label}
        </Press>
      ))}
    </View>
  );
}

export function ConfirmSheet({ title, body, yes, danger, onYes, onClose }: {
  title: string; body?: ReactNode; yes: string; danger?: boolean; onYes: () => void; onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {body != null && (isText(body) ? <Txt style={tw`text-[15px] leading-6 text-teal`}>{body}</Txt> : body)}
      <View style={tw`mt-5 flex-row gap-2`}>
        <View style={tw`flex-1`}><GhostButton onPress={onClose}>Cancel</GhostButton></View>
        <View style={tw`flex-1`}>
          <Press onPress={() => { onYes(); onClose(); }} style={tw`min-h-14 rounded-2xl items-center justify-center ${danger ? "bg-out" : "bg-sun"}`}>
            <Txt style={tw`font-semibold ${danger ? "text-ink" : "text-ink"}`}>{yes}</Txt>
          </Press>
        </View>
      </View>
    </Sheet>
  );
}

/** Test and limited-overs stats are kept apart; this picks which one a screen shows. */
export function FmtSwitch({ value, set }: { value: "limited" | "test"; set: (v: "limited" | "test") => void }) {
  return <Segmented value={value} set={set} items={[{ v: "limited", label: "Limited overs" }, { v: "test", label: "Test" }]} />;
}

/** True when the phone asks for less motion; animations then skip straight to their end. */
function useReduceMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOn);
    return () => sub.remove();
  }, []);
  return on;
}

/** Full-height screen body on the brand background with safe-area bottom padding. */
export function Page({ children, scroll = true, tabs = false }: { children: ReactNode; scroll?: boolean; tabs?: boolean }) {
  const { bottom, top } = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const still = useReduceMotion();
  useEffect(() => { Animated.timing(enter, { toValue: 1, duration: still ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [enter, still]);
  const pad = tabs ? 24 : 24 + bottom;
  const rise = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };
  return (
    <View style={tw`flex-1 bg-cream`}>
      {scroll
        ? <Animated.View style={[{ flex: 1 }, rise]}><ScrollView contentContainerStyle={{ paddingBottom: pad }} keyboardShouldPersistTaps="handled">{children}</ScrollView></Animated.View>
        : <Animated.View style={[{ flex: 1, paddingBottom: tabs ? 0 : bottom }, rise]}>{children}</Animated.View>}
      {scroll && <LinearGradient pointerEvents="none" colors={["rgba(5,5,7,0.97)", "rgba(5,5,7,0.85)", "rgba(5,5,7,0)"]} locations={[0, 0.6, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: top + 14 }} />}
      {tabs && <BottomNav />}
    </View>
  );
}
