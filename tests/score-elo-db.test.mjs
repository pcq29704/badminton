// Checks the score-based Elo functions in a real database. Opt-in, because it needs the
// dev database with the 20261103000000_score_elo migration applied:
//   SCORE_ELO_DB_TEST=1 node --test tests/score-elo-db.test.mjs
// Uses DATABASE_URL from .env.local / .env. Everything runs in one transaction that is
// rolled back, so no players, sessions or games are left behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(path.join(root, file)); } catch { /* file not present */ }
}
const PRODUCTION_REF = 'yupitnoeqvifjfvxddob';
const url = process.env.DATABASE_URL || '';
const skip = process.env.SCORE_ELO_DB_TEST !== '1' ? 'set SCORE_ELO_DB_TEST=1 to run'
  : !url ? 'DATABASE_URL is missing'
  : url.includes(PRODUCTION_REF) ? 'DATABASE_URL points at production' : false;

test('score-based Elo in the database', { skip }, async (t) => {
  const { default: pg } = await import('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  const db = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await db.connect();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const all = async (sql, params) => (await db.query(sql, params)).rows;
  // Statements that are expected to fail run inside a savepoint so the transaction survives.
  async function rejects(sql, params, pattern) {
    await db.query('savepoint expect_error');
    await assert.rejects(db.query(sql, params), pattern);
    await db.query('rollback to savepoint expect_error');
  }

  try {
    await db.query('begin');
    const organiser = await one('select user_id from public.organisers limit 1');
    if (!organiser) { t.skip('no organiser in this database'); return; }
    await db.query('update public.sessions set status = $1, ended_at = now() where status = $2', ['ended', 'active']);
    await db.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
      [JSON.stringify({ sub: organiser.user_id, role: 'authenticated' }), organiser.user_id]);
    await db.query('set local role authenticated');

    const tag = `zz${Date.now().toString(36)}`;
    const ids = [];
    for (let i = 1; i <= 4; i++) {
      ids.push((await one('insert into public.players (name, username, elo, tier) values ($1, $1, 0, $2) returning id', [`${tag}-${i}`, 'B'])).id);
    }
    const [a1, a2, b1, b2] = ids;
    // Team A averages 100 above team B, and everyone is past the provisional games (K = 24)
    await db.query('update public.players set elo = case when id = any($1) then 1300 else 1200 end, games_total = 20 where id = any($2)', [[a1, a2], ids]);
    const session = (await one('insert into public.sessions (status, rank_new_games) values ($1, true) returning id', ['active'])).id;
    const court = (await one('insert into public.courts (session_id, court_no) values ($1, 1) returning id', [session])).id;
    for (const id of ids) await db.query('insert into public.session_players (session_id, player_id) values ($1, $2)', [session, id]);
    const startGame = async () => (await one('select public.start_game($1, $2, $3) as id', [court, [a1, a2], [b1, b2]])).id;
    const elos = async () => Object.fromEntries((await all('select id, elo from public.players where id = any($1)', [ids])).map((r) => [r.id, Number(r.elo)]));

    const game = await startGame();

    await t.test('finish_game rejects invalid scores', async () => {
      await rejects('select * from public.finish_game($1, 21, 20)', [game], /2-point lead/);
      await rejects('select * from public.finish_game($1, 25, 10)', [game], /unless it's 20-all/);
      await rejects('select * from public.finish_game($1, 15, 15)', [game], /tied/);
      await rejects('select * from public.finish_game($1, 31, 29)', [game], /between 0 and 30/);
      assert.equal((await one('select status from public.games where id = $1', [game])).status, 'playing');
    });

    await t.test('writing an invalid score straight to the table is blocked', async () => {
      await rejects(`update public.games set status = 'finished', winner = 'A', ended_at = now(), score_a = 25, score_b = 10 where id = $1`, [game], /Invalid score/);
      await rejects(`update public.games set status = 'finished', winner = 'B', ended_at = now(), score_a = 21, score_b = 15 where id = $1`, [game], /games_scores_winner/);
    });

    await t.test('favourite wins 21-19: +7.51 / -7.51 and the score is stored', async () => {
      const rows = await all('select * from public.finish_game($1, 21, 19)', [game]);
      assert.equal(rows.length, 4);
      assert.equal(Number(rows[0].mov_multiplier).toFixed(3), '0.869');
      assert.deepEqual(await elos(), { [a1]: 1307.51, [a2]: 1307.51, [b1]: 1192.49, [b2]: 1192.49 });
      const saved = await one('select winner, score_a, score_b, mov_multiplier from public.games where id = $1', [game]);
      assert.deepEqual([saved.winner, saved.score_a, saved.score_b], ['A', 21, 19]);
    });

    await t.test('correcting to 10-21 reverses the old change and applies the new one', async () => {
      await rejects('select * from public.correct_result($1, 21, 20)', [game], /2-point lead/);
      const rows = await all('select * from public.correct_result($1, 10, 21)', [game]);
      assert.equal(rows[0].score_a, 10);
      assert.deepEqual(await elos(), { [a1]: 1278.42, [a2]: 1278.42, [b1]: 1221.58, [b2]: 1221.58 });
      const saved = await one('select winner, mov_multiplier from public.games where id = $1', [game]);
      assert.equal(saved.winner, 'B');
      assert.equal(Number(saved.mov_multiplier).toFixed(3), '1.405');
      assert.equal((await one('select games_total from public.players where id = $1', [a1])).games_total, 21);
    });

    await t.test('correction is blocked once a player has finished another ranked game', async () => {
      // All statements share one transaction (same now()), so move the first game back in time
      await db.query('reset role');
      await db.query(`update public.games set ended_at = ended_at - interval '1 minute' where id = $1`, [game]);
      await db.query('set local role authenticated');
      const second = await startGame();
      await db.query('select * from public.finish_game($1, 21, 0)', [second]);
      await rejects('select * from public.correct_result($1, 21, 19)', [game], /Too late to correct/);
    });

    await t.test('an old game without a score is still valid and unchanged', async () => {
      const old = (await one(`insert into public.games (session_id, court_id, ranked, status, winner, ended_at)
        values ($1, $2, true, 'finished', 'A', now()) returning id, winner, score_a, score_b, mov_multiplier`, [session, court]));
      assert.deepEqual([old.winner, old.score_a, old.score_b, old.mov_multiplier], ['A', null, null, null]);
    });
  } finally {
    await db.query('rollback').catch(() => {});
    await db.end();
  }
});
