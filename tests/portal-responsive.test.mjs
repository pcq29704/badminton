import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app/ui.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

test('portal styles use only the three shared max-width breakpoints', () => {
  const widths = new Set([...css.matchAll(/@media \(max-width: (\d+)px\)/g)].map((match) => Number(match[1])));
  const allowed = new Set([360, 480, 720, 960]);
  for (const width of widths) assert.ok(allowed.has(width), `unexpected breakpoint ${width}px`);
});

test('touch screens get 44px targets and no sticky hover lift', () => {
  assert.match(css, /@media \(pointer: coarse\)[^{]*\{[^}]*min-height: 44px/);
  assert.match(css, /@media \(hover: none\)/);
});

test('viewport covers the safe areas', () => {
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(css, /env\(safe-area-inset-left\)/);
});
