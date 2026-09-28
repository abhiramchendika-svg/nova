import axe from 'axe-core';

/**
 * Run axe-core against a container and return serious/critical violations as readable strings.
 * Colour contrast is skipped because jsdom doesn't compute styles; contrast is verified
 * separately against the token values (docs/ui-design.md §2).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
