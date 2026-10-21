import crypto from 'node:crypto';

export const COOKIE_NAME = 'player_session';
export const SESSION_DAYS = 30;
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

const MAX_TOKEN_LENGTH = 128;
const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== COOKIE_NAME) continue;
    const value = part.slice(index + 1).trim();
    if (!value || value.length > MAX_TOKEN_LENGTH) return null;
    return value;
  }
  return null;
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
}

export function sessionExpiry(now) {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}
