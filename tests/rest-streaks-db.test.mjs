// Checks that streaks survive a round starting and clear for people resting. Opt-in, because it
// needs the dev database with the 20261107000000_rest_streaks migration applied:
//   REST_STREAKS_DB_TEST=1 node --test tests/rest-streaks-db.test.mjs
// Uses DATABASE_URL from .env.local / .env. Runs in one transaction that is rolled back.
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
const skip = process.env.REST_STREAKS_DB_TEST !== '1' ? 'set REST_STREAKS_DB_TEST=1 to run'
  : !url ? 'DATABASE_URL is missing'
  : url.includes(PRODUCTION_REF) ? 'DATABASE_URL points at production' : false;

test('streaks in the database', { skip }, async (t) => {
  const { default: pg } = await import('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  const db = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await db.connect();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];

  try {
    await db.query('begin');
    const organiser = await one('select user_id from public.organisers limit 1');
    if (!organiser) { t.skip('no organiser in this database'); return; }
    await db.query(`update public.sessions set status = 'ended', ended_at = now() where status = 'active'`);
    await db.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
      [JSON.stringify({ sub: organiser.user_id, role: 'authenticated' }), organiser.user_id]);
    await db.query('set local role authenticated');

    const tag = `zz${Date.now().toString(36)}`;
    const ids = [];
    for (let i = 1; i <= 10; i++) {
      ids.push((await one(`insert into public.players (name, username, elo, tier) values ($1, $1, 0, 'B') returning id`, [`${tag}-${i}`])).id);
    }
    const session = (await one(`insert into public.sessions (status, rank_new_games) values ('active', true) returning id`)).id;
    const court1 = (await one('insert into public.courts (session_id, court_no) values ($1, 1) returning id', [session])).id;
    const court2 = (await one('insert into public.courts (session_id, court_no) values ($1, 2) returning id', [session])).id;
    for (const id of ids) await db.query('insert into public.session_players (session_id, player_id, consec) values ($1, $2, 3)', [session, id]);
    const onBreak = ids[9];
    await db.query(`update public.session_players set status = 'break' where session_id = $1 and player_id = $2`, [session, onBreak]);
    const consec = async (id) => (await one('select consec from public.session_players where session_id = $1 and player_id = $2', [session, id])).consec;

    await db.query('select public.start_game($1, $2, $3)', [court1, ids.slice(0, 2), ids.slice(2, 4)]);
    assert.equal(await consec(ids[4]), 3, 'a player planned for the next court keeps their streak');

    await db.query('select public.start_game($1, $2, $3)', [court2, ids.slice(4, 6), ids.slice(6, 8)]);
    await db.query('select public.reset_rest_streaks($1)', [session]);
    for (const id of ids.slice(0, 8)) assert.equal(await consec(id), 3, 'players on court keep their streak');
    assert.equal(await consec(ids[8]), 0, 'a player sitting out is reset');
    assert.equal(await consec(onBreak), 0, 'a player on a break is reset');
  } finally {
    await db.query('rollback').catch(() => {});
    await db.end();
  }
});
