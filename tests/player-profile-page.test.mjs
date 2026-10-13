import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../profile.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../profile.js', import.meta.url), 'utf8');

test('profile page loads the shared theme, public key, and player page script', () => {
  assert.match(html, /styles\.css/);
  assert.match(html, /config\.js/);
  assert.match(html, /profile\.js/);
});

test('profile page calls the Edge Function for public view, login, edits, and uploads', () => {
  for (const action of ['profile', 'login', 'update']) assert.ok(script.includes(`postPlayerJson('${action}'`));
  assert.match(script, /form\.append\('action', 'upload'\)/);
  assert.match(script, /functions\/v1\/player-api/);
});

test('player credentials stay in page memory and profile output is escaped', () => {
  assert.match(script, /playerPassword/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie/);
  assert.match(script, /function esc\(/);
});

test('profile view and history fields are rendered', () => {
  for (const field of ['elo', 'tier', 'games_total', 'ended_at', 'team_a', 'team_b', 'winner']) {
    assert.match(script, new RegExp(field));
  }
  assert.match(script, /profile_image_path/);
  assert.match(script, /background_image_path/);
});
