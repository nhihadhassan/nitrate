import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const orchestratorSource = readFileSync(
  new URL('../components/motion/motion-orchestrator.tsx', import.meta.url),
  'utf8',
);
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('progressive collection reveals', () => {
  it('keeps server-rendered collections visible until motion is ready', () => {
    expect(globalStyles).toContain('[data-motion-ready] [data-reveal] {');
    expect(globalStyles).toContain('[data-motion-ready] .poster-grid[data-reveal] > * {');
    expect(globalStyles).not.toMatch(/(?:^|\n)\[data-reveal\]\s*\{\s*\n\s*opacity:\s*0/);
    expect(globalStyles).not.toMatch(
      /(?:^|\n)\.poster-grid\[data-reveal\]\s*>\s*\*\s*\{\s*\n\s*opacity:\s*0/,
    );
  });

  it('retains the observer that completes collection reveals', () => {
    expect(orchestratorSource).toContain('new IntersectionObserver');
    expect(orchestratorSource).toContain("root.dataset.motionReady = 'true'");
    expect(orchestratorSource).toContain("querySelectorAll<HTMLElement>('[data-reveal]')");
  });
});
