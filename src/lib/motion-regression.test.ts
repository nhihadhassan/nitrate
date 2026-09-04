import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const orchestratorSource = readFileSync(
  new URL('../components/motion/motion-orchestrator.tsx', import.meta.url),
  'utf8',
);
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('progressive collection reveals', () => {
  it('never hides server-rendered collections behind reveal state', () => {
    expect(globalStyles).not.toMatch(/(?:^|\n)\[data-reveal\]\s*\{\s*\n\s*opacity:\s*0/);
    expect(globalStyles).not.toMatch(
      /(?:^|\n)\.poster-grid\[data-reveal\]\s*>\s*\*\s*\{\s*\n\s*opacity:\s*0/,
    );
    expect(globalStyles).not.toContain('[data-motion-ready]');
  });

  it('does not mutate server-rendered collection classes after hydration', () => {
    expect(orchestratorSource).not.toContain('new IntersectionObserver');
    expect(orchestratorSource).not.toContain('is-revealed');
    expect(orchestratorSource).not.toContain('motionReady');
  });
});
