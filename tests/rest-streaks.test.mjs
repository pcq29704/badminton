import test from 'node:test';
import assert from 'node:assert/strict';
import { playRuns } from '../src/features/court-balancer/helpers.js';

const player = (id, consec, status = 'normal') => ({ id, consec, status });

test('shows who has played longest, from 3 in a row', () => {
  const runs = playRuns([player(1, 5), player(2, 3), player(3, 2), player(4, 0)], new Set());
  assert.deepEqual([...runs], [[1, 5], [2, 3]]);
});

test('hidden when everyone available is level', () => {
  const players = [player(1, 4), player(2, 4), player(3, 4)];
  assert.equal(playRuns(players, new Set()).size, 0);
  assert.equal(playRuns([...players, player(4, 0, 'break')], new Set()).size, 0);
});

test('the game in progress counts, so courts finishing at different times stay level', () => {
  const finished = [player(1, 5), player(2, 5)];
  const stillPlaying = [player(3, 4), player(4, 4)];
  assert.equal(playRuns([...finished, ...stillPlaying], new Set([3, 4])).size, 0);
});

test('a player on a break never shows a count', () => {
  const runs = playRuns([player(1, 6, 'break'), player(2, 4), player(3, 0)], new Set());
  assert.deepEqual([...runs], [[2, 4]]);
});
