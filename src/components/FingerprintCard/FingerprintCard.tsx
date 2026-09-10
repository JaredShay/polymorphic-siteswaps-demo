import { useState, useEffect, useMemo } from "react";
import type { ApiBeat, Rhythm } from "../../types";
import { toAnimatorThrows, type AnimatorThrow } from "../../utils/beats";
import {
  beatAngle,
  ringPathFromBeats,
  ringPathFromAngles,
  verticesFromBeats,
  verticesFromAngles,
  chordalHand,
  chordControlPoints,
  circularArcPath,
  SELF_LOOP_R,
  RING_RIGHT,
  RING_LEFT,
} from "../../utils/geometry";
import {
  throwEasing,
  pointOnPolygonTimed,
  currentEdgeIndex,
  LOOP_MS,
} from "../../utils/animation";
import { siteswapLabel } from "../../utils/notation";
import "./FingerprintCard.css";

interface Props {
  uid: string;
  rhythm: Rhythm;
  beats: ApiBeat[];
}

export default function FingerprintCard({ uid, rhythm, beats }: Props) {
  const { n, leftBeats, rightBeats } = rhythm;
  const r = 60,
    cx = 80,
    cy = 80;
  const filterId = `glow-${uid}`;

  const [tealPos, setTealPos] = useState<[number, number]>([cx, cy - r]);
  const [pinkPos, setPinkPos] = useState<[number, number]>([cx, cy - r]);
  const [nodePulses, setNodePulses] = useState<
    Record<string, { key: number; color: string; x: number; y: number }>
  >({});
  const [arcTs, setArcTs] = useState<({ t: number; cycle: number } | null)[]>(
    [],
  );

  const animatorThrows = useMemo(() => toAnimatorThrows(beats), [beats]);
  const chordedRight = useMemo(
    () => chordalHand(rightBeats, n),
    [rightBeats, n],
  );
  const chordedLeft = useMemo(() => chordalHand(leftBeats, n), [leftBeats, n]);

  // Map from original beat index → chordal angle, for rendering dots/labels
  const beatAngleMap = useMemo(() => {
    const map = new Map<number, number>();
    // Only store first occurrence so label positions are stable
    chordedRight?.effectiveBeats.forEach((b, i) => {
      if (!map.has(b)) map.set(b, chordedRight.angles[i]);
    });
    chordedLeft?.effectiveBeats.forEach((b, i) => {
      if (!map.has(b)) map.set(b, chordedLeft.angles[i]);
    });
    return map;
  }, [chordedRight, chordedLeft]);

  const isChordal = chordedRight !== null || chordedLeft !== null;

  // Angle lookup for throw arcs: use chordal position when available
  const beatAngFn = (b: number) => beatAngleMap.get(b) ?? beatAngle(b, n);

  // For 2-cycle hands, arcs in cycle 1 must use the second-cycle vertex angle.
  // isLanding=true computes the landing vertex (accounting for carry-over into next cycle).
  function throwVertexAngle(
    thr: AnimatorThrow,
    cycle: number,
    isLanding: boolean,
  ): number {
    const chorded = thr.side === "right" ? chordedRight : chordedLeft;
    const handBeats = thr.side === "right" ? rightBeats : leftBeats;
    if (!chorded || chorded.periodScale === 1) {
      return beatAngFn(isLanding ? (thr.beat + thr.value) % n : thr.beat);
    }
    const ps = chorded.periodScale;
    const m = handBeats.length;
    if (isLanding) {
      const doubledLand = (thr.beat + cycle * n + thr.value) % (n * ps);
      const landBeat = doubledLand % n;
      const landCycle = Math.floor(doubledLand / n);
      const idx = handBeats.indexOf(landBeat);
      const vertIdx = idx + m * landCycle;
      return vertIdx >= 0 && vertIdx < chorded.angles.length
        ? chorded.angles[vertIdx]
        : beatAngFn(landBeat);
    } else {
      const idx = handBeats.indexOf(thr.beat);
      const vertIdx = idx + m * cycle;
      return vertIdx >= 0 && vertIdx < chorded.angles.length
        ? chorded.angles[vertIdx]
        : beatAngFn(thr.beat);
    }
  }

  useEffect(() => {
    const tealVerts = chordedRight
      ? verticesFromAngles(chordedRight.angles, r, cx, cy)
      : verticesFromBeats(rightBeats, n, r, cx, cy);
    const pinkVerts = chordedLeft
      ? verticesFromAngles(chordedLeft.angles, r, cx, cy)
      : verticesFromBeats(leftBeats, n, r, cx, cy);
    const rightBeatFractions = chordedRight
      ? chordedRight.beatFractions
      : rightBeats.map((b) => b / n);
    const leftBeatFractions = chordedLeft
      ? chordedLeft.beatFractions
      : leftBeats.map((b) => b / n);
    const throwTiming = animatorThrows.map((thr) => {
      const chorded = thr.side === "right" ? chordedRight : chordedLeft;
      const handBeats = thr.side === "right" ? rightBeats : leftBeats;
      if (chorded && chorded.periodScale > 1) {
        const beatIdx = handBeats.indexOf(thr.beat);
        const throwStart =
          beatIdx >= 0 ? chorded.beatFractions[beatIdx] : thr.beat / n;
        return {
          throwStart,
          throwDuration: thr.value / (n * chorded.periodScale),
          periodScale: chorded.periodScale,
        };
      }
      return {
        throwStart: thr.beat / n,
        throwDuration: thr.value / n,
        periodScale: 1,
      };
    });

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

      setTealPos(pointOnPolygonTimed(tealVerts, rightBeatFractions, progress));
      const tealEdge = currentEdgeIndex(rightBeatFractions, progress);
      const tealHit = tealEdge !== lastTealEdge;
      if (tealHit) lastTealEdge = tealEdge;

      setPinkPos(pointOnPolygonTimed(pinkVerts, leftBeatFractions, progress));
      const pinkEdge = currentEdgeIndex(leftBeatFractions, progress);
      const pinkHit = pinkEdge !== lastPinkEdge;
      if (pinkHit) lastPinkEdge = pinkEdge;

      if (tealHit || pinkHit) {
        setNodePulses((prev) => {
          const next = { ...prev };
          if (tealHit) {
            const beat = chordedRight
              ? chordedRight.effectiveBeats[tealEdge]
              : rightBeats[tealEdge];
            const [px, py] = tealVerts[tealEdge];
            next[`r${tealEdge}`] = {
              key: (prev[`r${tealEdge}`]?.key ?? 0) + 1,
              color: RING_RIGHT,
              x: px,
              y: py,
            };
            void beat; // beat identity used below for same-as-teal check
          }
          if (pinkHit) {
            const pinkBeat = chordedLeft
              ? chordedLeft.effectiveBeats[pinkEdge]
              : leftBeats[pinkEdge];
            const tealBeat = chordedRight
              ? chordedRight.effectiveBeats[tealEdge]
              : rightBeats[tealEdge];
            const sameAsTeal = tealHit && tealBeat === pinkBeat;
            const [px, py] = pinkVerts[pinkEdge];
            const key = `p${pinkEdge}`;
            if (sameAsTeal) {
              // Collision: overwrite teal pulse at same position with white
              next[`r${tealEdge}`] = { ...next[`r${tealEdge}`], color: "#fff" };
            } else {
              next[key] = {
                key: (prev[key]?.key ?? 0) + 1,
                color: RING_LEFT,
                x: px,
                y: py,
              };
            }
          }
          return next;
        });
      }

      setArcTs(
        throwTiming.map(({ throwStart, throwDuration, periodScale }) => {
          for (let c = 0; c < periodScale; c++) {
            const elapsed =
              (((progress - throwStart - c / periodScale) % 1) + 1) % 1;
            if (elapsed <= throwDuration)
              return { t: elapsed / throwDuration, cycle: c };
          }
          return null;
        }),
      );

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [n, leftBeats, rightBeats, animatorThrows, chordedRight, chordedLeft]);

  function handDesc(beats: number[]): string {
    if (beats.length === 0) return "silent";
    const intervals = beats.map((b, i) =>
      i < beats.length - 1 ? beats[i + 1] - b : n - b + beats[0],
    );
    const allEqual = intervals.every((v) => v === intervals[0]);
    return allEqual ? `every ${intervals[0]} beats` : `${beats.length} beats`;
  }

  return (
    <div className="fingerprint-card">
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
          d={
            chordedRight
              ? ringPathFromAngles(chordedRight.angles, r, cx, cy)
              : ringPathFromBeats(rightBeats, n, r, cx, cy)
          }
          fill="none"
          className="fingerprint-ring-right"
          strokeWidth={0.5}
          opacity={0.6}
        />
        <path
          d={
            chordedLeft
              ? ringPathFromAngles(chordedLeft.angles, r, cx, cy)
              : ringPathFromBeats(leftBeats, n, r, cx, cy)
          }
          fill="none"
          className="fingerprint-ring-left"
          strokeWidth={0.5}
          opacity={0.6}
        />

        {Array.from({ length: n }, (_, beat) => {
          const ang = beatAngleMap.get(beat) ?? beatAngle(beat, n);
          const x = cx + r * Math.cos(ang);
          const y = cy + r * Math.sin(ang);
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

          // Label: beat index for all active beats; nothing for inactive beats
          // in chordal mode (avoids confusing float interval values).
          const label =
            !isChordal || isLeft || isRight ? siteswapLabel(beat) : null;

          return (
            <g key={beat}>
              {!isChordal && (
                <line
                  x1={x.toFixed(1)}
                  y1={y.toFixed(1)}
                  x2={(cx + (r + 3.5) * Math.cos(ang)).toFixed(1)}
                  y2={(cy + (r + 3.5) * Math.sin(ang)).toFixed(1)}
                  stroke="rgba(255,255,255,.12)"
                  strokeWidth={0.3}
                />
              )}
              {label !== null && (
                <text
                  x={lx.toFixed(1)}
                  y={ly.toFixed(1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={3.5}
                  fill="rgba(255,255,255,.22)"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              )}
              {dotColor ? (
                <circle cx={x} cy={y} r={1.8} fill={dotColor} />
              ) : (
                <circle cx={x} cy={y} r={0.6} fill="rgba(255,255,255,.08)" />
              )}
            </g>
          );
        })}

        {/* Second-cycle vertices for 2-cycle hands (same beat index, different position) */}
        {isChordal &&
          ([chordedRight, chordedLeft] as const).flatMap((ch, hi) => {
            if (!ch) return [];
            const color = hi === 0 ? RING_RIGHT : RING_LEFT;
            const seen = new Set<number>();
            return ch.effectiveBeats.flatMap((b, i) => {
              if (seen.has(b)) {
                const ang = ch.angles[i];
                const vx = cx + r * Math.cos(ang);
                const vy = cy + r * Math.sin(ang);
                const lx2 = cx + (r + 9) * Math.cos(ang);
                const ly2 = cy + (r + 9) * Math.sin(ang);
                return [
                  <g key={`sc-${hi}-${i}`} opacity={0.45}>
                    <circle cx={vx} cy={vy} r={1.8} fill={color} />
                    <text
                      x={lx2.toFixed(1)}
                      y={ly2.toFixed(1)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={3.5}
                      fill={color}
                      fontFamily="monospace"
                    >
                      {siteswapLabel(b)}
                    </text>
                  </g>,
                ];
              }
              seen.add(b);
              return [];
            });
          })}

        {Object.entries(nodePulses).map(([slotKey, { key, color, x, y }]) => (
          <circle
            key={`${slotKey}-${key}`}
            cx={x}
            cy={y}
            r={2.5}
            fill="none"
            stroke={color}
            strokeWidth={0.5}
            className="node-pulse"
          />
        ))}

        {arcTs.flatMap((arcEntry, i) => {
          if (arcEntry === null) return [];
          const { t, cycle } = arcEntry;
          const thr = animatorThrows[i];
          if (!thr) return [];
          const color = thr.side === "right" ? RING_RIGHT : RING_LEFT;
          const isSelfLoop = (thr.beat + thr.value) % n === thr.beat;
          const gradId = `tail-${uid}-${i}`;
          const headOpacity = 0.7 * (1 - t);
          const tEased = throwEasing(t);

          if (isSelfLoop) {
            const beatAng = throwVertexAngle(thr, cycle, false);
            const bx = cx + r * Math.cos(beatAng);
            const by = cy + r * Math.sin(beatAng);
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

          const ang1 = throwVertexAngle(thr, cycle, false);
          const ang2 = throwVertexAngle(thr, cycle, true);
          const { x1, y1, mx, my, x2, y2 } = chordControlPoints(
            ang1,
            ang2,
            thr.value,
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
