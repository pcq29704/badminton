import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('organiser creates players with a chosen username without selecting passwords', () => {
  assert.match(app, /select\("id,name,username,elo,tier,games_total"\)/);
  assert.match(app, /insert\(\{\s*name,\s*username,\s*tier:/);
  assert.doesNotMatch(app, /players"\)\.select\([^\n]*password/i);
});

test('organiser email/password authentication remains enabled', () => {
  assert.match(app, /db\.auth\.signInWithPassword\(\{\s*email,\s*password:/);
  assert.match(app, /db\.auth\.signOut\(\)/);
});

test('existing app exposes player profile links', () => {
  assert.match(app, /profile\.html\?u=/);
  assert.match(app, /username/);
});
