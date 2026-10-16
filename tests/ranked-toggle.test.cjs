const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function appFixture() {
  const root = { innerHTML: '', className: '' };
  const session = { id: 1, rank_new_games: false };
  const games = new Map();
  let nextGameId = 1;
  const db = {
    auth: { onAuthStateChange() {}, async getSession() { return { data: { session: null } }; } },
    from(table) {
      if (table === 'sessions') return {
        update(values) { return { eq() {
          Object.assign(session, values);
          return Promise.resolve({ data: [session], error: null });
        } }; },
      };
      if (table === 'games') return {
        select() { return { eq(_column, id) { return { single() {
          return Promise.resolve({ data: games.get(id), error: null });
        } }; } }; },
      };
      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name, args) {
      if (name === 'start_game') {
        const id = nextGameId++;
        games.set(id, { id, ranked: session.rank_new_games });
        return { data: id, error: null };
      }
      if (name === 'finish_game') {
        const game = games.get(args.p_game_id);
        const rows = [1, 2, 3, 4].map((id) => ({
          player_id: id, team: id <= 2 ? 'A' : 'B', elo_before: 1200,
          elo_after: game.ranked ? 1210 : 1200, tier_before: 'B', tier_after: 'B',
        }));
        return { data: rows, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const context = vm.createContext({
    window: { supabase: { createClient: () => db } },
    document: { getElementById: () => root, addEventListener() {} },
    SUPABASE_URL: 'test', SUPABASE_ANON_KEY: 'test',
    setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
    console, Date, Math, confirm: () => true,
    URLSearchParams, location: { search: '' },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy', 'app.js'), 'utf8'), context);
  const state = vm.runInContext('state', context);
  state.phase = 'play';
  state.session = { ...session };
  state.settings = { balance_deadzone: 30, hold_minutes: 10, provisional_games: 10 };
  state.players = [1, 2, 3, 4].map((id) => ({
    id, name: `Player ${id}`, elo: 1200, tier: 'B', gamesTotal: 0,
    games: 0, consec: 0, status: 'normal', pendingRemove: false, eloStart: 1200,
  }));
  state.roster = state.players.map((p) => ({ id: p.id, elo: p.elo, tier: p.tier }));
  state.names = new Map(state.players.map((p) => [p.id, p.name]));
  state.courts = [{ id: 1, no: 1, game: null, closing: false, holdStartedAt: null }];
  const call = (expression) => vm.runInContext(expression, context);
  return { state, root, session, games, call };
}

test('ranked toggle affects only games created after it is switched on', async () => {
  const app = appFixture();
  assert.match(app.call('renderPlay()'), /Unranked.*new matches/s);

  await app.call('fillCourt(state.courts[0])');
  const first = app.state.courts[0].game;
  assert.equal(first.ranked, false);

  app.call('toggleRanked()');
  await new Promise(setImmediate);
  assert.equal(app.session.rank_new_games, true);
  assert.equal(first.ranked, false);
  assert.match(app.call('renderPlay()'), /Ranked.*new matches/s);

  app.state.courts[0].game = null;
  await app.call('fillCourt(state.courts[0])');
  const second = app.state.courts[0].game;
  assert.equal(second.ranked, true);

  app.call('toggleRanked()');
  await new Promise(setImmediate);
  app.state.courts[0].game = null;
  await app.call('fillCourt(state.courts[0])');
  assert.equal(second.ranked, true);
  assert.equal(app.state.courts[0].game.ranked, false);
});

test('an unranked result counts for rotation but keeps rating and ranked game count', async () => {
  const app = appFixture();
  await app.call('fillCourt(state.courts[0])');
  app.call("finishCourt(1, 'A')");
  await new Promise(setImmediate);

  assert.equal(app.state.log[0].ranked, false);
  for (const player of app.state.players) {
    assert.equal(player.games, 1);
    assert.equal(player.consec, 1);
    assert.equal(player.gamesTotal, 0);
    assert.equal(player.elo, 1200);
  }
  assert.match(app.root.innerHTML, /Unranked/);
  assert.doesNotMatch(app.root.innerHTML, /±0/);
  assert.match(app.call('logAsText()'), /Court 1 \(Unranked\)/);
  assert.doesNotMatch(app.call('logAsText()'), /→/);
});

test('a ranked result still updates local rating and ranked game count', async () => {
  const app = appFixture();
  app.session.rank_new_games = true;
  app.state.session.rank_new_games = true;
  await app.call('fillCourt(state.courts[0])');
  app.call("finishCourt(1, 'A')");
  await new Promise(setImmediate);

  assert.equal(app.state.log[0].ranked, true);
  for (const player of app.state.players) {
    assert.equal(player.games, 1);
    assert.equal(player.gamesTotal, 1);
    assert.equal(player.elo, 1210);
  }
  assert.match(app.call('logAsText()'), /1200→1210/);
});
