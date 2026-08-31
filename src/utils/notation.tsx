import type { NotationBeat } from "./beats";

export const FAMILY_LABEL: Record<string, string> = {
  "3over2": "3 / 2",
  "3over2_2cycle": "3 / 2 · 2 cycle",
  "4over3": "4 / 3",
  "4over3_2cycle": "4 / 3 · 2 cycle",
  "5over2": "5 / 2",
  "5over3": "5 / 3",
  "5over4": "5 / 4",
  "332": "332",
  "332_2cycle": "332 · 2 cycle",
  clave: "Clave",
};

export function siteswapLabel(n: number): string {
  return n < 10 ? String(n) : String.fromCharCode(97 + n - 10);
}

export function beatHtml(b: NotationBeat) {
  const bang = b.suppressed ? <span className="b-rest">!</span> : null;

  if (b.kind === "rest") {
    return <span className="b-rest">(0,0)!</span>;
  }
  if (b.kind === "zero") {
    return <span className="b-zero">(0,0)!</span>;
  }
  if (b.kind === "sync") {
    return (
      <>
        <span className="bb-sync">
          <span className="b-paren">(</span>
          <span className="bb-l b-l">{b.leftLabel}</span>
          <span className="b-sep">,</span>
          <span className="bb-r b-r">{b.rightLabel}</span>
          <span className="b-paren">)</span>
        </span>
        {bang}
      </>
    );
  }
  if (b.kind === "left") {
    return (
      <>
        <span className="bb-l">
          <span className="b-paren">(</span>
          <span className="b-l">{b.leftLabel}</span>
          <span className="b-sep">,</span>
          <span className="b-zero">0</span>
          <span className="b-paren">)</span>
        </span>
        {bang}
      </>
    );
  }
  // right
  return (
    <>
      <span className="bb-r">
        <span className="b-paren">(</span>
        <span className="b-zero">0</span>
        <span className="b-sep">,</span>
        <span className="b-r">{b.rightLabel}</span>
        <span className="b-paren">)</span>
      </span>
      {bang}
    </>
  );
}

export function beatsHtml(beats: NotationBeat[], family: string) {
  const is2cycle = family.endsWith("_2cycle");
  const cycleLen = is2cycle ? Math.round(beats.length / 2) : beats.length;
  const cycles: NotationBeat[][] = [];
  for (let i = 0; i < beats.length; i += cycleLen) {
    cycles.push(beats.slice(i, i + cycleLen));
  }
  return (
    <div className="pattern-beats">
      {cycles.map((cycle, ci) => (
        <div key={ci} className="beat-cycle">
          {cycle.map((b, bi) => (
            <span key={bi}>{beatHtml(b)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
