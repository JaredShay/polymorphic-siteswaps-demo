import { useState, useEffect } from "react";
import type { Pattern } from "../../types";
import type { GeneratorStatus } from "../../hooks/useGenerator";
import "./PatternQueue.css";

interface Props {
  patterns: Pattern[];
  primaryIndex: number;
  status: GeneratorStatus;
  canGoBack: boolean;
  canGoForward: boolean;
  onSelect: (index: number) => void;
  onBack: () => void;
  onForward: () => void;
}

function colorizeHalved(halved: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const re = /\(([^,]+),([^)]+)\)(!?)/g;
  let i = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(halved)) !== null) {
    const L = match[1];
    const R = match[2];
    const bang = match[3];

    nodes.push(
      <span key={`${i}op`} className="b-paren">
        (
      </span>,
      L === "0" ? (
        <span key={`${i}l`} className="b-zero">
          {L}
        </span>
      ) : (
        <span key={`${i}l`} className="b-l">
          {L}
        </span>
      ),
      <span key={`${i}s`} className="b-sep">
        ,
      </span>,
      R === "0" ? (
        <span key={`${i}r`} className="b-zero">
          {R}
        </span>
      ) : (
        <span key={`${i}r`} className="b-r">
          {R}
        </span>
      ),
      <span key={`${i}cp`} className="b-paren">
        )
      </span>,
    );
    if (bang) {
      nodes.push(
        <span key={`${i}b`} className="b-rest">
          !
        </span>,
      );
    }
    i++;
  }

  return <>{nodes}</>;
}

export default function PatternQueue({
  patterns,
  primaryIndex,
  status,
  canGoBack,
  canGoForward,
  onSelect,
  onBack,
  onForward,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const firstId = patterns[0]?.id;
  useEffect(() => {
    setExpanded(false);
  }, [firstId]);

  const isGenerating = status === "generating";
  const activePattern = patterns[primaryIndex];
  const canExpand = patterns.length > 1;

  return (
    <div className="pattern-queue">
      {(canGoBack || canGoForward) && (
        <div className="pattern-queue__session-nav">
          <button
            className="pattern-queue__session-btn"
            onClick={onBack}
            disabled={!canGoBack}
          >
            ← Earlier
          </button>
          <button
            className="pattern-queue__session-btn"
            onClick={onForward}
            disabled={!canGoForward}
          >
            Later →
          </button>
        </div>
      )}

      {expanded ? (
        <>
          <ul className="pattern-queue__list">
            {patterns.map((pattern, i) => (
              <li
                key={pattern.id}
                className={`pattern-queue__item${i === primaryIndex ? " pattern-queue__item--active" : ""}`}
                onClick={() => i !== primaryIndex && onSelect(i)}
              >
                <span className="pattern-queue__notation">
                  {colorizeHalved(pattern.halved)}
                </span>
              </li>
            ))}
            {isGenerating && (
              <li className="pattern-queue__loading">Finding patterns…</li>
            )}
          </ul>
          <button
            className="pattern-queue__collapse"
            onClick={() => setExpanded(false)}
          >
            Hide ↑
          </button>
        </>
      ) : activePattern ? (
        <button
          className={`pattern-queue__head${canExpand ? " pattern-queue__head--expandable" : ""}`}
          onClick={() => canExpand && setExpanded(true)}
        >
          <span className="pattern-queue__notation">
            {colorizeHalved(activePattern.halved)}
          </span>
          {canExpand && <span className="pattern-queue__chevron">↓</span>}
        </button>
      ) : isGenerating ? (
        <div className="pattern-queue__loading">Finding patterns…</div>
      ) : null}
    </div>
  );
}
