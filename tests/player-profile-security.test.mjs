import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/20261012_player_profiles.sql', import.meta.url), 'utf8');
const edge = await readFile(new URL('../supabase/functions/player-api/index.ts', import.meta.url), 'utf8');
const browser = await readFile(new URL('./fixtures/legacy/profile.js', import.meta.url), 'utf8');
const baseline = await readFile(new URL('../court_balancer_schema.sql', import.meta.url), 'utf8');

test('password claim compares exact text and is only executable by the Edge Function role', () => {
  assert.match(migration, /v_saved_password\s*<>\s*p_password/);
  assert.match(migration, /for\s+update/i);
  assert.match(migration, /revoke all on function public\.claim_player_login\(text, text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_player_login\(text, text\) to service_role/i);
});

test('public history query includes only finished games and explicit player fields', () => {
  assert.match(edge, /select\('id,username,elo,tier,games_total,profile_image_path,background_image_path'\)/);
  assert.match(edge, /\.eq\('games\.status', 'finished'\)/);
  assert.match(edge, /select\('id,ended_at,winner,status,game_players\(team,players\(name,username\)\)'\)/);
  assert.match(edge, /profileResponse\(player, history\)/);
  const readStart = edge.indexOf('async function publicProfile');
  const readEnd = edge.indexOf('\n}\n\nasync function updateUsername', readStart);
  assert.match(edge.slice(readStart, readEnd), /catch[\s\S]*return json\(\{ error: .*\}, 400\)/);
});

test('image writes require password verification and update only one image-path column', () => {
  const uploadStart = edge.indexOf('async function uploadImage');
  const uploadEnd = edge.indexOf('\n}\n\nDeno.serve', uploadStart);
  const upload = edge.slice(uploadStart, uploadEnd);
  assert.ok(upload.indexOf('await authenticate') < upload.indexOf('.upload(path'));
  const sizeCheck = upload.indexOf('validateImageSize(file.size)');
  assert.ok(sizeCheck >= 0 && sizeCheck < upload.indexOf('await file.arrayBuffer()'));
  const multipartCheck = edge.indexOf('validateMultipartSize(request)');
  assert.ok(multipartCheck >= 0 && multipartCheck < edge.indexOf('request.formData()'));
  assert.match(upload, /kind === 'profile' \? 'profile_image_path' : 'background_image_path'/);
  assert.match(upload, /update\(\{ \[column\]: path \}\)/);
  assert.match(upload, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(browser, /\.storage\.|object\/upload/i);
});

test('anon users cannot write to storage and game tables remain organiser-only', () => {
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*storage\.objects/i);
  for (const table of ['sessions', 'session_players', 'courts', 'games', 'game_players']) {
    assert.match(baseline, new RegExp(`create policy "organiser full access" on public\\.${table}[\\s\\S]*public\\.is_organiser\\(\\)`, 'i'));
  }
});

test('browser contains no Supabase service key', () => {
  assert.doesNotMatch(browser, /SERVICE_ROLE|service_role|secret[_-]?key/i);
});
