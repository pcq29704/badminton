import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboard } from '../src/features/player-profile/dashboard.mjs';

const now = Date.parse('2026-10-21T12:00:00Z');
const me = { name: 'Me', username: 'me' };
const ann = { name: 'Ann', username: 'ann' };
const bob = { name: 'Bob', username: 'bob' };
const cy = { name: 'Cy', username: null };
const game = (daysAgo, team_a, team_b, winner) => ({ ended_at: new Date(now - daysAgo * 86400000).toISOString(), team_a, team_b, winner });

const history = [
  game(1, [me, ann], [bob, cy], 'A'),
  game(2, [bob, cy], [me, ann], 'B'),
  game(9, [me, bob], [ann, cy], 'B'),
  game(20, [ann, cy], [me, bob], 'A'),
];

test('counts wins, losses, win rate and streaks from the player side', () => {
  const stats = computeDashboard(history, 'ME', now);
  assert.equal(stats.played, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 2);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.deepEqual(stats.form, [true, true, false, false]);
});

test('ranks partners and picks the best one with at least two games', () => {
  const stats = computeDashboard(history, 'me', now);
  assert.equal(stats.partners[0].name, 'Ann');
  assert.equal(stats.bestPartner.name, 'Ann');
  assert.equal(stats.bestPartner.wins, 2);
  assert.equal(stats.opponents[0].games, 4);
});

test('buckets games into the last eight weeks, newest last', () => {
  const stats = computeDashboard(history, 'me', now);
  assert.equal(stats.weekly.length, 8);
  assert.deepEqual(stats.weekly.slice(-3), [1, 1, 2]);
});

test('empty and foreign histories give empty stats', () => {
  assert.equal(computeDashboard([], 'me', now).winRate, null);
  assert.equal(computeDashboard(history, 'nobody', now).played, 0);
});
