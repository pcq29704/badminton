const playerApiUrl = `${SUPABASE_URL}/functions/v1/player-api`;
const playerStorageUrl = `${SUPABASE_URL}/storage/v1/object/public/player-profile-images`;
const profileState = {
  username: new URLSearchParams(location.search).get('u') || '',
  loginUsername: new URLSearchParams(location.search).get('u') || '',
  playerPassword: '',
  loggedIn: false,
  busy: false,
  error: '',
  notice: '',
  profile: null,
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function profileImageUrl(path) {
  if (!path) return '';
  return `${playerStorageUrl}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}

function profileHref(username) {
  return `profile.html?u=${encodeURIComponent(username || '')}`;
}

function setProfileUrl() {
  const url = new URL(location.href);
  url.searchParams.set('u', profileState.username);
  history.replaceState(null, '', url);
}

async function postPlayerJson(action, values = {}) {
  const response = await fetch(playerApiUrl, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

async function refreshProfile() {
  if (!profileState.username) {
    profileState.profile = null;
    renderProfilePage();
    return;
  }
  try {
    profileState.profile = await postPlayerJson('profile', { username: profileState.username });
    profileState.error = '';
  } catch (error) {
    profileState.profile = null;
    profileState.error = error.message;
  }
  renderProfilePage();
}

function updatePlayerUsername(value) { profileState.loginUsername = value; }
function updatePlayerPassword(value) { profileState.playerPassword = value; }
function updateProfileUsername(value) { profileState.newUsername = value; }

async function playerLogin() {
  if (profileState.busy) return;
  profileState.busy = true;
  profileState.error = '';
  renderProfilePage();
  try {
    const result = await postPlayerJson('login', {
      username: profileState.loginUsername,
      password: profileState.playerPassword,
    });
    profileState.username = result.username;
    profileState.loginUsername = result.username;
    profileState.loggedIn = true;
    setProfileUrl();
    await refreshProfile();
  } catch (error) {
    profileState.error = error.message;
  } finally {
    profileState.busy = false;
    renderProfilePage();
  }
}

async function saveProfileUsername() {
  if (profileState.busy || !profileState.loggedIn) return;
  profileState.busy = true;
  profileState.error = '';
  profileState.notice = '';
  renderProfilePage();
  try {
    const result = await postPlayerJson('update', {
      username: profileState.username,
      password: profileState.playerPassword,
      newUsername: profileState.newUsername,
    });
    profileState.username = result.username;
    profileState.loginUsername = result.username;
    setProfileUrl();
    profileState.notice = 'Username updated.';
    await refreshProfile();
  } catch (error) {
    profileState.error = error.message;
  } finally {
    profileState.busy = false;
    renderProfilePage();
  }
}

async function uploadPlayerImage(kind, file) {
  if (profileState.busy || !profileState.loggedIn || !file) return;
  profileState.busy = true;
  profileState.error = '';
  profileState.notice = '';
  renderProfilePage();
  try {
    const form = new FormData();
    form.append('action', 'upload');
    form.append('username', profileState.username);
    form.append('password', profileState.playerPassword);
    form.append('kind', kind);
    form.append('file', file);
    const response = await fetch(playerApiUrl, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY }, body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Upload failed.');
    profileState.notice = kind === 'profile' ? 'Profile image updated.' : 'Background image updated.';
    await refreshProfile();
  } catch (error) {
    profileState.error = error.message;
  } finally {
    profileState.busy = false;
    renderProfilePage();
  }
}

function uploadSelectedImage(kind, input) {
  const file = input.files?.[0];
  input.value = '';
  void uploadPlayerImage(kind, file);
}

function renderHistory(historyRows) {
  if (!historyRows.length) return '<p class="hint">No finished games yet.</p>';
  return `<div class="profile-history">${historyRows.map((game) => {
    const side = (players) => players.map((player) => player.username
      ? `<a href="${esc(profileHref(player.username))}">${esc(player.name)}</a>` : esc(player.name)).join(' + ');
    const date = game.ended_at ? new Date(game.ended_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
    return `<article class="profile-game">
      <div class="log-head">${esc(date)}</div>
      <div class="profile-game-team${game.winner === 'A' ? ' won' : ''}">Team A · ${side(game.team_a || [])}${game.winner === 'A' ? ' 🏆' : ''}</div>
      <div class="profile-game-team${game.winner === 'B' ? ' won' : ''}">Team B · ${side(game.team_b || [])}${game.winner === 'B' ? ' 🏆' : ''}</div>
      <div class="log-meta">Team ${esc(game.winner)} won</div>
    </article>`;
  }).join('')}</div>`;
}

function renderProfileEditor(profile) {
  if (!profileState.loggedIn) return `<div class="card">
    <div class="label" style="margin-bottom:8px">Player sign in</div>
    <input type="text" autocomplete="username" value="${esc(profileState.loginUsername)}" placeholder="Username"
      oninput="updatePlayerUsername(this.value)" onkeydown="if(event.key==='Enter')document.getElementById('player-password').focus()">
    <input id="player-password" type="password" autocomplete="current-password" value="${esc(profileState.playerPassword)}" placeholder="Password"
      style="margin-top:8px" oninput="updatePlayerPassword(this.value)" onkeydown="if(event.key==='Enter')playerLogin()">
    <button class="btn big" style="margin-top:12px" onclick="playerLogin()" ${profileState.busy ? 'disabled' : ''}>Sign in</button>
    <p class="hint">The first password entered for an unclaimed username becomes its password.</p>
  </div>`;

  return `<div class="card">
    <div class="card-head"><div class="label">Edit profile</div><span class="hint">Signed in as ${esc(profile.username)}</span></div>
    <label class="profile-field"><span>Username</span>
      <div class="player-row"><input type="text" maxlength="32" value="${esc(profileState.newUsername ?? profile.username)}"
        oninput="updateProfileUsername(this.value)"><button class="btn subtle" onclick="saveProfileUsername()" ${profileState.busy ? 'disabled' : ''}>Save</button></div>
    </label>
    <label class="profile-field"><span>Profile image · JPEG, PNG, or WebP · up to 5 MB</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadSelectedImage('profile',this)" ${profileState.busy ? 'disabled' : ''}>
    </label>
    <label class="profile-field"><span>Background image · JPEG, PNG, or WebP · up to 5 MB</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadSelectedImage('background',this)" ${profileState.busy ? 'disabled' : ''}>
    </label>
    <button class="mini-btn" onclick="playerSignOut()">Sign out</button>
  </div>`;
}

function playerSignOut() {
  profileState.loggedIn = false;
  profileState.playerPassword = '';
  profileState.loginUsername = profileState.username;
  profileState.newUsername = '';
  profileState.notice = '';
  renderProfilePage();
}

function renderProfilePage() {
  const root = document.getElementById('profile-root');
  const profile = profileState.profile;
  let html = `<header id="app-header"><div style="font-size:46px">🏸</div><h1>Player profile</h1>
    <p class="sub"><a href="index.html">Court Balancer</a></p></header>`;
  if (profileState.error) html += `<div class="toast error profile-message">${esc(profileState.error)}</div>`;
  if (profileState.notice) html += `<div class="toast profile-message">${esc(profileState.notice)}</div>`;
  if (!profileState.username) {
    html += `<div class="card center"><p>Open a player profile using its username, for example <code>profile.html?u=sam</code>.</p></div>`;
  } else if (profile) {
    const background = profile.background_image_path ? ` style="background-image:url('${esc(profileImageUrl(profile.background_image_path))}')"` : '';
    const photo = profile.profile_image_path
      ? `<img class="profile-avatar" src="${esc(profileImageUrl(profile.profile_image_path))}" alt="${esc(profile.username)} profile image">`
      : '<div class="profile-avatar profile-avatar-empty" aria-hidden="true">🏸</div>';
    html += `<section class="profile-cover"${background}>
      <div class="profile-identity">${photo}<div><div class="profile-username">${esc(profile.username)}</div>
        <div class="profile-rank">${esc(profile.tier)} tier · Elo ${esc(profile.elo)}</div></div></div>
    </section>
    <div class="profile-stats">
      <div class="card center"><div class="label">Elo</div><strong>${esc(profile.elo)}</strong></div>
      <div class="card center"><div class="label">Tier</div><strong>${esc(profile.tier)}</strong></div>
      <div class="card center"><div class="label">Total games</div><strong>${esc(profile.games_total)}</strong></div>
    </div>
    ${renderProfileEditor(profile)}
    <div class="card"><div class="card-head"><div class="label">Finished games</div><span class="hint">${profile.history.length} total</span></div>
      ${renderHistory(profile.history)}</div>`;
  } else if (!profileState.error) {
    html += '<div class="card center"><p class="hint">Loading player profile…</p></div>';
  }
  root.innerHTML = html;
  const cover = root.querySelector('.profile-cover');
  if (cover && profile?.background_image_path) cover.style.backgroundImage = `linear-gradient(90deg, rgba(12,48,40,.76), rgba(12,48,40,.16)), url("${profileImageUrl(profile.background_image_path)}")`;
}

renderProfilePage();
void refreshProfile();
