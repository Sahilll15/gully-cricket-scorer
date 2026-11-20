import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Path, Text } from "react-native-svg";
import { playerArt, playerJersey, SMALL_AVATAR, teamArt, teamJersey, type Shape } from "@shared/avatars";

function ShapeEl({ s }: { s: Shape }) {
  const p = { fill: s.fill ?? "none", stroke: s.stroke, strokeWidth: s.sw, strokeLinecap: s.stroke ? "round" as const : undefined, opacity: s.o };
  if (s.t === "circle") return <Circle cx={s.cx} cy={s.cy} r={s.r} {...p} />;
  if (s.t === "text") {
    return (
      <Text x={s.x} y={s.y} fontSize={s.size} letterSpacing={s.spacing} textAnchor="middle" fontFamily="Poppins_800ExtraBold" {...p}>
        {s.text}
      </Text>
    );
  }
  return <Path d={s.d} {...p} />;
}

/** Name-seeded jersey (player back or team front); hidden from screen readers, the name is printed beside it. */
export function AvatarSvg({ name, kind = "player", size = 44 }: { name: string; kind?: "player" | "team"; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const small = size < SMALL_AVATAR;
  const art = kind === "team" ? teamArt(teamJersey(name), small) : playerArt(playerJersey(name), small);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <ClipPath id={`${id}t`}><Circle cx={32} cy={32} r={32} /></ClipPath>
          <ClipPath id={`${id}b`}><Path d={art.body} /></ClipPath>
        </Defs>
        <G clipPath={`url(#${id}t)`}>
          {art.shapes.map((s, i) => (s.clip ? <G key={i} clipPath={`url(#${id}b)`}><ShapeEl s={s} /></G> : <ShapeEl key={i} s={s} />))}
        </G>
      </Svg>
    </View>
  );
}
