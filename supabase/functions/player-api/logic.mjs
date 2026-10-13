export function usernameFromName(name) {
  const slug = String(name ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 32) || 'player';
}

export function validateUsername(value) {
  if (typeof value !== 'string') throw new Error('Enter a valid username.');
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,32}$/.test(username)) throw new Error('Use 1–32 letters, numbers, dots, underscores, or hyphens.');
  return username;
}

export function validateImageSize(size) {
  if (!Number.isInteger(size) || size < 1 || size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
}

export function imageExtension(contentType, size, bytes) {
  validateImageSize(size);
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const matches = {
    'image/jpeg': data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    'image/png': data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => data[i] === byte),
    'image/webp': data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...data.slice(8, 12)) === 'WEBP',
  };
  if (!matches[contentType]) throw new Error('Choose a valid JPEG, PNG, or WebP image.');
  return contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length);
}

export function profileResponse(player, history) {
  return {
    username: player.username,
    elo: player.elo,
    tier: player.tier,
    games_total: player.games_total,
    profile_image_path: player.profile_image_path,
    background_image_path: player.background_image_path,
    history: history.map((game) => ({
      ended_at: game.ended_at,
      winner: game.winner,
      team_a: game.team_a.map(({ name, username }) => ({ name, username })),
      team_b: game.team_b.map(({ name, username }) => ({ name, username })),
    })),
  };
}
