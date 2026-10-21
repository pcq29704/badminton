import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGamesByDay, isDayKey } from '../src/features/dashboard/days.mjs';
import { gamesResponse, rankingResponse } from '../src/lib/player-api/logic.mjs';

const p = (name, username = '') => ({ name, username });
const at = (day, hour, extra = {}) => ({ id: day * 100 + hour, ended_at: new Date(2026, 9, day, hour).toISOString(), winner: 'A', ranked: true, court_no: 1, team_a: [p('Ann', 'ann'), p('Bob')], team_b: [p('Cy'), p('Di')], ...extra });

test('groups all finished games by local day, newest day first, games in play order', () => {
  const days = groupGamesByDay([at(20, 19), at(18, 10), at(20, 9, { ranked: false }), { id: 1, ended_at: null }]);
  assert.deepEqual(days.map((day) => day.key), ['2026-10-20', '2026-10-18']);
  assert.deepEqual(days[0].games.map((game) => game.id), [2009, 2019]);
  assert.equal(days[0].playerCount, 4);
  assert.equal(days[0].rankedCount, 1);
});

test('validates the day key used in the URL', () => {
  assert.ok(isDayKey('2026-10-20'));
  assert.ok(!isDayKey('../etc'));
});

test('gamesResponse exposes only names, usernames, court and result', () => {
  const [game] = gamesResponse([{
    id: 7, ended_at: '2026-10-20T10:00:00Z', winner: 'B', ranked: true, status: 'finished', session_id: 3,
    courts: { court_no: 2 },
    game_players: [
      { team: 'A', elo_before: 1200, players: { name: 'Ann', username: 'ann', password: 'x' } },
      { team: 'B', players: { name: 'Bob', username: null } },
    ],
  }, { id: 8, ended_at: null }]);
  assert.deepEqual(game, { id: 7, ended_at: '2026-10-20T10:00:00Z', winner: 'B', ranked: true, court_no: 2,
    team_a: [{ name: 'Ann', username: 'ann' }], team_b: [{ name: 'Bob', username: '' }] });
});
