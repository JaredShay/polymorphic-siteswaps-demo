import type { Pattern, Rhythm } from "../../types";
import type { GeneratorStatus } from "../../hooks/useGenerator";
import FingerprintCard from "../FingerprintCard/FingerprintCard";
import { RING_LEFT, RING_RIGHT } from "../../utils/geometry";
import "./PatternQueue.css";

interface Props {
  patterns: Pattern[];
  primaryIndex: number;
  status: GeneratorStatus;
  generatingRhythm: Rhythm | null;
  limit: number;
  sessionIndex: number;
  sessionCount: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onSelect: (index: number) => void;
  onBack: () => void;
  onForward: () => void;
}

function SkeletonSlot({ rhythm }: { rhythm: Rhythm }) {
  const { n, leftBeats, rightBeats } = rhythm;
  const cx = 32,
    cy = 32,
    r = 24;

  function beatPoint(beat: number): [number, number] {
    const ang = (-90 + beat * (360 / n)) * (Math.PI / 180);
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  }

  return (
    <div className="pattern-queue__skeleton">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.08)"
          strokeWidth={0.3}
        />
        {rightBeats.map((b) => {
          const [x, y] = beatPoint(b);
          return (
            <circle
              key={`r${b}`}
              cx={x}
              cy={y}
              r={1.5}
              fill={RING_RIGHT}
              opacity={0.6}
            />
          );
        })}
        {leftBeats.map((b) => {
          const [x, y] = beatPoint(b);
          return (
            <circle
              key={`l${b}`}
              cx={x}
              cy={y}
              r={1.5}
              fill={RING_LEFT}
              opacity={0.6}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function PatternQueue({
  patterns,
  primaryIndex,
  status,
  generatingRhythm,
  limit,
  sessionIndex,
  sessionCount,
  canGoBack,
  canGoForward,
  onSelect,
  onBack,
  onForward,
}: Props) {
  const skeletonCount =
    status === "generating" && sessionIndex === 0
      ? Math.max(0, limit - patterns.length)
      : 0;

  const statusText = (() => {
    const sessionLabel =
      sessionCount > 0
        ? `Session ${sessionCount - sessionIndex} of ${sessionCount}`
        : null;
    const patternLabel =
      status === "generating"
        ? `${patterns.length} / ${limit} found`
        : patterns.length > 0
          ? `${patterns.length} patterns`
          : null;
    return [sessionLabel, patternLabel].filter(Boolean).join("  ·  ");
  })();

  return (
    <div className="pattern-queue">
      <div className="pattern-queue__row">
        <button
          className="pattern-queue__nav"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Previous generation"
        >
          ←
        </button>

        {patterns.map((pattern, i) => (
          <div
            key={pattern.id}
            className={`pattern-queue__slot${i === primaryIndex ? " pattern-queue__slot--active" : ""}`}
            onClick={() => onSelect(i)}
          >
            <FingerprintCard
              uid={pattern.id}
              rhythm={pattern.rhythm}
              beats={pattern.beats}
              compact
            />
          </div>
        ))}

        {generatingRhythm &&
          Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonSlot key={`sk-${i}`} rhythm={generatingRhythm} />
          ))}

        <button
          className="pattern-queue__nav"
          onClick={onForward}
          disabled={!canGoForward}
          aria-label="Next generation"
        >
          →
        </button>
      </div>

      {statusText && <p className="pattern-queue__status">{statusText}</p>}
    </div>
  );
}
