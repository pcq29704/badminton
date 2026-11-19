import test from 'node:test';
import assert from 'node:assert/strict';
import { rankProgress } from '../src/lib/tier-bands.js';

test('rank progress shows Elo left and percent to the next tier', () => {
  assert.deepEqual(rankProgress(1250, 'B'), { next: 'A', needed: 75, pct: 50 });
  assert.equal(rankProgress(1500, 'S'), null);
  assert.equal(rankProgress('x', 'B'), null);
  assert.equal(rankProgress(1000, 'D').next, 'C');
});
