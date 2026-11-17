import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Black-on-white QR drawn as one SVG path, with the quiet zone scanners need. */
export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(value);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n: n + 8, d };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label="UPI payment QR code" shapeRendering="crispEdges" className="rounded-2xl bg-white">
      <path d={d} fill="#000" />
    </svg>
  );
}
