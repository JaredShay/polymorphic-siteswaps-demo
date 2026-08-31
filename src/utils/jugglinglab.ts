import { RING_RIGHT, RING_LEFT } from "./geometry";

export const BPS_BY_FAMILY: Record<string, number> = {
  "3over2": 5,
  "3over2_2cycle": 5,
  "4over3": 7.5,
  "4over3_2cycle": 7.5,
  "5over2": 5,
  "5over3": 7.5,
  "5over4": 10,
  "332": 5,
  "332_2cycle": 5,
  clave: 5,
};

function hexToJlColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `{${r},${g},${b}}`;
}

function buildColorsParam(balls: number): string {
  const a = hexToJlColor(RING_RIGHT);
  const b = hexToJlColor(RING_LEFT);
  return Array.from({ length: balls }, (_, i) => (i % 2 === 0 ? a : b)).join(
    "",
  );
}

export function buildJugglingLabUrl(
  simplified: string,
  family: string,
  balls: number,
): string {
  const bps = BPS_BY_FAMILY[family] ?? 5;
  const colors = buildColorsParam(balls);
  return `https://jugglinglab.org/anim?pattern=${encodeURIComponent(simplified)};bps=${bps};dwell=1.5;colors=${colors};fps=50`;
}
