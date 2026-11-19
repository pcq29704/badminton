import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHonours, playerStats, rankingBoard } from '../src/features/stadium/honours.mjs';

const P = (name, elo, extra = {}) => ({ name, username: name.toLowerCase(), elo, tier: 'B', games_total: 0, profile_image_path: '', ...extra });
const ref = (player) => ({ name: player.name, username: player.username });

// A game at minute `t` (2026-11-01 10:00 + t minutes). `win` is the team that won.
let nextId = 1;
const game = (t, teamA, teamB, win = 'A') => ({
  id: nextId++,
  ended_at: new Date(Date.UTC(2026, 10, 1, 10, t)).toISOString(),
  winner: win,
  ranked: true,
  team_a: teamA.map(ref),
  team_b: teamB.map(ref),
});
// Games arrive newest first, as clubQuery returns them.
const newestFirst = (games) => [...games].sort((a, b) => b.ended_at.localeCompare(a.ended_at));
const byKey = (honours) => Object.fromEntries(honours.map((h) => [h.key, h]));

test('normal data: each honour goes to the right player with the right value', () => {
  const ann = P('Ann', 1500);
  const bob = P('Bob', 1400);
  const cy = P('Cy', 1300);
  const di = P('Di', 1200);
  const ranking = [ann, bob, cy, di];
  const games = [];
  // 12 games. Ann+Bob beat Cy+Di in games 0-7 (Bob plays all), then Cy+Di win 8-11.
  for (let t = 0; t < 8; t++) games.push(game(t, [ann, bob], [cy, di], 'A'));
  for (let t = 8; t < 12; t++) games.push(game(t, [ann, bob], [cy, di], 'B'));
  // Bob plays 2 more games and wins both (with Di).
  games.push(game(12, [bob, di], [ann, cy], 'A'));
  games.push(game(13, [bob, di], [ann, cy], 'A'));
  const h = byKey(computeHonours(newestFirst(games), ranking));

  assert.equal(h.crown.holder.username, 'ann');
  assert.equal(h.crown.stat, '1500 Elo');
  // Bob: 10 wins of 14. Ann: 8 of 14. Di: 6 of 14.
  assert.equal(h.conqueror.holder.username, 'bob');
  assert.equal(h.conqueror.stat, '10 wins');
  assert.equal(h.unbroken.holder.username, 'bob');
  assert.equal(h.unbroken.stat, '71% won · 10 of 14');
  // Ann and Bob both won 8 in a row (games 0-7). Tie: Ann has the higher Elo.
  assert.equal(h.relentless.holder.username, 'ann');
  assert.equal(h.relentless.value, 8);
  assert.equal(h.relentless.stat, '8 wins in a row');
  // Everyone played 14. Tie on games: highest Elo.
  assert.equal(h.stalwart.holder.username, 'ann');
  assert.equal(h.stalwart.stat, '14 games played');
  // Last 10 games (4-13): Bob 4+0+2 = 6, Di 0+4+2 = 6, Ann 4, Cy 4. Tie Bob/Di: Bob has the higher Elo.
  assert.equal(h.rising.holder.username, 'bob');
  assert.equal(h.rising.stat, '6 wins in the last 10');
});

test('ties: equal score and equal Elo fall back to the name in alphabetical order', () => {
  const zed = P('Zed', 1300);
  const amy = P('Amy', 1300);
  const x = P('Xu', 1000);
  const y = P('Yan', 1000);
  // Zed and Amy each win one game against Xu and Yan.
  const games = [game(0, [zed, x], [amy, y], 'A'), game(1, [zed, x], [amy, y], 'B')];
  const h = byKey(computeHonours(newestFirst(games), [zed, amy, x, y]));
  assert.equal(h.crown.holder.username, 'amy'); // 1300 = 1300, "Amy" < "Zed"
  assert.equal(h.conqueror.holder.username, 'amy'); // 1 win each, Elo tie, name
  assert.equal(h.stalwart.holder.username, 'amy');
});

test('below the minimum: the honour stays on the wall as "Unclaimed"', () => {
  const ann = P('Ann', 1500);
  const bob = P('Bob', 1400);
  // 4 games each: below 10 (win rate) and below 5 (form). Best streak 2: below 3.
  const games = [
    game(0, [ann], [bob], 'A'),
    game(1, [ann], [bob], 'A'),
    game(2, [ann], [bob], 'B'),
    game(3, [ann], [bob], 'B'),
  ];
  const h = byKey(computeHonours(newestFirst(games), [ann, bob]));
  for (const key of ['unbroken', 'relentless', 'rising']) {
    assert.equal(h[key].holder, null, key);
    assert.equal(h[key].value, null, key);
    assert.equal(h[key].stat, 'Unclaimed', key);
  }
  assert.equal(h.crown.holder.username, 'ann');
  assert.equal(h.conqueror.holder.username, 'ann'); // 2 wins each, Ann has the higher Elo
});

