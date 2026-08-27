import type { Rhythm } from "../../types";
import { ringPathFromBeats } from "../../utils/geometry";
import "./RhythmIcon.css";

interface Props {
  rhythm: Rhythm;
  name: string;
  label: string;
}

const r = 52, cx = 64, cy = 64;

export default function RhythmIcon({ rhythm, name, label }: Props) {
  const { n, leftBeats, rightBeats } = rhythm;

  return (
    <div className="rhythm-icon">
      <svg viewBox="0 0 128 128" className="rhythm-icon__svg" aria-hidden="true">
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
      </svg>
      <span className="rhythm-icon__name">{name}</span>
      <span className="rhythm-icon__label">{label} · {n} beats</span>
    </div>
  );
}
