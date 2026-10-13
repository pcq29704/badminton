import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/20261012_player_profiles.sql', import.meta.url), 'utf8');
const baseline = await readFile(new URL('../court_balancer_schema.sql', import.meta.url), 'utf8');

test('migration seeds and uniquely constrains player usernames', () => {
  assert.match(migration, /update\s+public\.players[\s\S]*username[\s\S]*name/i);
  assert.match(migration, /create\s+unique\s+index[\s\S]*lower\(trim\(username\)\)/i);
});

test('first password claim is row-locked and returns no password', () => {
  assert.match(migration, /claim_player_login/i);
  assert.match(migration, /for\s+update/i);
  assert.match(migration, /password\s+is\s+null/i);
  assert.match(migration, /returns\s+table\s*\(\s*player_id\s+bigint\s*,\s*username\s+text\s*\)/i);
  assert.doesNotMatch(migration.match(/create\s+or\s+replace\s+function\s+public\.claim_player_login[\s\S]*?\$\$;/i)?.[0] ?? '', /returns\s+.*password/i);
});

test('migration and baseline use one public image bucket without anonymous write policy', () => {
  for (const sql of [migration, baseline]) {
    assert.match(sql, /player-profile-images/);
    assert.match(sql, /profile_image_path/);
    assert.match(sql, /background_image_path/);
  }
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*storage\.objects/i);
});

test('baseline keeps the existing organiser-only player policy', () => {
  assert.match(baseline, /create policy "organiser full access" on public\.players[\s\S]*public\.is_organiser\(\)/i);
  assert.doesNotMatch(baseline, /create\s+table\s+public\.profiles/i);
  assert.doesNotMatch(baseline, /auth_user_id/i);
});
