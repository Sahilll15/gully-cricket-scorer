import { useId } from "react";
import { playerArt, playerJersey, SMALL_AVATAR, teamArt, teamJersey, type Shape } from "./avatars";

function ShapeEl({ s }: { s: Shape }) {
  const p = { fill: s.fill ?? "none", stroke: s.stroke, strokeWidth: s.sw, strokeLinecap: s.stroke ? "round" as const : undefined, opacity: s.o };
  if (s.t === "circle") return <circle cx={s.cx} cy={s.cy} r={s.r} {...p} />;
  if (s.t === "text") {
    return (
      <text x={s.x} y={s.y} fontSize={s.size} letterSpacing={s.spacing} textAnchor="middle" fontFamily="Poppins, system-ui, sans-serif" fontWeight={800} {...p}>
        {s.text}
      </text>
    );
  }
  return <path d={s.d} {...p} />;
}

/** Name-seeded jersey: back with initials (player) or front with the team code; decorative, the name is printed beside it. */
export function AvatarSvg({ name, kind = "player", size = 44 }: { name: string; kind?: "player" | "team"; size?: number }) {
  const id = useId().replace(/:/g, "");
  const small = size < SMALL_AVATAR;
  const art = kind === "team" ? teamArt(teamJersey(name), small) : playerArt(playerJersey(name), small);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className="shrink-0" style={{ width: size, height: size }}>
      <defs>
        <clipPath id={`${id}t`}><circle cx={32} cy={32} r={32} /></clipPath>
        <clipPath id={`${id}b`}><path d={art.body} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}t)`}>
        {art.shapes.map((s, i) => (s.clip ? <g key={i} clipPath={`url(#${id}b)`}><ShapeEl s={s} /></g> : <ShapeEl key={i} s={s} />))}
      </g>
    </svg>
  );
}
