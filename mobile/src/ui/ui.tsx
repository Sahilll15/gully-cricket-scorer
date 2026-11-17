import { isValidElement, useEffect, useRef, type ReactNode } from "react";
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { create } from "twrnc";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Ball } from "@shared/engine/types";
import { ballLabel } from "@shared/engine/engine";
import { BarChart3, ChevronLeft, History as HistoryIcon, House, Trophy, Users, X, type LucideIcon } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useStore, type Screen } from "@/lib/store";
import { BrickWall, ChalkRing, StreetLamp } from "./gully";

/** Floodlights (DESIGN.md): charcoal ground, floodlight lime as the only accent. `sun` is the accent role. */
export const C = {
  sun: "#d6ff63", ember: "#a8d63a", sunSoft: "#1c2416", cream: "#0b0d0c", panel: "#141716", key: "#1c201e", raised: "#232825",
  teal: "#aab2ac", fg: "#eef1ec", ink: "#0b0d0c", mute: "#7e8680", line: "#232825", out: "#ff6b57", six: "#d6ff63", four: "#eef1ec", win: "#d6ff63",
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
  "400": "Inter_400Regular", normal: "Inter_400Regular", "500": "Inter_500Medium", "600": "Inter_600SemiBold",
  "700": "Inter_700Bold", bold: "Inter_700Bold", "800": "Inter_700Bold", "900": "Inter_700Bold",
};

/** Text in Inter. Android ignores fontWeight on custom fonts, so the weight picks the font file instead. */
export function Txt({ style, ...p }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, ...rest } = flat;
  return <Text {...p} style={[{ color: C.fg, fontFamily: FONT[String(fontWeight ?? "400")] ?? FONT["400"] }, rest]} />;
}

const MONO: Record<string, string> = { "400": "JetBrainsMono_500Medium", "500": "JetBrainsMono_500Medium", "600": "JetBrainsMono_700Bold", "700": "JetBrainsMono_700Bold", "800": "JetBrainsMono_800ExtraBold", "900": "JetBrainsMono_800ExtraBold" };

/** Every number in JetBrains Mono: tabular, so a score never jumps sideways as runs change. */
export function Num({ style, ...p }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, ...rest } = flat;
  return <Text {...p} style={[{ color: C.fg, fontFamily: MONO[String(fontWeight ?? "700")] ?? MONO["700"], includeFontPadding: false }, rest]} />;
}
/** Kept for screens that put numbers in Display; it is the mono numeral face now. */
export const Display = Num;

/** The floodlit scoreboard: dot-matrix lime digits with a soft glow. Only for the main live score. */
export function Board({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ color: C.sun, fontFamily: "Doto_900Black", includeFontPadding: false, textShadowColor: "rgba(214,255,99,0.45)", textShadowRadius: 18 }, style]} />;
}

/** A single street lamp over the gully, behind a screen's content. */
export function Beams({ height = 460 }: { height?: number }) {
  return <StreetLamp height={height} />;
}

