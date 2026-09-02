import { useState, useEffect, useMemo } from "react";
import type { ApiBeat, Rhythm } from "../../types";
import { toAnimatorThrows } from "../../utils/beats";
import {
  beatPoint,
  ringPathFromBeats,
  verticesFromBeats,
  chordParams,
  circularArcPath,
  SELF_LOOP_R,
  RING_RIGHT,
  RING_LEFT,
} from "../../utils/geometry";
import { throwEasing, pointOnPolygon, LOOP_MS } from "../../utils/animation";
import { siteswapLabel } from "../../utils/notation";
import "./FingerprintCard.css";

interface Props {
  uid: string;
  rhythm: Rhythm;
  beats: ApiBeat[];
  compact?: boolean;
}

export default function FingerprintCard({
  uid,
  rhythm,
  beats,
  compact = false,
}: Props) {
  const { n, leftBeats, rightBeats } = rhythm;
  const r = 60,
    cx = 80,
    cy = 80;
  const filterId = `glow-${uid}`;

  const [tealPos, setTealPos] = useState<[number, number]>([cx, cy - r]);
  const [pinkPos, setPinkPos] = useState<[number, number]>([cx, cy - r]);
  const [nodePulses, setNodePulses] = useState<
    Record<number, { key: number; color: string }>
  >({});
  const [arcTs, setArcTs] = useState<(number | null)[]>([]);

  const animatorThrows = useMemo(() => toAnimatorThrows(beats), [beats]);

  useEffect(() => {
    const tealVerts = verticesFromBeats(rightBeats, n, r, cx, cy);
    const pinkVerts = verticesFromBeats(leftBeats, n, r, cx, cy);
    const throwTiming = animatorThrows.map((thr) => ({
      throwStart: thr.beat / n,
      throwDuration: thr.value / n,
    }));

    setArcTs(animatorThrows.map(() => null));

    let rafId: number;
    let lastTime: number | null = null;
    let progress = 0;
    let lastTealEdge = 0;
    let lastPinkEdge = 0;

    function tick(time: number) {
      if (lastTime === null) lastTime = time;
      progress = (progress + (time - lastTime) / LOOP_MS) % 1;
      lastTime = time;

      setTealPos(pointOnPolygon(tealVerts, progress));
      const tealEdge =
        Math.floor(progress * tealVerts.length) % tealVerts.length;
      const tealHit = tealEdge !== lastTealEdge;
      if (tealHit) lastTealEdge = tealEdge;

      setPinkPos(pointOnPolygon(pinkVerts, progress));
      const pinkEdge =
        Math.floor(progress * pinkVerts.length) % pinkVerts.length;
      const pinkHit = pinkEdge !== lastPinkEdge;
      if (pinkHit) lastPinkEdge = pinkEdge;

      if (tealHit || pinkHit) {
        setNodePulses((prev) => {
          const next = { ...prev };
          if (tealHit) {
            const beat = rightBeats[tealEdge];
            next[beat] = { key: (prev[beat]?.key ?? 0) + 1, color: RING_RIGHT };
          }
          if (pinkHit) {
            const beat = leftBeats[pinkEdge];
            const sameAsTeal = tealHit && rightBeats[tealEdge] === beat;
            if (sameAsTeal) {
              next[beat] = { ...next[beat], color: "#fff" };
            } else {
              next[beat] = {
                key: (prev[beat]?.key ?? 0) + 1,
                color: RING_LEFT,
              };
            }
          }
          return next;
        });
      }

      setArcTs(
        throwTiming.map(({ throwStart, throwDuration }) => {
          const elapsed = (((progress - throwStart) % 1) + 1) % 1;
          if (elapsed > throwDuration) return null;
          return elapsed / throwDuration;
        }),
      );

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [n, leftBeats, rightBeats, animatorThrows]);

  function handDesc(beats: number[]): string {
    if (beats.length === 0) return "silent";
    const intervals = beats.map((b, i) =>
      i < beats.length - 1 ? beats[i + 1] - b : n - b,
    );
    const allEqual = intervals.every((v) => v === intervals[0]);
    return allEqual ? `every ${intervals[0]} beats` : intervals.join(" · ");
  }

  return (
    <div
      className={`fingerprint-card${compact ? " fingerprint-card--compact" : ""}`}
    >
      <svg viewBox="0 0 160 160" className="fingerprint-card__svg">
        <defs>
          <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.08)"
          strokeWidth={0.3}
        />

        <path
          d={ringPathFromBeats(rightBeats, n, r, cx, cy)}
          fill="none"
          className="fingerprint-ring-right"
          strokeWidth={0.5}
          opacity={0.6}
        />
        <path
          d={ringPathFromBeats(leftBeats, n, r, cx, cy)}
          fill="none"
          className="fingerprint-ring-left"
          strokeWidth={0.5}
          opacity={0.6}
        />

        {Array.from({ length: n }, (_, beat) => {
          const ang = (-90 + beat * (360 / n)) * (Math.PI / 180);
          const [x, y] = beatPoint(beat, n, r, cx, cy);
          const tx2 = cx + (r + 3.5) * Math.cos(ang);
          const ty2 = cy + (r + 3.5) * Math.sin(ang);
          const lx = cx + (r + 9) * Math.cos(ang);
          const ly = cy + (r + 9) * Math.sin(ang);
          const isLeft = leftBeats.includes(beat);
          const isRight = rightBeats.includes(beat);
          const dotColor =
            isLeft && isRight
              ? "#fff"
              : isRight
                ? RING_RIGHT
                : isLeft
                  ? RING_LEFT
                  : null;
          return (
            <g key={beat}>
              <line
                x1={x.toFixed(1)}
                y1={y.toFixed(1)}
                x2={tx2.toFixed(1)}
                y2={ty2.toFixed(1)}
                stroke="rgba(255,255,255,.12)"
                strokeWidth={0.3}
              />
              <text
                x={lx.toFixed(1)}
                y={ly.toFixed(1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={3.5}
                fill="rgba(255,255,255,.22)"
                fontFamily="monospace"
              >
                {siteswapLabel(beat)}
              </text>
              {dotColor ? (
                <circle cx={x} cy={y} r={1.8} fill={dotColor} />
              ) : (
                <circle cx={x} cy={y} r={0.6} fill="rgba(255,255,255,.08)" />
              )}
            </g>
          );
        })}

        {Object.entries(nodePulses).map(([beatStr, { key, color }]) => {
          const beat = Number(beatStr);
          const [x, y] = beatPoint(beat, n, r, cx, cy);
          return (
            <circle
              key={`${beat}-${key}`}
              cx={x}
              cy={y}
              r={2.5}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
              className="node-pulse"
            />
          );
        })}

        {arcTs.flatMap((t, i) => {
          if (t === null) return [];
          const thr = animatorThrows[i];
          if (!thr) return [];
          const color = thr.side === "right" ? RING_RIGHT : RING_LEFT;
          const isSelfLoop = (thr.beat + thr.value) % n === thr.beat;
          const gradId = `tail-${uid}-${i}`;
          const headOpacity = 0.7 * (1 - t);
          const tEased = throwEasing(t);

          if (isSelfLoop) {
            const [bx, by] = beatPoint(thr.beat, n, r, cx, cy);
            const beatAng = (-90 + thr.beat * (360 / n)) * (Math.PI / 180);
            const ox = bx - SELF_LOOP_R * Math.cos(beatAng);
            const oy = by - SELF_LOOP_R * Math.sin(beatAng);
            const sx = bx,
              sy = by;
            const endAng = beatAng + tEased * 2 * Math.PI;
            const ex = ox + SELF_LOOP_R * Math.cos(endAng);
            const ey = oy + SELF_LOOP_R * Math.sin(endAng);
            const d = circularArcPath(
              ox,
              oy,
              SELF_LOOP_R,
              beatAng,
              tEased * 2 * Math.PI,
            );
            return [
              <defs key={`${gradId}-d`}>
                <linearGradient
                  id={gradId}
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0} />
                  <stop
                    offset="100%"
                    stopColor={color}
                    stopOpacity={headOpacity}
                  />
                </linearGradient>
              </defs>,
              <path
                key={gradId}
                d={d}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={0.7}
                strokeLinecap="round"
              />,
            ];
          }

          const { x1, y1, mx, my, x2, y2 } = chordParams(
            thr.beat,
            thr.value,
            n,
            r,
            cx,
            cy,
          );
          const q0x = x1 + (mx - x1) * tEased,
            q0y = y1 + (my - y1) * tEased;
          const q1x = mx + (x2 - mx) * tEased,
            q1y = my + (y2 - my) * tEased;
          const ex = q0x + (q1x - q0x) * tEased,
            ey = q0y + (q1y - q0y) * tEased;
          const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${q0x.toFixed(1)} ${q0y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
          return [
            <defs key={`${gradId}-d`}>
              <linearGradient
                id={gradId}
                x1={x1}
                y1={y1}
                x2={ex}
                y2={ey}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0} />
                <stop
                  offset="100%"
                  stopColor={color}
                  stopOpacity={headOpacity}
                />
              </linearGradient>
            </defs>,
            <path
              key={gradId}
              d={d}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={0.7}
              strokeLinecap="round"
            />,
          ];
        })}

        <circle
          cx={tealPos[0]}
          cy={tealPos[1]}
          r={2}
          fill={RING_RIGHT}
          filter={`url(#${filterId})`}
        />
        <circle
          cx={pinkPos[0]}
          cy={pinkPos[1]}
          r={2}
          fill={RING_LEFT}
          filter={`url(#${filterId})`}
        />
      </svg>

      <div className="fingerprint-card__legend">
        <span>
          <span className="legend-swatch legend-swatch--l" />
          Left · {handDesc(leftBeats)}
        </span>
        <span>
          <span className="legend-swatch legend-swatch--r" />
          Right · {handDesc(rightBeats)}
        </span>
      </div>
    </div>
  );
}
