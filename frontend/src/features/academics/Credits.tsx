import { creditsWord, formatNumber } from './format';

/** "4 credits" with the number in tabular mono and the word in the UI face (ui-design.md §3). */
export function Credits({ value }: { value: number }) {
  return (
    <>
      <span className="font-mono tabular">{formatNumber(value)}</span> {creditsWord(value)}
    </>
  );
}
