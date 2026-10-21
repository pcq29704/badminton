import test from 'node:test';
import assert from 'node:assert/strict';
import { clearedSessionCookie, hashSessionToken, newSessionToken, readSessionToken, sessionCookie, sessionExpiry } from '../src/lib/player-api/session.mjs';

test('session tokens are 43 url-safe characters and differ on each call', () => {
  const a = newSessionToken();
  const b = newSessionToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test('stored hash is 64 lowercase hex characters, stable, and never the raw token', () => {
  const token = newSessionToken();
  const hash = hashSessionToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashSessionToken(token), hash);
  assert.notEqual(hash, token);
});

test('session cookie is httpOnly, secure, lax, path-wide and lasts 30 days', () => {
  const cookie = sessionCookie('t');
  assert.match(cookie, /^player_session=t; /);
  for (const part of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000']) {
    assert.ok(cookie.includes(part), `missing ${part}`);
  }
});

test('cleared cookie keeps the same attributes and expires immediately', () => {
  const cookie = clearedSessionCookie();
  assert.match(cookie, /^player_session=; /);
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('Max-Age=0'));
});

test('readSessionToken finds its own cookie among others', () => {
  assert.equal(readSessionToken('a=1; player_session=XYZ; b=2'), 'XYZ');
});

test('readSessionToken matches the cookie name exactly', () => {
  assert.equal(readSessionToken('player_session_old=1'), null);
});

test('readSessionToken returns null for missing, empty or oversized values', () => {
  assert.equal(readSessionToken(null), null);
  assert.equal(readSessionToken(''), null);
  assert.equal(readSessionToken('player_session='), null);
  assert.equal(readSessionToken('player_session=' + 'x'.repeat(200)), null);
});

test('session expiry is 30 days after the given time', () => {
  assert.equal(sessionExpiry(new Date(0)).getTime(), 30 * 24 * 60 * 60 * 1000);
});
