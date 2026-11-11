import test from 'node:test';
import assert from 'node:assert/strict';
import { pickGame, planRound } from '../src/features/court-balancer/matchmaking.js';
import { matchKey, pairKey } from '../src/features/court-balancer/helpers.js';

const seeded = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// `tiers` is one [count, rating] per tier; ratings vary a little inside each tier
function makeState(tiers, random, courts = 4) {
  const ratings = tiers.flatMap(([count, base]) => Array.from({ length: count }, () => base + (random() * 2 - 1) * 30));
  return {
    settings: { balance_deadzone: 30 },
    players: ratings.map((elo, i) => ({ id: i + 1, elo, games: 0, consec: 0, status: 'normal', pendingRemove: false })),
    courts: Array.from({ length: courts }, (_, i) => ({ no: i + 1, game: null })),
    partnerHist: new Map(), matchHist: new Map(), recentMatches: [], lastPartner: new Map(),
  };
}
const CLUB = [[8, 1400], [4, 1250], [4, 1100]];
const idsOf = (games) => games.flatMap((g) => [...g.teamA, ...g.teamB]);
const gap = (state, g) => {
  const sum = (team) => team.reduce((total, id) => total + state.players.find((p) => p.id === id).elo, 0);
  return Math.abs(sum(g.teamA) - sum(g.teamB));
};
function finishRound(state, games) {
  const inc = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  for (const g of games) {
    for (const id of idsOf([g])) {
      const p = state.players.find((x) => x.id === id);
      p.games++; p.consec++;
    }
    inc(state.partnerHist, pairKey(...g.teamA));
    inc(state.partnerHist, pairKey(...g.teamB));
    inc(state.matchHist, matchKey(g.teamA, g.teamB));
    state.recentMatches.push(matchKey(g.teamA, g.teamB));
    for (const [x, y] of [g.teamA, g.teamB]) { state.lastPartner.set(x, y); state.lastPartner.set(y, x); }
  }
}

test('8 A, 4 B, 4 C on 4 courts: no court is left badly unbalanced', () => {
  for (let session = 0; session < 40; session++) {
    const random = seeded(session + 1);
    const state = makeState(CLUB, random);
    for (let round = 0; round < 8; round++) {
      const games = planRound(state, 4, random);
      assert.equal(games.length, 4);
      assert.equal(new Set(idsOf(games)).size, 16);
      for (const game of games) assert.ok(gap(state, game) < 150, `session ${session} round ${round}: gap ${gap(state, game)}`);
      finishRound(state, games);
    }
  }
});

test('the plan only rearranges the players the court-by-court rules chose', () => {
  const state = makeState([[8, 1400], [5, 1250], [5, 1100]], seeded(7));
  state.players.forEach((p, i) => { p.games = i % 3; });
  const reserved = new Set();
  const random = seeded(99);
  for (let i = 0; i < 4; i++) {
    const pick = pickGame(state, undefined, random, reserved);
    idsOf([pick]).forEach((id) => reserved.add(id));
  }
  const planned = idsOf(planRound(state, 4, seeded(99)));
  assert.deepEqual([...planned].sort((a, b) => a - b), [...reserved].sort((a, b) => a - b));
});

test('with more players than spots, nobody gets more than two games ahead over a session', () => {
  const random = seeded(3);
  const state = makeState([[8, 1400], [5, 1250], [5, 1100]], random);
  for (let round = 0; round < 12; round++) {
    finishRound(state, planRound(state, 4, random));
    const games = state.players.map((p) => p.games);
    assert.ok(Math.max(...games) - Math.min(...games) <= 2, games.join(','));
  }
});

test('a keen player gets a spot and, with balance equal, players on a streak sit out first', () => {
  const state = makeState([[18, 1250]], seeded(5));
  state.players.forEach((p) => { p.elo = 1250; });
  state.players[17].status = 'keen';
  state.players.slice(0, 2).forEach((p) => { p.consec = 3; });
  const planned = idsOf(planRound(state, 4, seeded(6)));
  assert.ok(planned.includes(18));
  assert.ok(!planned.includes(1) && !planned.includes(2));
});

test('one court plays exactly what pickGame would pick', () => {
  const state = makeState(CLUB, seeded(11));
  const { teamA, teamB } = pickGame(state, undefined, seeded(12));
  assert.deepEqual(planRound(state, 1, seeded(12)), [{ teamA, teamB }]);
});

test('fills only as many courts as there are players for', () => {
  const state = makeState([[3, 1400], [3, 1100]], seeded(13));
  assert.equal(planRound(state, 3, seeded(14)).length, 1);
  assert.deepEqual(planRound(makeState([[3, 1400]], seeded(15)), 2, seeded(16)), []);
  assert.deepEqual(planRound(state, 0, seeded(17)), []);
});

test('players on a break, leaving, or on court are not planned', () => {
  const state = makeState(CLUB, seeded(19));
  state.players[0].status = 'break';
  state.players[1].pendingRemove = true;
  state.courts[0].game = { teamA: [3, 4], teamB: [5, 6] };
  const planned = idsOf(planRound(state, 2, seeded(20)));
  for (const id of [1, 2, 3, 4, 5, 6]) assert.ok(!planned.includes(id));
});

test('the next round avoids repeating a match that was just played', () => {
  const random = seeded(23);
  const state = makeState(CLUB, random);
  for (let round = 0; round < 5; round++) {
    const games = planRound(state, 4, random);
    const recent = state.recentMatches.slice(-4);
    for (const game of games) assert.ok(!recent.includes(matchKey(game.teamA, game.teamB)));
    finishRound(state, games);
  }
});
