import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eloChanges, formatDelta, formatScore, isValidScore, movMultiplier, parseScore, resultLabel, scoreProblem,
} from '../src/features/court-balancer/scoring.mjs';

const settings = { target_points: 21, cap_points: 30, mov_min: 0.75, mov_max: 2.0, k_provisional: 40, k_established: 24, provisional_games: 10 };
const round2 = (x) => Math.round(x * 100) / 100;

test('valid and invalid scores at every boundary', () => {
  const valid = [[21, 19], [22, 20], [29, 27], [30, 29], [19, 21], [21, 0], [30, 28], [24, 22]];
  const invalid = [[21, 20], [23, 20], [21, 21], [31, 29], [25, 10], [18, 12], [0, 0], [22, 19], [30, 27], [29, 28]];
  for (const [a, b] of valid) assert.equal(isValidScore(a, b, settings), true, `${a}-${b} should be valid`);
  for (const [a, b] of invalid) assert.equal(isValidScore(a, b, settings), false, `${a}-${b} should be invalid`);
});

test('invalid scores explain what is wrong', () => {
  assert.equal(scoreProblem(21, 20, settings), 'At 20-all a team needs a 2-point lead');
  assert.equal(scoreProblem(25, 10, settings), "A game ends at 21 unless it's 20-all");
  assert.equal(scoreProblem(15, 15, settings), "Scores can't be tied");
  assert.equal(scoreProblem(18, 12, settings), 'A game ends when a team reaches 21');
  assert.equal(scoreProblem(31, 29, settings), 'Scores must be between 0 and 30');
  assert.equal(scoreProblem(23, 20, settings), 'After 20-all the game ends as soon as a team leads by 2');
  assert.equal(scoreProblem(null, 15, settings), 'Enter a whole number from 0 to 30 for each team');
});

test('score boxes only accept whole numbers', () => {
  assert.equal(parseScore('21'), 21);
  assert.equal(parseScore(' 0 '), 0);
  for (const text of ['', '1.5', '-3', 'abc', '2e1', '1,5']) assert.equal(parseScore(text), null, text);
});

test('the rules follow target and cap settings (15-point games)', () => {
  const short = { ...settings, target_points: 15, cap_points: 21 };
  assert.equal(isValidScore(15, 13, short), true);
  assert.equal(isValidScore(15, 14, short), false);
  assert.equal(isValidScore(21, 20, short), true);
  assert.equal(isValidScore(21, 19, short), true);
  assert.equal(isValidScore(21, 15, short), false);
});

test('margin multiplier and Elo change for balanced teams (K = 24)', () => {
  const rows = [[30, 29, 0.810, 9.71], [21, 19, 0.869, 10.43], [22, 20, 0.869, 10.43],
    [21, 15, 1.107, 13.29], [21, 10, 1.405, 16.86], [21, 0, 2.000, 24.00]];
  const team = (id) => [{ id, elo: 1250, k: 24 }, { id: id + 1, elo: 1250, k: 24 }];
  for (const [a, b, m, change] of rows) {
    assert.equal(Math.round(movMultiplier(a, b, settings) * 1000) / 1000, m, `M for ${a}-${b}`);
    const result = eloChanges(team(1), team(3), a, b, settings);
    assert.equal(result.winner, 'A');
    assert.deepEqual(result.teamA.map((p) => p.delta), [change, change], `${a}-${b}`);
    assert.deepEqual(result.teamB.map((p) => p.delta), [-change, -change], `${a}-${b}`);
  }
});

test('Elo change when team A is 100 higher (E_A = 0.640)', () => {
  const A = [{ id: 1, elo: 1300, k: 24 }, { id: 2, elo: 1300, k: 24 }];
  const B = [{ id: 3, elo: 1200, k: 24 }, { id: 4, elo: 1200, k: 24 }];
  const favourite = eloChanges(A, B, 21, 19, settings);
  assert.equal(round2(favourite.expectedA), 0.64);
  assert.deepEqual(favourite.teamA.map((p) => p.delta), [7.51, 7.51]);
  assert.deepEqual(favourite.teamB.map((p) => p.delta), [-7.51, -7.51]);
  const underdog = eloChanges(A, B, 10, 21, settings);
  assert.equal(underdog.winner, 'B');
  assert.deepEqual(underdog.teamB.map((p) => p.delta), [21.58, 21.58]);
  assert.deepEqual(underdog.teamA.map((p) => p.delta), [-21.58, -21.58]);
});

test('a winner always gains, even a big favourite winning narrowly', () => {
  const A = [{ id: 1, elo: 1600, k: 24 }, { id: 2, elo: 1600, k: 24 }];
  const B = [{ id: 3, elo: 1000, k: 24 }, { id: 4, elo: 1000, k: 24 }];
  const result = eloChanges(A, B, 30, 29, settings);
  assert.ok(result.teamA.every((p) => p.delta >= 0));
});

test('each player uses their own K', () => {
  const A = [{ id: 1, elo: 1250, k: 40 }, { id: 2, elo: 1250, k: 24 }];
  const B = [{ id: 3, elo: 1250, k: 24 }, { id: 4, elo: 1250, k: 24 }];
  assert.deepEqual(eloChanges(A, B, 21, 15, settings).teamA.map((p) => p.delta), [22.14, 13.29]);
});

test('result labels and formatting are display only', () => {
  assert.equal(resultLabel(21, 17), 'Close game');
  assert.equal(resultLabel(22, 20), 'Close game');
  assert.equal(resultLabel(21, 16), 'Solid win');
  assert.equal(resultLabel(21, 11), 'Solid win');
  assert.equal(resultLabel(21, 10), 'Dominant win');
  assert.equal(resultLabel(null, null), '');
  assert.equal(formatScore(21, 15), '21–15');
  assert.equal(formatScore(null, null), '');
  assert.equal(formatDelta(13.29), '+13.3');
  assert.equal(formatDelta(-7.51), '−7.5');
});
