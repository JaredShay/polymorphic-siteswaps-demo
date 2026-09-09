import type { Rhythm } from "../../types";
import { ringPathFromBeats } from "../../utils/geometry";
import "./RhythmIcon.css";

interface Props {
  rhythm: Rhythm;
  name: string;       // aria-label on the SVG
  label?: string;     // if provided: shown as centered SVG text; span below is hidden
  size?: number;      // explicit px width/height for the outer div
  decorative?: boolean; // if true: SVG is aria-hidden (used inside already-labelled buttons)
}

const r = 52, cx = 64, cy = 64;

export default function RhythmIcon({ rhythm, name, label, size, decorative }: Props) {
  const { n, leftBeats, rightBeats } = rhythm;

  return (
    <div
      className="rhythm-icon"
      style={size ? { width: size, height: size } : undefined}
    >
      <svg
        viewBox="0 0 128 128"
        className="rhythm-icon__svg"
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative ? true : undefined}
      >
        <circle cx={cx} cy={cy} r={r} className="rhythm-icon__ring" />
        <path
          d={ringPathFromBeats(rightBeats, n, r, cx, cy)}
          fill="none"
          className="rhythm-icon__poly-right"
        />
        <path
          d={ringPathFromBeats(leftBeats, n, r, cx, cy)}
          fill="none"
          className="rhythm-icon__poly-left"
        />
        {label && (
          <>
            <circle
              cx={cx}
              cy={cy}
              r={22}
              fill="var(--bg)"
              opacity={0.72}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="rhythm-icon__ratio"
            >
              {label}
            </text>
          </>
        )}
      </svg>
      {!label && !decorative && <span className="rhythm-icon__name">{name}</span>}
    </div>
  );
}
