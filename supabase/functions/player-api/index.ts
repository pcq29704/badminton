import { createClient } from 'npm:@supabase/supabase-js@2';
import { imageExtension, profileResponse, validateImageSize, validateUsername } from './logic.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function client() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Server configuration is incomplete.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(db: ReturnType<typeof client>, username: string, password: string) {
  const { data, error } = await db.rpc('claim_player_login', {
    p_username: username,
    p_password: password,
  });
  if (error || !Array.isArray(data) || !data[0]?.player_id) return null;
  return { player_id: data[0].player_id as number, username: data[0].username as string };
}

async function publicProfile(db: ReturnType<typeof client>, rawUsername: unknown) {
  let username: string;
  try { username = validateUsername(rawUsername); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Enter a valid username.' }, 400); }
  const { data: player, error: playerError } = await db.from('players')
    .select('id,username,elo,tier,games_total,profile_image_path,background_image_path')
    .eq('username', username)
    .maybeSingle();
  if (playerError) return json({ error: 'Could not load this profile.' }, 500);
  if (!player) return json({ error: 'Profile not found.' }, 404);

  const { data: appearances, error: appearancesError } = await db.from('game_players')
    .select('game_id,games!inner(id,status)')
    .eq('player_id', player.id)
    .eq('games.status', 'finished');
  if (appearancesError) return json({ error: 'Could not load this profile.' }, 500);

  const gameIds = [...new Set((appearances || []).map((row: { game_id: number }) => row.game_id))];
  let history: ReturnType<typeof profileResponse>['history'] = [];
  if (gameIds.length) {
    const { data: games, error: gamesError } = await db.from('games')
      .select('id,ended_at,winner,status,game_players(team,players(name,username))')
      .in('id', gameIds)
      .eq('status', 'finished')
      .order('ended_at', { ascending: false });
    if (gamesError) return json({ error: 'Could not load this profile.' }, 500);
    history = (games || []).map((game: any) => {
      const players = game.game_players || [];
      const side = (team: string) => players.filter((row: any) => row.team === team)
        .map((row: any) => ({ name: row.players?.name || 'Player', username: row.players?.username || '' }));
      return { ended_at: game.ended_at, winner: game.winner, team_a: side('A'), team_b: side('B') };
    });
  }
  return json(profileResponse(player, history));
}

async function updateUsername(db: ReturnType<typeof client>, body: Record<string, unknown>) {
  if (typeof body.password !== 'string' || !body.password) return json({ error: 'Invalid username or password.' }, 401);
  let username: string;
  let newUsername: string;
  try {
    username = validateUsername(body.username);
    newUsername = validateUsername(body.newUsername);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Enter a valid username.' }, 400);
  }
  const player = await authenticate(db, username, body.password);
  if (!player) return json({ error: 'Invalid username or password.' }, 401);
  const { data, error } = await db.from('players').update({ username: newUsername })
    .eq('id', player.player_id).select('username').single();
  if (error?.code === '23505') return json({ error: 'That username is unavailable.' }, 409);
  if (error || !data) return json({ error: 'Could not update this profile.' }, 500);
  return json({ ok: true, username: data.username });
}

async function uploadImage(db: ReturnType<typeof client>, form: FormData) {
  const usernameValue = form.get('username');
  const password = form.get('password');
  const kind = form.get('kind');
  const file = form.get('file');
  if (typeof password !== 'string' || !password || !(file instanceof File)) {
    return json({ error: 'Invalid username, password, or image.' }, 400);
  }
  let username: string;
  try { username = validateUsername(usernameValue); }
  catch { return json({ error: 'Invalid username or password.' }, 401); }
  if (kind !== 'profile' && kind !== 'background') return json({ error: 'Choose a profile or background image.' }, 400);
  const player = await authenticate(db, username, password);
  if (!player) return json({ error: 'Invalid username or password.' }, 401);

  try { validateImageSize(file.size); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Images must be 5 MB or smaller.' }, 400); }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extension: string;
  try { extension = imageExtension(file.type, file.size, bytes); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Choose a valid image.' }, 400); }

  const column = kind === 'profile' ? 'profile_image_path' : 'background_image_path';
  const { data: previous, error: previousError } = await db.from('players').select(column)
    .eq('id', player.player_id).single();
  if (previousError) return json({ error: 'Could not save this image.' }, 500);

  const path = `${player.player_id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from('player-profile-images').upload(path, bytes, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) return json({ error: 'Could not upload this image.' }, 500);
  const { error: updateError } = await db.from('players').update({ [column]: path }).eq('id', player.player_id);
  if (updateError) {
    await db.storage.from('player-profile-images').remove([path]);
    return json({ error: 'Could not save this image.' }, 500);
  }
  if (previous?.[column] && previous[column] !== path) {
    await db.storage.from('player-profile-images').remove([previous[column]]);
  }
  return json({ ok: true, kind, path });
}

function validateMultipartSize(request: Request) {
  const value = request.headers.get('content-length');
  if (!value) return true;
  const length = Number(value);
  return Number.isSafeInteger(length) && length <= 5 * 1024 * 1024 + 64 * 1024;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const db = client();
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      if (!validateMultipartSize(request)) return json({ error: 'Images must be 5 MB or smaller.' }, 413);
      const form = await request.formData();
      if (form.get('action') !== 'upload') return json({ error: 'Unsupported request.' }, 400);
      return await uploadImage(db, form);
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
    if (body.action === 'profile') return await publicProfile(db, body.username);
    if (body.action === 'update') return await updateUsername(db, body);
    if (body.action !== 'login') return json({ error: 'Unsupported request.' }, 400);

    let username: string;
    try { username = validateUsername(body.username); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Enter a valid username.' }, 400); }
    if (typeof body.password !== 'string' || !body.password) return json({ error: 'Invalid username or password.' }, 401);
    const player = await authenticate(db, username, body.password);
    if (!player) return json({ error: 'Invalid username or password.' }, 401);
    return json({ ok: true, username: player.username });
  } catch {
    return json({ error: 'The player service is unavailable. Try again.' }, 500);
  }
});
