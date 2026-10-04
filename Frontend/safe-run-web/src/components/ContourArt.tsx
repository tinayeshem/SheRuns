import { useId, useMemo, type CSSProperties } from "react";

type Props = { className?: string; rings?: number; seed?: number };

function ringPath(r: number, k: number, seed: number) {
  const N = 120;
  const parts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob =
      1 +
      0.09 * Math.sin(3 * a + seed + k * 0.35) +
      0.06 * Math.sin(5 * a - seed * 1.7 + k * 0.2) +
      0.03 * Math.sin(7 * a + k);
    const x = 300 + Math.cos(a) * r * wob;
    const y = 300 + Math.sin(a) * r * 0.86 * wob;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ") + "Z";
}

export default function ContourArt({ className = "", rings = 16, seed = 1 }: Props) {
  const gid = "cg" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const paths = useMemo(
    () =>
      Array.from({ length: rings }, (_, i) => ({
        d: ringPath(36 + i * (250 / rings), i, seed),
        dur: 46 + ((i * 7) % 5) * 12,
        reverse: i % 2 === 1,
        opacity: 0.95 - (i / rings) * 0.55,
      })),
    [rings, seed]
  );

  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <g className="contour-breathe">
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={`url(#${gid})`}
            strokeWidth={1.4}
            strokeOpacity={p.opacity}
            className="contour-ring"
            style={
              {
                "--dur": `${p.dur}s`,
                "--dir": p.reverse ? "reverse" : "normal",
              } as CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  );
}