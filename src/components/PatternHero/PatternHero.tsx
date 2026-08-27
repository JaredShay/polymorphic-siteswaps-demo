import { useState, useEffect } from "react";
import type { Pattern } from "../../types";
import FingerprintCard from "../FingerprintCard/FingerprintCard";
import { buildJugglingLabUrl } from "../../utils/jugglinglab";
import "./PatternHero.css";

interface Props {
  activePattern: Pattern | null;
  generatedUrl?: string;
}

type HeroTab = "live" | "fingerprint";

export default function PatternHero({ activePattern, generatedUrl }: Props) {
  const [iframeReady, setIframeReady] = useState(false);
  const [tab, setTab] = useState<HeroTab>("live");

  const src = activePattern
    ? buildJugglingLabUrl(activePattern.simplified, activePattern.family, activePattern.balls)
    : generatedUrl ?? "";

  useEffect(() => {
    setIframeReady(false);
  }, [src]);

  const showFingerprint = !!activePattern;

  return (
    <div className="pattern-hero" data-tab={tab}>
      <nav className="pattern-hero__tabs" aria-label="Hero view">
        <button
          className={`pattern-hero__tab${tab === "live" ? " pattern-hero__tab--active" : ""}`}
          onClick={() => setTab("live")}
        >
          Live
        </button>
        {showFingerprint && (
          <button
            className={`pattern-hero__tab${tab === "fingerprint" ? " pattern-hero__tab--active" : ""}`}
            onClick={() => setTab("fingerprint")}
          >
            Pattern
          </button>
        )}
      </nav>

      <div className="pattern-hero__viewer">
        {!iframeReady && src && <span className="pattern-hero__status">Rendering…</span>}
        {src && (
          <iframe
            key={src}
            className="pattern-hero__iframe"
            src={src}
            title="Juggling pattern animation"
            onLoad={() => setIframeReady(true)}
            style={{ display: iframeReady ? "block" : "none" }}
          />
        )}
      </div>

      <div className="pattern-hero__fingerprint">
        {activePattern ? (
          <div className="pattern-hero__fingerprint-inner">
            <FingerprintCard
              uid={activePattern.id}
              rhythm={activePattern.rhythm}
              beats={activePattern.beats}
            />
          </div>
        ) : (
          <div className="pattern-hero__placeholder">
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={0.5} />
              <circle cx="80" cy="80" r="3" fill="rgba(255,255,255,.3)" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
