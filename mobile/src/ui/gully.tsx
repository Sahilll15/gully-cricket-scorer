import { useId } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

/** Gully touches (DESIGN.md): street lamp, brick wall, chalk and tape ball. Quiet by design. */
const INK = "#0b0d0c", LIME = "#d6ff63", TEAL = "#aab2ac", MUTE = "#7e8680", OUT = "#ff6b57";
const CHALK = "rgba(238,241,236,0.24)";
/** Uneven dash gaps read as chalk dragged over rough ground. */
const GRAIN = "7 0.9 4 0.7 10 1.1 3 0.6";

/** SVG ids must be plain: React's useId adds colons that break url(#...). */
const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, "");

/** One street lamp from the top right: warm white cone, faint sodium near the bulb. */
export function StreetLamp({ height = 460 }: { height?: number }) {
  const w = useWindowDimensions().width, x = w * 0.88, id = useSvgId("lamp");
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#ffc46b" stopOpacity="0.12" />
            <Stop offset="0.1" stopColor="#fff1d8" stopOpacity="0.085" />
            <Stop offset="0.5" stopColor="#fff1d8" stopOpacity="0.035" />
            <Stop offset="1" stopColor="#fff1d8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={x} cy={-16} rx={w * 0.44} ry={height * 1.05} fill={`url(#${id})`} transform={`rotate(26 ${x} -16)`} />
      </Svg>
    </View>
  );
}

/** Faint brick courses, like the wall behind a gully pitch. Fades out toward the bottom. */
export function BrickWall({ fade = "#141716" }: { fade?: string }) {
  const id = useSvgId("brick");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={28} height={20}>
            <G stroke="#eef1ec" strokeOpacity={0.045} strokeWidth={1}>
              <Line x1={0} y1={0.5} x2={28} y2={0.5} />
              <Line x1={0} y1={10.5} x2={28} y2={10.5} />
              <Line x1={0.5} y1={0} x2={0.5} y2={10} />
              <Line x1={14.5} y1={10} x2={14.5} y2={20} />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <LinearGradient colors={[`${fade}00`, fade]} start={{ x: 0.5, y: 0.25 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** A thin chalk crease, used as a section divider. */
export function Crease({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height: 4 }, style]}>
      <Svg width="100%" height={4}>
        <Line x1={1} y1={2} x2="100%" y2={2} stroke={CHALK} strokeWidth={1.5} strokeDasharray="8 5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** A wicket circled in chalk, the way a scorer rings it. Sits behind the chip label. */
export function ChalkRing({ color = OUT }: { color?: string }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 40 40" preserveAspectRatio="none">
      <Path d="M21 3.6 C31 3.4 36.6 10.4 36.3 20.6 C36 30.6 28.8 36.7 19.6 36.4 C9.8 36.1 3.5 29.4 3.7 19.9 C3.9 10.4 10.6 4.2 23.4 5.2"
        stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeDasharray={GRAIN} />
      <Path d="M19 4.6 C28.6 4.2 35.4 11.2 35.2 20.2 C35 29.6 28.4 35.6 20.4 35.5 C11 35.4 4.6 28.8 4.8 20.4"
        stroke={color} strokeOpacity={0.45} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Three chalk stumps with bails on a crease. Small motif for empty states. */
export function ChalkStumps({ size = 44, color = TEAL }: { size?: number; color?: string }) {
  const s = { stroke: color, fill: "none", strokeLinecap: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G {...s} strokeWidth={2} strokeDasharray={GRAIN}>
        <Path d="M13.2 12.6 L12.8 22.8 L13.3 32.6" />
        <Path d="M20 12.2 L20.3 22.4 L19.8 32.8" />
        <Path d="M26.8 12.6 L27.1 22.6 L26.6 32.4" />
      </G>
      <G {...s} strokeWidth={1.6}>
        <Path d="M11.8 10.6 L19.2 10.2" />
        <Path d="M20.8 10.2 L28.2 10.7" />
      </G>
      <Path d="M5 35.2 L35 34.7" {...s} strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="4 3" />
    </Svg>
  );
}

/** Tennis ball with a band of insulation tape. `ink` sits on lime, `mute` for empty states. */
export function TapeBall({ size = 24, tone = "sun" }: { size?: number; tone?: "sun" | "ink" | "mute" }) {
  const id = useSvgId("tape");
  const look = {
    sun: { fill: LIME, edge: LIME, seam: "rgba(11,13,12,0.45)", tape: "#1c201e", shine: "#eef1ec" },
    ink: { fill: INK, edge: INK, seam: "rgba(214,255,99,0.55)", tape: "#3a413c", shine: LIME },
    mute: { fill: "rgba(170,178,172,0.08)", edge: TEAL, seam: MUTE, tape: "rgba(170,178,172,0.4)", shine: TEAL },
  }[tone];
  // A solid ball with a band curving round it: a straight diagonal strip read as a "no entry" sign.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={id}><Circle cx={12} cy={12} r={9.6} /></ClipPath>
      </Defs>
      <Circle cx={12} cy={12} r={9.6} fill={look.fill} stroke={look.edge} strokeWidth={tone === "mute" ? 1.6 : 0} />
      <G clipPath={`url(#${id})`}>
        <Path d="M6.2 3.4 C9.6 5.6 9.8 8.2 9.2 9.6 M17.8 3.4 C14.4 5.6 14.2 8.2 14.8 9.6 M9.2 15.2 C9.8 17 9.4 19 6.4 20.8 M14.8 15.2 C14.2 17 14.6 19 17.6 20.8" stroke={look.seam} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <Path d="M1.8 10 Q12 13.2 22.2 10 L22.2 14.6 Q12 17.8 1.8 14.6 Z" fill={look.tape} />
        <Path d="M1.8 11.3 Q12 14.5 22.2 11.3" stroke={look.shine} strokeOpacity={0.18} strokeWidth={0.6} fill="none" />
      </G>
    </Svg>
  );
}
