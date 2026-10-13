import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imageExtension, profileResponse, usernameFromName, validateUsername } from '../supabase/functions/player-api/logic.mjs';

test('username seed is a lowercase URL-safe form of the player name', () => {
  assert.equal(usernameFromName('  Sam O’Neil  '), 'sam-o-neil');
});

test('username validation rejects invalid and oversized values', () => {
  assert.equal(validateUsername('  Sam_7 '), 'sam_7');
  assert.throws(() => validateUsername('has spaces'));
  assert.throws(() => validateUsername('x'.repeat(33)));
});

test('image validation accepts real JPEG, PNG, and WebP signatures', () => {
  assert.equal(imageExtension('image/jpeg', 4, Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'jpg');
  assert.equal(imageExtension('image/png', 8, Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), 'png');
  assert.equal(imageExtension('image/webp', 12, Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), 'webp');
});

test('image validation rejects spoofed, unsupported, and oversized uploads', () => {
  assert.throws(() => imageExtension('image/png', 8, new Uint8Array(8)));
  assert.throws(() => imageExtension('image/gif', 8, new Uint8Array(8)));
  assert.throws(() => imageExtension('image/png', 5 * 1024 * 1024 + 1, new Uint8Array(8)));
});

test('public profile response is an explicit safe-field projection', () => {
  const result = profileResponse({
    id: 4, username: 'sam', password: 'private', elo: 1200, tier: 'B', games_total: 8,
    profile_image_path: '4/profile.png', background_image_path: null, active: true, created_at: 'hidden',
  }, [{ ended_at: '2026-10-12T10:00:00Z', winner: 'A', team_a: [{ name: 'Sam', username: 'sam' }], team_b: [] }]);
  assert.deepEqual(Object.keys(result), ['username', 'elo', 'tier', 'games_total', 'profile_image_path', 'background_image_path', 'history']);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('created_at'), false);
});

test('Edge Function does not log request credentials or return a player row', async () => {
  const source = await readFile(new URL('../supabase/functions/player-api/index.ts', import.meta.url), 'utf8');
  assert.match(source, /claim_player_login/);
  assert.match(source, /profileResponse/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\s*\([^\n]*(?:password|request\.json|formData)/i);
  assert.doesNotMatch(source, /return\s+json\(\s*player\s*\)/i);
});
