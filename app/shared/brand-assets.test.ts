import { describe, expect, it } from 'vitest';
import { createBrandFavicon } from './brand-assets';

describe('single-source brand assets', () => {
  it.each(['#dc2626', '#2563eb', 'blue', 'oklch(0.577 0.245 27.325)'])(
    'propagates %s into both colored parts of the favicon',
    (color) => {
      const svg = createBrandFavicon(
        `:root { --brand-primary: ${color}; --primary: var(--brand-primary); }`,
      );
      expect(svg).toContain(`fill="${color}">Swift`);
      expect(svg).toContain(`fill="${color}">.`);
      expect(svg).toContain('fill="#000">Drop');
    },
  );
  it.each([
    ':root { --primary: red; }',
    ':root { --brand-primary: var(--primary); }',
    ':root { --brand-primary: " onload="alert(1); }',
  ])('rejects a missing, unresolved or unsafe asset color', (stylesheet) => {
    expect(() => createBrandFavicon(stylesheet)).toThrow('concrete CSS color');
  });
});
