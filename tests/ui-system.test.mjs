// Guards for the design rules in DESIGN.md. They check the new system (src/app/ui.css, src/components/ui)
// and the code that every screen shares, so a later change cannot quietly break a rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RANK_NAMES } from '../src/lib/rank-names.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const css = read('src/app/ui.css');
const layout = read('src/app/layout.tsx');

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(jsx?|tsx?|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

test('ui.css uses only the allowed corner radii (0, 2px, round)', () => {
  const values = [...css.matchAll(/border-radius:\s*([^;}]+)/g)].map((match) => match[1].trim());
  for (const value of values) assert.ok(['0', '2px', '50%', '9999px'].includes(value), `radius ${value} is not allowed`);
});

test('ui.css uses only the shared breakpoints', () => {
  const widths = [...css.matchAll(/@media \(max-width: (\d+)px\)/g)].map((match) => Number(match[1]));
  for (const width of widths) assert.ok([360, 480, 720, 960].includes(width), `unexpected breakpoint ${width}px`);
});

test('ui.css has no gradient text', () => {
  assert.doesNotMatch(css, /background-clip:\s*text/);
});

test('ui.css switches motion off for reduced motion and gives touch screens 44px targets', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(pointer: coarse\)[^{]*\{[^}]*min-height: 44px/);
});

test('cards and buttons have no drop shadow', () => {
  for (const selector of ['.cb-card', '.cb-btn']) {
    const rule = css.match(new RegExp(`\\n\\${selector} \\{([^}]*)\\}`));
    assert.ok(rule, `${selector} rule exists`);
    assert.doesNotMatch(rule[1], /box-shadow/, `${selector} has a box-shadow`);
  }
});

test('rank names are not typed into components', () => {
  const files = [...sourceFiles(new URL('src/components', root).pathname), ...sourceFiles(new URL('src/features', root).pathname)];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const name of Object.values(RANK_NAMES)) assert.ok(!text.includes(name), `${file} hardcodes the rank name "${name}"`);
  }
});

test('the avatar fallback shows initials, not an emoji', () => {
  const avatar = read('src/components/PlayerAvatar.jsx');
  assert.doesNotMatch(avatar, /\p{Extended_Pictographic}/u);
  assert.match(avatar, /initials\(name\)/);
});

test('the new fonts load with Vietnamese letters', () => {
  for (const font of ['Cormorant_SC', 'Be_Vietnam_Pro']) {
    assert.match(layout, new RegExp(`${font}\\(\\{[^}]*"vietnamese"`), `${font} loads the vietnamese subset`);
  }
});
