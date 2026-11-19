import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboard, rivalryStatus } from '../src/features/player-profile/dashboard.mjs';

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

test('rivals count wins and losses against each opponent and label the rivalry from 3 games', () => {
  const stats = computeDashboard(history, 'me', now);
  const cyRow = stats.rivals.find((rival) => rival.name === 'Cy');
  assert.deepEqual([cyRow.games, cyRow.wins, cyRow.losses, cyRow.status], [4, 2, 2, 'even']);
  const bobRow = stats.rivals.find((rival) => rival.name === 'Bob');
  assert.deepEqual([bobRow.games, bobRow.wins, bobRow.status], [2, 2, null]);
});

test('rivalry status: victim or nemesis from a 2-game lead, even otherwise, null under 3 games', () => {
  assert.equal(rivalryStatus({ games: 2, wins: 2, losses: 0 }), null);
  assert.equal(rivalryStatus({ games: 3, wins: 3, losses: 0 }), 'victim');
  assert.equal(rivalryStatus({ games: 4, wins: 1, losses: 3 }), 'nemesis');
  assert.equal(rivalryStatus({ games: 3, wins: 2, losses: 1 }), 'even');
  assert.equal(rivalryStatus({ games: 4, wins: 2, losses: 2 }), 'even');
});

test('duos need 3 games together; worst only shows when it differs from best', () => {
  const few = computeDashboard(history, 'me', now);
  assert.equal(few.duos.best, null);
  const games = [
    game(1, [me, ann], [bob, cy], 'A'), game(2, [me, ann], [bob, cy], 'A'), game(3, [me, ann], [bob, cy], 'B'),
    game(4, [me, bob], [ann, cy], 'B'), game(5, [me, bob], [ann, cy], 'B'), game(6, [me, bob], [ann, cy], 'A'),
  ];
  const stats = computeDashboard(games, 'me', now);
  assert.equal(stats.duos.best.name, 'Ann');
  assert.equal(stats.duos.worst.name, 'Bob');
  const one = computeDashboard(games.slice(0, 3), 'me', now);
  assert.equal(one.duos.best.name, 'Ann');
  assert.equal(one.duos.worst, null);
});

const scored = (daysAgo, a, b, winner, score_a, score_b, elo = {}) => ({
  ...game(daysAgo, a, b, winner), score_a, score_b,
});

test('win quality averages margins and counts close games and blowouts', () => {
  const games = [
    scored(1, [me, ann], [bob, cy], 'A', 21, 19),
    scored(2, [me, ann], [bob, cy], 'A', 21, 9),
    scored(3, [me, ann], [bob, cy], 'B', 15, 21),
    scored(4, [me, ann], [bob, cy], 'B', 20, 22),
    game(5, [me, ann], [bob, cy], 'A'),
  ];
  const q = computeDashboard(games, 'me', now).quality;
  assert.equal(q.scored, 4);
  assert.equal(q.avgWinMargin, 7);
  assert.equal(q.avgLossMargin, 4);
  assert.equal(q.closeWins, 1);
  assert.equal(q.closeLosses, 1);
  assert.equal(q.blowoutWins, 1);
  assert.equal(q.blowoutLosses, 0);
  assert.equal(computeDashboard(history, 'me', now).quality, null);
});

const rated = (daysAgo, winner, before, after, theirElo = 1200) => {
  const a = [{ ...me, elo_before: before, elo_after: after }, { ...ann, elo_before: before, elo_after: after }];
  const b = [{ ...bob, elo_before: theirElo, elo_after: theirElo }, { ...cy, elo_before: theirElo, elo_after: theirElo }];
  return game(daysAgo, a, b, winner);
};

test('elo journey runs oldest first with the starting rating, peak and biggest gain', () => {
  const games = [rated(1, 'B', 1230, 1215), rated(2, 'A', 1200, 1230), rated(3, 'A', 1190, 1200)];
  const stats = computeDashboard(games, 'me', now);
  assert.deepEqual(stats.eloSeries.map((point) => point.elo), [1190, 1200, 1230, 1215]);
  assert.equal(stats.eloSeries[0].start, true);
  assert.equal(stats.peakElo, 1230);
  assert.equal(stats.records.biggestGain.change, 30);
  assert.equal(computeDashboard(history, 'me', now).eloSeries.length, 0);
});

test('giant slayer counts games against a higher-rated team', () => {
  const games = [rated(1, 'A', 1200, 1210, 1300), rated(2, 'B', 1210, 1200, 1300), rated(3, 'A', 1200, 1210, 1100)];
  assert.deepEqual(computeDashboard(games, 'me', now).giantSlayer, { games: 2, wins: 1 });
  assert.equal(computeDashboard(history, 'me', now).giantSlayer, null);
});

test('recent form keeps the score from the player side and the opponents', () => {
  const games = [scored(1, [bob, cy], [me, ann], 'B', 12, 21)];
  const [recent] = computeDashboard(games, 'me', now).recent;
  assert.deepEqual(recent.score, { mine: 21, theirs: 12 });
  assert.deepEqual(recent.against, ['Bob', 'Cy']);
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
