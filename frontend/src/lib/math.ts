/** Clamp a percentage into 0–100; NaN becomes 0 so a bad value never renders a broken bar. */
export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
