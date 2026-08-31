import { useState, useRef, useEffect } from "react";
import type { NotationBeat } from "../../utils/beats";
import { beatsHtml, FAMILY_LABEL } from "../../utils/notation";
import { buildJugglingLabUrl } from "../../utils/jugglinglab";
import "./NotationDisplay.css";

interface Props {
  halved: string;
  simplified: string;
  notationBeats?: NotationBeat[];
  family: string;
  balls: number;
  state: string;
}

export default function NotationDisplay({
  halved,
  simplified,
  notationBeats,
  family,
  balls,
  state,
}: Props) {
  const [showSimplified, setShowSimplified] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const jugglingLabUrl = buildJugglingLabUrl(simplified, family, balls);
  const stateLabel = state
    ? state.charAt(0).toUpperCase() + state.slice(1)
    : "";
  const infoLabel = `${balls}b · ${FAMILY_LABEL[family] ?? family}${stateLabel ? " · " + stateLabel : ""}`;

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyLabel("Copied!");
      copyTimerRef.current = setTimeout(() => setCopyLabel("Copy link"), 1500);
    });
  }

  return (
    <div className="notation-display">
      <div className="notation-display__info">{infoLabel}</div>

      <div className="notation-display__beats">
        <div
          className={`notation-display__beats-layer${!showSimplified ? " notation-display__beats-layer--active" : ""}`}
        >
          {notationBeats ? (
            beatsHtml(notationBeats, family)
          ) : (
            <div className="beat-cycle notation-display__text">{halved}</div>
          )}
        </div>
        <div
          className={`notation-display__beats-layer${showSimplified ? " notation-display__beats-layer--active" : ""}`}
        >
          <div className="beat-cycle notation-display__text">{simplified}</div>
        </div>
      </div>

      <div className="notation-display__tools">
        <a
          className="notation-display__tool-btn"
          href={jugglingLabUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          Open in JugglingLab
        </a>
        <button
          className={`notation-display__tool-btn${showSimplified ? " notation-display__tool-btn--active" : ""}`}
          onClick={() => setShowSimplified((s) => !s)}
        >
          Simplify
        </button>
        <button className="notation-display__tool-btn" onClick={handleCopy}>
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