test('empty club: all six honours are "Unclaimed", in order, and nothing throws', () => {
  for (const [games, ranking] of [[[], []], [undefined, undefined], [null, null]]) {
    const honours = computeHonours(games, ranking);
    assert.deepEqual(honours.map((h) => h.key), ['crown', 'conqueror', 'unbroken', 'relentless', 'stalwart', 'rising']);
    assert.ok(honours.every((h) => h.holder === null && h.stat === 'Unclaimed'));
  }
  // Players but no games: even The Crown needs 1 game.
  const h = byKey(computeHonours([], [P('Ann', 1500)]));
  assert.equal(h.crown.holder, null);
});

test('a win streak that runs up to the latest game counts', () => {
  const ann = P('Ann', 1200);
  const bob = P('Bob', 1500);
  const games = [
    game(0, [ann], [bob], 'B'),
    game(1, [ann], [bob], 'A'),
    game(2, [ann], [bob], 'B'),
    game(3, [ann], [bob], 'A'),
    game(4, [ann], [bob], 'A'),
    game(5, [ann], [bob], 'A'),
    game(6, [ann], [bob], 'A'), // latest game: the streak is still running (4)
  ];
  const h = byKey(computeHonours(newestFirst(games), [ann, bob]));
  assert.equal(h.relentless.holder.username, 'ann');
  assert.equal(h.relentless.value, 4);
  assert.equal(h.relentless.stat, '4 wins in a row');
});

test('streaks follow play order even when the input is not sorted', () => {
  const ann = P('Ann', 1200);
  const bob = P('Bob', 1100);
  const games = [game(0, [ann], [bob], 'A'), game(1, [ann], [bob], 'B'), game(2, [ann], [bob], 'A'), game(3, [ann], [bob], 'A'), game(4, [ann], [bob], 'A')];
  const shuffled = [games[2], games[0], games[4], games[1], games[3]];
  const ann1 = playerStats(shuffled, [ann, bob]).find((s) => s.player.username === 'ann');
  assert.equal(ann1.bestStreak, 3);
  assert.equal(ann1.played, 5);
  assert.equal(ann1.wins, 4);
});

test('players outside the ranking and games without a winner are ignored', () => {
  const ann = P('Ann', 1200);
  const ghost = { name: 'Ghost', username: 'ghost' }; // not active, not in the ranking
  const games = [game(0, [ghost], [ann], 'A'), game(1, [ghost], [ann], 'A'), { ...game(2, [ann], [ghost], 'A'), winner: null }];
  const h = byKey(computeHonours(newestFirst(games), [ann]));
  assert.equal(h.conqueror.holder, null);
  assert.equal(h.stalwart.holder.username, 'ann');
  assert.equal(h.stalwart.stat, '2 games played');
});

test('players without a username match by name and keep an empty username', () => {
  const nam = { name: 'Nam', username: '', elo: 1300, tier: 'B' };
  const games = [game(0, [{ name: 'Nam', username: '' }], [P('Bo', 1000)], 'A')];
  const h = byKey(computeHonours(games, [nam]));
  assert.equal(h.conqueror.holder.name, 'Nam');
  assert.equal(h.conqueror.holder.username, '');
});

test('form counts only the last 10 games and needs at least 5', () => {
  const ann = P('Ann', 1200);
  const bob = P('Bob', 1100);
  const games = [];
  for (let t = 0; t < 5; t++) games.push(game(t, [ann], [bob], 'A')); // 5 old wins
  for (let t = 5; t < 15; t++) games.push(game(t, [ann], [bob], t % 2 ? 'A' : 'B')); // last 10: 5-5
  const s = playerStats(games, [ann, bob]).find((e) => e.player.username === 'ann');
  assert.equal(s.formGames, 10);
  assert.equal(s.formWins, 5);
});

test('ranking board: top 10 in ranking order, "You" row only when outside the top 10', () => {
  const ranking = Array.from({ length: 14 }, (_, i) => P(`P${String(i + 1).padStart(2, '0')}`, 2000 - i * 10));
  const out = rankingBoard(ranking, { username: 'p12' });
  assert.equal(out.rows.length, 10);
  assert.deepEqual(out.rows.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(out.rows.every((r) => !r.me));
  assert.equal(out.you.username, 'p12');
  assert.equal(out.you.position, 12);

  const inside = rankingBoard(ranking, { username: 'p03' });
  assert.equal(inside.you, null);
  assert.deepEqual(inside.rows.filter((r) => r.me).map((r) => r.position), [3]);

  assert.equal(rankingBoard(ranking, { role: 'organiser', username: '' }).you, null);
  assert.equal(rankingBoard(ranking, null).you, null);
  assert.deepEqual(rankingBoard([], { username: 'x' }), { rows: [], you: null });
  assert.deepEqual(rankingBoard(undefined, null), { rows: [], you: null });
});
