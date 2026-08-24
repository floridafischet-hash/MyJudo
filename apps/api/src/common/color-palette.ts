export const CALENDAR_COLOR_PALETTE: readonly string[] = [
  '#E53935',
  '#D81B60',
  '#8E24AA',
  '#5E35B1',
  '#3949AB',
  '#1E88E5',
  '#00897B',
  '#43A047',
  '#C0CA33',
  '#FB8C00',
  '#6D4C41',
  '#546E7A',
];

/** Deterministic fallback color for entities without an explicitly chosen one. */
export function autoColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CALENDAR_COLOR_PALETTE[hash % CALENDAR_COLOR_PALETTE.length]!;
}