/** Ring that fills as the chase closes in; the middle shows what is still needed. */
export function ChaseRing({ done, size = 118, children }: { done: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 7, len = 2 * Math.PI * r, f = Math.max(0, Math.min(1, done));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#1e2321" strokeWidth={9} fill="none" />
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
          backgroundColor: i === current ? C.sunSoft : i === best && r > 0 ? C.sun : "#2c332e",
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

/** Header ground: transparent over the page so the floodlight beams show through. */
export function Glow({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

export function IconButton({ icon: I, onPress, label, tone = "key", size = 44 }: { icon: LucideIcon; onPress?: () => void; label: string; tone?: "key" | "sun" | "glass"; size?: number }) {
  const bg = tone === "sun" ? C.sun : tone === "glass" ? "rgba(255,255,255,0.08)" : C.panel;
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size, backgroundColor: bg, alignItems: "center", justifyContent: "center", borderWidth: tone === "sun" ? 0 : 1, borderColor: C.line }}>
      <I size={Math.round(size * 0.48)} color={tone === "sun" ? C.ink : C.fg} strokeWidth={2.4} />
    </Press>
  );
}

export function Header({ title, back, right, children }: { title: string; back?: () => void; right?: ReactNode; children?: ReactNode }) {
  const top = useSafeAreaInsets().top;
  return (
    <Glow style={[tw`px-4 pb-3`, { paddingTop: Math.max(14, top + 6) }]}>
      <View style={tw`flex-row items-center gap-3 h-12`}>
        {back ? <IconButton icon={ChevronLeft} onPress={back} label="Back" size={40} /> : <View style={tw`w-10`} />}
        <Txt style={tw`flex-1 text-center text-[16px] font-semibold text-teal`} numberOfLines={1}>{title}</Txt>
        <View style={tw`min-w-11 flex-row justify-end`}>{right}</View>
      </View>
      {children}
    </Glow>
  );
}

/** The scoreboard card for a live or finished score: charcoal with a faint lime wash; `wall` adds faint bricks. */
export function ScoreHero({ children, style, wall }: { children: ReactNode; style?: StyleProp<ViewStyle>; wall?: boolean }) {
  return (
    <View style={[{ borderRadius: 22, overflow: "hidden", backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }, style]}>
      {wall && <BrickWall fade={C.panel} />}
      <LinearGradient colors={["rgba(214,255,99,0.07)", "rgba(214,255,99,0)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }} style={StyleSheet.absoluteFill} />
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
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: "#22302a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2e3a33" }}>
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
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose?.()}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={tw`flex-1 justify-end`}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[tw`rounded-t-[28px] border-t border-line`, { maxHeight: "88%", backgroundColor: "#111413" }]}>
          <ScrollView style={[tw`px-5`, { flexShrink: 1 }]} contentContainerStyle={{ paddingTop: 12, paddingBottom: footer ? 16 : Math.max(16, bottom + 8) }}
            keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={tw`self-center mb-3 h-1.5 w-12 rounded-full bg-line`} />
            <View style={tw`mb-4 flex-row items-center justify-between`}>
              <Txt style={tw`flex-1 text-[19px] font-semibold`}>{title}</Txt>
              {onClose && (
                <IconButton icon={X} onPress={onClose} label="Close" size={40} />
              )}
            </View>
            {children}
          </ScrollView>
          {footer && <View style={[tw`border-t border-line px-5 pt-3`, { backgroundColor: "#111413" }, { paddingBottom: Math.max(16, bottom + 8) }]}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
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
  return <View style={[tw`rounded-[22px] border border-line bg-panel p-4`, style]}>{children}</View>;
}

/** Labels like `Retire {name}` arrive as arrays; React Native needs every string inside a Txt. */
const isText = (c: ReactNode) => !isValidElement(c) && (typeof c === "string" || typeof c === "number" || Array.isArray(c));

export function PrimaryButton({ children, onPress, disabled, tone = "sun" }: { children: ReactNode; onPress?: () => void; disabled?: boolean; tone?: "sun" | "navy" }) {
  return (
    <Press onPress={onPress} disabled={disabled}
      style={tw`w-full min-h-14 rounded-[18px] items-center justify-center px-4 ${tone === "sun" ? "bg-sun" : "bg-panel border border-line"}`}>
      {isText(children) ? <Txt style={tw`text-[16px] font-semibold ${tone === "sun" ? "text-ink" : "text-fg"}`}>{children}</Txt> : children}
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

/** Floating tab bar for the five top-level screens. The active tab grows into an orange pill with its label. */
export function BottomNav() {
  const { screen, go } = useStore();
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View pointerEvents="box-none" style={[tw`absolute left-0 right-0 bottom-0 px-4`, { paddingBottom: Math.max(14, bottom + 6) }]}>
      <View style={[tw`flex-row items-center rounded-full border border-line px-2 py-2`, { backgroundColor: "rgba(20,23,22,0.96)", elevation: 16, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }]}>
        {NAV.map(({ s, label, icon: I }) => {
          const on = screen === s;
          return (
            <Press key={s} onPress={() => go(s)} accessibilityLabel={label} accessibilityState={{ selected: on }}
              style={{ flexGrow: on ? 2.2 : 1, flexShrink: 1, flexBasis: 0, height: 48, alignItems: "center", justifyContent: "center" }}>
              {/* Explicit flex numbers: toggling the flex-1 class leaves stale widths on the new architecture. */}
              <View style={[tw`h-12 flex-row items-center justify-center gap-1.5`, { borderRadius: 24 }, on ? tw`bg-sun px-4 self-stretch` : null]}>
                <I size={20} color={on ? C.ink : C.mute} strokeWidth={on ? 2.4 : 2} />
                {on && <Txt numberOfLines={1} style={tw`text-[13px] font-semibold text-ink`}>{label}</Txt>}
              </View>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

export function Segmented<T extends string | number>({ items, value, set }: { items: { v: T; label: ReactNode }[]; value: T; set: (v: T) => void }) {
  return (
    <View style={tw`flex-row gap-1 rounded-full border border-line bg-panel p-1`}>
      {items.map((it) => (
        <Press key={String(it.v)} onPress={() => set(it.v)} style={tw`min-h-11 flex-1 rounded-full px-2 items-center justify-center ${value === it.v ? "bg-sun" : ""}`}>
          {isText(it.label)
            ? <Txt numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={tw`text-[13px] font-medium ${value === it.v ? "text-ink" : "text-teal"}`}>{it.label}</Txt> : it.label}
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

/** Full-height screen body on the brand background with safe-area bottom padding. */
export function Page({ children, scroll = true, tabs = false }: { children: ReactNode; scroll?: boolean; tabs?: boolean }) {
  const { bottom, top } = useSafeAreaInsets();
  const pad = tabs ? 112 + bottom : 24 + bottom;
  return (
    <View style={tw`flex-1 bg-cream`}>
      <Beams />
      {scroll
        ? <ScrollView contentContainerStyle={{ paddingBottom: pad }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={{ flex: 1, paddingBottom: tabs ? 0 : bottom }}>{children}</View>}
      {scroll && <LinearGradient pointerEvents="none" colors={["rgba(11,13,12,0.97)", "rgba(11,13,12,0.85)", "rgba(11,13,12,0)"]} locations={[0, 0.6, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: top + 14 }} />}
      {tabs && <BottomNav />}
    </View>
  );
}
