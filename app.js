// ---------------- state ----------------
let state = {
  phase: "setup",
  numCourts: 1,
  numTiers: 1,
  names: ["", "", "", ""],
  tiers: [1, 1, 1, 1],
  players: [],            // {id, name, tier, games, consec, status: 'normal'|'keen'|'break', pendingRemove}
  partnerHist: new Map(),   // pairKey -> times this duo has partnered
  matchHist: new Map(),     // matchKey -> times this exact matchup happened
  courts: [],              // {no, game: {teamA,teamB}|null, closing} — "no" is a stable court number
  nextCourtNo: 1,
  nextPlayerId: 0,
  finished: 0,            // total games finished today
  showStats: false,
  showLog: false,
  showHelp: false,
  showManage: false,
  helpLang: "en",
  log: [],                // finished-match history for debugging
  newPlayerName: "",
  newPlayerTier: 1,
};

// ---------------- helpers ----------------
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join("|");
const matchKey = (t1, t2) => {
  const k1 = pairKey(t1[0].id, t1[1].id);
  const k2 = pairKey(t2[0].id, t2[1].id);
  return [k1, k2].sort((a, b) => a.localeCompare(b)).join("||");
};
const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const cnt = (map, k) => map.get(k) || 0;
const inc = (map, k) => map.set(k, cnt(map, k) + 1);

const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

// ids of players currently on any court
function playingIds() {
  const s = new Set();
  for (const c of state.courts) {
    if (c.game) [...c.game.teamA, ...c.game.teamB].forEach((p) => s.add(p.id));
  }
  return s;
}

// players eligible to be picked for a new game right now
function freeCandidates() {
  const busy = playingIds();
  return state.players.filter((p) => p.status !== "break" && !p.pendingRemove && !busy.has(p.id));
}

// players marked for removal drop out of the roster once they're no longer on a court
function sweepPendingRemovals() {
  const busy = playingIds();
  state.players = state.players.filter((p) => !(p.pendingRemove && !busy.has(p.id)));
}

// Score one game's matchup. LOWER = better.
// Tier balance dominates, then fresh partnerships, then fresh matchups.
function scoreGame(t1, t2) {
  let s = 0;
  const diff = Math.abs(t1[0].tier + t1[1].tier - (t2[0].tier + t2[1].tier));
  s += diff * 100;                                             // imbalance dominates
  s += cnt(state.partnerHist, pairKey(t1[0].id, t1[1].id)) * 45; // each past repeat costs more
  s += cnt(state.partnerHist, pairKey(t2[0].id, t2[1].id)) * 45;
  s += cnt(state.matchHist, matchKey(t1, t2)) * 45;
  return s;
}

// Best of the 3 possible doubles pairings for a fixed group of 4
function bestPairing(four) {
  let best = null;
  for (const [aIdx, bIdx] of PAIRINGS) {
    const t1 = [four[aIdx[0]], four[aIdx[1]]];
    const t2 = [four[bIdx[0]], four[bIdx[1]]];
    const s = scoreGame(t1, t2);
    if (!best || s < best.s) best = { t1, t2, s };
  }
  return best;
}

function* combos4(arr) {
  const n = arr.length;
  for (let a = 0; a < n - 3; a++)
    for (let b = a + 1; b < n - 2; b++)
      for (let c = b + 1; c < n - 1; c++)
        for (let d = c + 1; d < n; d++)
          yield [arr[a], arr[b], arr[c], arr[d]];
}

// Fill one court with the best game from currently free players.
// Selection priority: fewest games played > ⚡ keen > longest rest,
// then tier balance and repeat-avoidance for the matchup itself.
function fillCourt(court) {
  const cands = freeCandidates();
  if (cands.length < 4) { court.game = null; return; }

  const minGames = Math.min(...cands.map((p) => p.games));
  let best = null;
  for (const combo of combos4(cands)) {
    let fairness = 0;
    for (const p of combo) {
      // Fairness with a 1-game tolerance: being 1 game ahead is a soft nudge,
      // 2+ games ahead is a hard block. The tolerance gives the mixer room to
      // avoid repeat teams instead of locking the same 4 people together.
      const ahead = p.games - minGames;
      fairness += Math.max(0, ahead - 1) * 300 + ahead * 40;
      fairness += p.consec * 15;                   // long streaks lower priority slightly
      if (p.status === "keen") fairness -= 350;    // ⚡ wants to play = strong boost
    }
    const bp = bestPairing(combo);
    const total = fairness + bp.s + Math.random() * 5; // NOSONAR tiny noise so ties rotate; not security-sensitive
    if (!best || total < best.total) best = { total, t1: bp.t1, t2: bp.t2 };
  }
  court.game = { teamA: best.t1, teamB: best.t2 };

  // anyone free (not on break) who wasn't picked is now resting -> streak resets
  const busy = playingIds();
  state.players.forEach((p) => {
    if (p.status !== "break" && !busy.has(p.id)) p.consec = 0;
  });
}

// Courts marked "closing" sit out of refills — they get removed once their current game ends
function fillEmptyCourts() {
  for (const court of state.courts) {
    if (!court.game && !court.closing) fillCourt(court);
  }
}

// ---------------- actions ----------------
function setPlayerCount(n) {
  const count = Math.max(4, Math.min(30, n));
  state.names = Array.from({ length: count }, (_, i) => state.names[i] ?? "");
  state.tiers = Array.from({ length: count }, (_, i) => state.tiers[i] ?? 1);
  render();
}
function bump(field, delta, min, max) {
  state[field] = Math.max(min, Math.min(max, state[field] + delta));
  render();
}
function updateName(i, v) { state.names[i] = v; }
function updateTier(i, v) { state.tiers[i] = Number(v); }

function startDay() {
  state.players = state.names.map((n, i) => ({
    id: i,
    name: n.trim() || ("Player " + (i + 1)),
    tier: Math.min(state.tiers[i], state.numTiers),
    games: 0, consec: 0, status: "normal", pendingRemove: false,
  }));
  state.nextPlayerId = state.players.length;
  state.partnerHist = new Map();
  state.matchHist = new Map();
  state.courts = Array.from({ length: state.numCourts }, (_, i) => ({ no: i + 1, game: null, closing: false }));
  state.nextCourtNo = state.numCourts + 1;
  state.finished = 0;
  state.log = [];
  fillEmptyCourts();
  state.phase = "play";
  render();
}

// A single court finished its game: record it, then either refill it or, if it
// was marked to close, remove it from the rotation entirely.
function finishCourt(no) {
  const court = state.courts.find((c) => c.no === no);
  if (!court || !court.game) return;
  const g = court.game;

  // --- capture debug info BEFORE history sets are updated ---
  const kA = pairKey(g.teamA[0].id, g.teamA[1].id);
  const kB = pairKey(g.teamB[0].id, g.teamB[1].id);
  const tierA = g.teamA[0].tier + g.teamA[1].tier;
  const tierB = g.teamB[0].tier + g.teamB[1].tier;
  const busyNow = playingIds();
  state.log.push({
    n: state.finished + 1,
    court: court.no,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    teamA: g.teamA.map((p) => ({ name: p.name, tier: p.tier, games: p.games })),
    teamB: g.teamB.map((p) => ({ name: p.name, tier: p.tier, games: p.games })),
    tierA, tierB, diff: Math.abs(tierA - tierB),
    repeatA: cnt(state.partnerHist, kA),
    repeatB: cnt(state.partnerHist, kB),
    repeatMatch: cnt(state.matchHist, matchKey(g.teamA, g.teamB)),
    sat: state.players
      .filter((p) => p.status !== "break" && !busyNow.has(p.id))
      .map((p) => p.name),
    onBreak: state.players.filter((p) => p.status === "break").map((p) => p.name),
  });

  inc(state.partnerHist, kA);
  inc(state.partnerHist, kB);
  inc(state.matchHist, matchKey(g.teamA, g.teamB));
  const played = new Set([...g.teamA, ...g.teamB].map((p) => p.id));
  state.players.forEach((p) => {
    if (played.has(p.id)) { p.games++; p.consec++; }
  });
  state.finished++;
  court.game = null;
  if (court.closing) {
    state.courts = state.courts.filter((c) => c !== court);
  } else {
    fillCourt(court);
  }
  render();
}

// Cycle player status: normal -> keen -> break -> normal
function cycleStatus(id) {
  const p = state.players.find((x) => x.id === id);
  p.status = p.status === "normal" ? "keen" : p.status === "keen" ? "break" : "normal";
  fillEmptyCourts(); // if a court was waiting for players, try to fill it now
  render();
}

function reshuffleCourt(no) {
  const court = state.courts.find((c) => c.no === no);
  if (!court || court.closing) return;
  court.game = null;
  fillCourt(court);
  render();
}

function reshuffleAll() {
  state.courts.forEach((c) => { if (!c.closing) c.game = null; });
  fillEmptyCourts();
  render();
}

// Add a new court to the rotation (e.g. an extra booking freed up)
function addCourt() {
  state.courts.push({ no: state.nextCourtNo++, game: null, closing: false });
  fillEmptyCourts();
  render();
}

// A court's booking ended. If it's idle, drop it now; if it's mid-game,
// let the current game finish first, then it's removed automatically.
// Tapping again before it closes cancels the closure.
function endCourt(no) {
  const court = state.courts.find((c) => c.no === no);
  if (!court) return;
  if (!court.game) {
    if (confirm(`Remove Court ${no}? It isn't playing right now.`)) {
      state.courts = state.courts.filter((c) => c !== court);
    }
  } else {
    court.closing = !court.closing;
  }
  render();
}

// Change a player's tier mid-session (e.g. they're off their usual game today)
function updatePlayerTier(id, v) {
  const p = state.players.find((x) => x.id === id);
  if (p) p.tier = Number(v);
  render();
}

function updateNewPlayerName(v) { state.newPlayerName = v; }
function updateNewPlayerTier(v) { state.newPlayerTier = v; }

// A late arrival joins the roster mid-session
function addPlayer() {
  const name = state.newPlayerName.trim();
  if (!name) return;
  state.players.push({
    id: state.nextPlayerId++,
    name,
    tier: Math.min(Number(state.newPlayerTier) || 1, state.numTiers),
    games: 0, consec: 0, status: "normal", pendingRemove: false,
  });
  state.newPlayerName = "";
  state.newPlayerTier = 1;
  fillEmptyCourts();
  render();
}

// Someone leaves early. If they're mid-game they can't be pulled off court,
// so they're flagged to drop out once that game finishes (tap again to undo).
// Idle players are removed immediately, with a confirmation.
function removePlayer(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  if (playingIds().has(id)) {
    p.pendingRemove = !p.pendingRemove;
    render();
    return;
  }
  if (confirm(`Remove ${p.name} from today's roster?`)) {
    state.players = state.players.filter((x) => x.id !== id);
    fillEmptyCourts();
  }
  render();
}

function toggleStats() { state.showStats = !state.showStats; render(); }
function toggleManage() { state.showManage = !state.showManage; render(); }
function toggleHelp() { state.showHelp = !state.showHelp; render(); }
function setHelpLang(l) { state.helpLang = l; render(); }

const HELP = {
  en: {
    title: "How to use",
    sections: [
      ["Before you start (organiser only)", [
        "<b>Courts</b> — how many courts you booked.",
        "<b>Skill tiers</b> — set 1 if everyone is about the same level. Set 2–5 to split by strength, where <b>Tier 1 = strongest</b>.",
        "<b>Players</b> — use +/− to set how many people came, type each name, and choose their tier.",
        "Tap <b>Start play day</b>. One phone runs the app for the whole group."
      ]],
      ["Playing a game", [
        "Each court card shows the two teams on either side of the dashed net. Go play — the app doesn't track scores.",
        "When that court's game ends, tap <b>✓ Court N finished</b>. That court instantly gets 4 new players, chosen from everyone who is free.",
        "Courts are independent. If Court 1 finishes early, tap its button — Court 2 keeps playing undisturbed.",
        "<b>↻ Remix</b> redraws one court's game (only before you start playing it). <b>↻ All</b> redraws every court."
      ]],
      ["Taking a break or asking to play", [
        "Tap your name chip to cycle through three states:",
        "<b>plain</b> — normal, you're in the rotation.",
        "<b>⚡ keen</b> — you want to play next; you get priority for the next free spot.",
        "<b>☕ break</b> — you're resting and won't be picked until you tap back to normal.",
        "<b>🔥</b> next to a name just means that person has played 2+ games in a row."
      ]],
      ["Adjusting on the fly", [
        "<b>+ Court</b> adds a court mid-session (an extra booking freed up).",
        "<b>✕ End</b> on a court removes it. If it's empty it's removed straight away; if a game is in progress, it finishes that game first, then closes — tap it again before that to cancel.",
        "<b>Players</b> panel: add someone who arrives late, change a player's tier if they're clearly off their usual level today, or remove someone leaving early. Removing a player mid-game just flags them to drop out once that game ends."
      ]],
      ["The two panels", [
        "<b>Stats</b> — how many games each person has played today, so nobody feels benched.",
        "<b>Log</b> — every finished match with team tiers and balance info. Mostly for checking the app is mixing properly."
      ]],
      ["Good to know", [
        "The app picks fair, balanced games automatically: everyone plays roughly the same number of games, teams are matched by tier, and it avoids repeating the same partners and matchups.",
        "<b>Don't refresh the page mid-session</b> — the day's history lives in the page and would reset.",
        "Add the link to your home screen so it opens like a normal app."
      ]]
    ]
  },
  vi: {
    title: "Hướng dẫn sử dụng",
    sections: [
      ["Trước khi bắt đầu (người tổ chức)", [
        "<b>Courts</b> — số sân bạn đã đặt.",
        "<b>Skill tiers</b> — chọn 1 nếu mọi người trình độ ngang nhau. Chọn 2–5 để chia theo trình độ, <b>Tier 1 = mạnh nhất</b>.",
        "<b>Players</b> — dùng +/− để chỉnh số người, nhập tên và chọn tier cho từng người.",
        "Bấm <b>Start play day</b>. Chỉ cần một điện thoại chạy app cho cả nhóm."
      ]],
      ["Khi chơi", [
        "Mỗi thẻ sân hiển thị hai đội ở hai bên lưới. Cứ vào chơi — app không ghi điểm.",
        "Khi sân đó đánh xong, bấm <b>✓ Court N finished</b>. Sân đó sẽ được xếp ngay 4 người mới trong số những người đang rảnh.",
        "Các sân độc lập với nhau. Nếu sân 1 xong sớm, cứ bấm nút của sân 1 — sân 2 vẫn chơi bình thường.",
        "<b>↻ Remix</b> xếp lại trận của một sân (chỉ nên dùng trước khi vào chơi). <b>↻ All</b> xếp lại tất cả các sân."
      ]],
      ["Nghỉ hoặc xin được chơi", [
        "Bấm vào tên mình để đổi qua lại giữa ba trạng thái:",
        "<b>bình thường</b> — vẫn nằm trong vòng xoay.",
        "<b>⚡ keen</b> — muốn chơi tiếp; sẽ được ưu tiên vào trận kế.",
        "<b>☕ break</b> — đang nghỉ, sẽ không bị xếp trận cho tới khi bấm về bình thường.",
        "<b>🔥</b> bên cạnh tên nghĩa là người đó đã chơi 2 trận liên tiếp trở lên."
      ]],
      ["Điều chỉnh giữa buổi", [
        "<b>+ Court</b> thêm một sân giữa buổi (khi có thêm sân trống).",
        "<b>✕ End</b> trên một sân sẽ xoá sân đó. Nếu sân đang trống thì xoá ngay; nếu đang có trận thì đợi trận đó xong rồi mới đóng sân — bấm lại trước đó để huỷ.",
        "Bảng <b>Players</b>: thêm người đến muộn, đổi tier cho ai đó nếu hôm nay họ chơi khác hẳn trình độ thường ngày, hoặc xoá người về sớm. Xoá một người đang thi đấu chỉ đánh dấu để họ rời sau khi trận đó kết thúc."
      ]],
      ["Hai bảng thông tin", [
        "<b>Stats</b> — số trận mỗi người đã chơi hôm nay, để không ai bị thiệt.",
        "<b>Log</b> — lịch sử các trận đã xong kèm thông tin cân bằng. Chủ yếu để kiểm tra app chia đội có hợp lý không."
      ]],
      ["Lưu ý", [
        "App tự động chia trận công bằng: ai cũng được chơi số trận gần bằng nhau, hai đội được cân theo tier, và hạn chế lặp lại cùng cặp đôi hoặc cùng cặp đấu.",
        "<b>Đừng refresh trang giữa buổi</b> — lịch sử buổi chơi nằm trong trang và sẽ bị xoá.",
        "Thêm link vào màn hình chính để mở như một app bình thường."
      ]]
    ]
  }
};

function renderHelp() {
  const h = HELP[state.helpLang];
  let html = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="label">${h.title}</div>
      <div style="display:flex;gap:6px">
        <button class="mini-btn${state.helpLang === "en" ? " on" : ""}" onclick="setHelpLang('en')">EN</button>
        <button class="mini-btn${state.helpLang === "vi" ? " on" : ""}" onclick="setHelpLang('vi')">VI</button>
      </div>
    </div>`;
  for (const [heading, items] of h.sections) {
    html += `<div class="help-sec"><div class="help-h">${heading}</div><ul class="help-ul">`;
    for (const it of items) html += `<li>${it}</li>`;
    html += `</ul></div>`;
  }
  html += `<button class="btn subtle" style="width:100%;margin-top:6px" onclick="toggleHelp()">Close</button></div>`;
  return html;
}
function toggleLog() { state.showLog = !state.showLog; render(); }

// Plain-text dump of the whole day, for pasting elsewhere while debugging
function logAsText() {
  const nm = (t) => t.map((p) => p.name + " (T" + p.tier + ")").join(" + ");
  const lines = state.log.map((e) => {
    const flags = [];
    if (e.diff > 0) flags.push("IMBALANCE " + e.diff);
    if (e.repeatA) flags.push(`team A repeated (x${e.repeatA} before)`);
    if (e.repeatB) flags.push(`team B repeated (x${e.repeatB} before)`);
    if (e.repeatMatch) flags.push(`MATCHUP REPEATED (x${e.repeatMatch} before)`);
    return `#${e.n} [${e.time}] Court ${e.court}\n` +
      `   ${nm(e.teamA)}  (tier sum ${e.tierA})\n` +
      `   vs ${nm(e.teamB)}  (tier sum ${e.tierB})\n` +
      `   ${flags.length ? flags.join(", ") : "balanced, all fresh"}\n` +
      `   waiting: ${e.sat.join(", ") || "-"}` +
      (e.onBreak.length ? ` | break: ${e.onBreak.join(", ")}` : "");
  });
  const tally = [...state.players]
    .sort((a, b) => b.games - a.games)
    .map((p) => `${p.name}: ${p.games}`).join(", ");
  return `Court Balancer log — ${state.log.length} games\n\n` +
    lines.join("\n\n") + `\n\nGames per player: ${tally}`;
}

function copyLog() {
  const txt = logAsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => alert("Log copied to clipboard."),
      () => window.prompt("Copy the log below:", txt)
    );
  } else {
    window.prompt("Copy the log below:", txt);
  }
}

function resetDay() {
  if (confirm("Reset the whole play day? All stats and history will be cleared.")) {
    state.phase = "setup";
    render();
  }
}

// ---------------- rendering ----------------
// Pick a column count (max 3) that leaves the fewest empty slots in the last
// row, so e.g. 4 courts lay out as a clean 2x2 instead of 3 + 1 orphan.
function courtCols(n) {
  if (n <= 1) return 1;
  if (n <= 3) return n;
  let best = 3, bestEmpty = Infinity;
  for (const cols of [3, 2]) {
    const rem = n % cols;
    const empty = rem === 0 ? 0 : cols - rem;
    if (empty < bestEmpty) { best = cols; bestEmpty = empty; }
  }
  return best;
}
function tierDots(tier, max) {
  if (max <= 1) return "";
  const on = "●".repeat(max - tier + 1);
  const off = "●".repeat(tier - 1);
  return '<span class="dots">' + on + '<span class="off">' + off + "</span></span>";
}
function badges(p, tired) {
  let b = "";
  if (p.pendingRemove) b += ' <span title="Leaving after this game">🚪</span>';
  if (p.status === "keen") b += ' <span title="Wants to play">⚡</span>';
  if (tired.has(p.id)) b += ' <span title="Played 2+ in a row">🔥</span>';
  return b;
}

function renderSetup() {
  const s = state;
  let html = `
    <div id="app-header">
      <div style="font-size:46px">🏸</div>
      <h1>Court Balancer</h1>
      <p class="sub">Fair doubles rotations, balanced by skill · v7</p>
      <button class="mini-btn" style="margin-top:10px" onclick="toggleHelp()">? How to use / Hướng dẫn</button>
    </div>
    <div class="row" style="margin-top:18px">
      <div class="stepper">
        <div class="label">Courts</div>
        <div class="controls">
          <button class="btn subtle" onclick="bump('numCourts',-1,1,6)">−</button>
          <span class="val">${s.numCourts}</span>
          <button class="btn subtle" onclick="bump('numCourts',1,1,6)">+</button>
        </div>
      </div>
      <div class="stepper">
        <div class="label">Skill tiers</div>
        <div class="controls">
          <button class="btn subtle" onclick="bump('numTiers',-1,1,10)">−</button>
          <span class="val">${s.numTiers}</span>
          <button class="btn subtle" onclick="bump('numTiers',1,1,10)">+</button>
        </div>
      </div>
    </div>`;
  if (s.showHelp) html += renderHelp();
  if (s.numTiers > 1) {
    html += `<p class="hint">Tier 1 = strongest. More dots ● = stronger player.</p>`;
  }
  html += `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="label">Players (${s.names.length})</div>
      <div style="display:flex;gap:8px">
        <button class="btn subtle" onclick="setPlayerCount(${s.names.length - 1})">−</button>
        <button class="btn subtle" onclick="setPlayerCount(${s.names.length + 1})">+</button>
      </div>
    </div>`;
  s.names.forEach((n, i) => {
    html += `<div class="player-row">
      <input type="text" value="${esc(n)}" placeholder="Player ${i + 1}"
        oninput="updateName(${i}, this.value)">`;
    if (s.numTiers > 1) {
      html += `<select onchange="updateTier(${i}, this.value)">`;
      for (let t = 1; t <= s.numTiers; t++) {
        const sel = Math.min(s.tiers[i], s.numTiers) === t ? "selected" : "";
        html += `<option value="${t}" ${sel}>Tier ${t}</option>`;
      }
      html += `</select>`;
    }
    html += `</div>`;
  });
  html += `</div>
    <div class="center" style="margin-top:16px;padding-bottom:30px">
      <button class="btn big" onclick="startDay()">Start play day →</button>`;
  if (s.names.length < s.numCourts * 4) {
    html += `<p class="warn">Heads up: ${s.names.length} players can fill ${Math.floor(s.names.length / 4)} court(s) at a time.</p>`;
  }
  html += `</div>`;
  return html;
}

function renderManage() {
  const s = state;
  const busy = playingIds();
  let html = `<div class="card">
    <div class="label" style="margin-bottom:8px">Manage players</div>`;
  for (const p of s.players) {
    const status = p.pendingRemove
      ? '<span style="color:var(--danger)">leaving after this game…</span>'
      : p.status === "break" ? '<span style="color:var(--rest)">on break</span>'
      : busy.has(p.id) ? '<span style="color:var(--keen)">on court</span>'
      : '<span style="color:var(--dim)">waiting</span>';
    html += `<div class="player-row" style="align-items:center">
      <div style="flex:1">
        <div style="font-weight:700">${esc(p.name)}</div>
        <div style="font-size:11px">${status}</div>
      </div>`;
    if (s.numTiers > 1) {
      html += `<select onchange="updatePlayerTier(${p.id}, this.value)">`;
      for (let t = 1; t <= s.numTiers; t++) {
        html += `<option value="${t}" ${p.tier === t ? "selected" : ""}>Tier ${t}</option>`;
      }
      html += `</select>`;
    }
    html += `<button class="mini-btn" onclick="removePlayer(${p.id})">${p.pendingRemove ? "Undo" : "Remove"}</button>
    </div>`;
  }
  html += `<div class="player-row" style="margin-top:10px">
    <input type="text" value="${esc(s.newPlayerName)}" placeholder="New player name"
      oninput="updateNewPlayerName(this.value)">`;
  if (s.numTiers > 1) {
    html += `<select onchange="updateNewPlayerTier(this.value)">`;
    for (let t = 1; t <= s.numTiers; t++) {
      html += `<option value="${t}" ${Number(s.newPlayerTier) === t ? "selected" : ""}>Tier ${t}</option>`;
    }
    html += `</select>`;
  }
  html += `<button class="btn subtle" onclick="addPlayer()">+ Add</button>
  </div>
  <p class="hint" style="font-size:11px">Removing someone mid-game marks them "leaving after this game" — they drop out once that court finishes (tap again to undo). Idle players are removed right away, with a confirmation.</p>
  </div>`;
  return html;
}

function renderPlay() {
  const s = state;
  const busy = playingIds();
  const waiting = s.players.filter((p) => p.status !== "break" && !busy.has(p.id));
  const breakPlayers = s.players.filter((p) => p.status === "break");
  const tired = new Set(s.players.filter((p) => p.consec >= 2).map((p) => p.id));

  let html = `
    <div class="header-bar">
      <div>
        <div class="label" style="letter-spacing:2px">Games done · v7</div>
        <div style="font-size:34px;font-weight:800;line-height:1;color:var(--accent)">${s.finished}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn ghost" onclick="addCourt()">+ Court</button>
        <button class="btn ghost" onclick="reshuffleAll()">↻ All</button>
        <button class="btn ghost" onclick="toggleManage()">${s.showManage ? "Hide" : "Players"}</button>
        <button class="btn ghost" onclick="toggleStats()">${s.showStats ? "Hide" : "Stats"}</button>
        <button class="btn ghost" onclick="toggleLog()">${s.showLog ? "Hide" : "Log"}</button>
        <button class="btn ghost" onclick="toggleHelp()" title="How to use">?</button>
      </div>
    </div>`;

  if (s.showHelp) html += renderHelp();

  html += `<div class="courts-grid" style="grid-template-columns: repeat(${courtCols(s.courts.length)}, 1fr)">`;
  for (const court of s.courts) {
    const g = court.game;
    if (!g) {
      html += `<div class="match-card center" style="color:var(--dim)">
        <div class="court-head" style="justify-content:center;position:relative">
          <div class="court-label">Court ${court.no}</div>
          <button class="mini-btn" style="position:absolute;right:0" onclick="endCourt(${court.no})" title="Remove this court">✕ End</button>
        </div>
        <div style="font-size:34px;margin:10px 0 6px">💤</div>
        <div style="font-size:15px">Waiting — need 4 free players here.</div>
      </div>`;
      continue;
    }
    const teamHtml = (team, right) =>
      `<div class="team${right ? " right" : ""}">` +
      team.map((p) =>
        `<div class="p">${esc(p.name)}${badges(p, tired)}</div>`
      ).join("") + `</div>`;
    html += `<div class="match-card">
      <div class="court-head">
        <div class="court-label">Court ${court.no}${court.closing ? ' <span style="color:var(--danger);text-transform:none;letter-spacing:0;font-size:11px">· closing</span>' : ""}</div>
        <div style="display:flex;gap:6px">
          ${court.closing ? "" : `<button class="mini-btn" onclick="reshuffleCourt(${court.no})" title="Redo this game">↻ Remix</button>`}
          <button class="mini-btn" onclick="endCourt(${court.no})" title="${court.closing ? "Cancel closing" : "Close this court after this game"}">${court.closing ? "↩ Keep open" : "✕ End"}</button>
        </div>
      </div>
      <div class="teams">
        ${teamHtml(g.teamA, false)}
        <div class="net"><span>VS</span></div>
        ${teamHtml(g.teamB, true)}
      </div>
      <button class="btn court-done" onclick="finishCourt(${court.no})">✓ Court ${court.no} finished — ${court.closing ? "closing this court" : "next game here"}</button>
    </div>`;
  }

  html += `</div>`;

  if (waiting.length > 0) {
    html += `<div class="card" style="background:var(--card-lite)">
      <div class="label" style="margin-bottom:6px">Waiting to play</div>
      <div style="font-size:18px;font-weight:600">${waiting.map((p) => esc(p.name) + (p.status === "keen" ? " ⚡" : "")).join(", ")}</div>
    </div>`;
  }

  if (s.showManage) html += renderManage();

  html += `<div class="card">
    <div class="label" style="margin-bottom:8px">Player status — tap to cycle</div>
    <div class="chips">`;
  for (const p of s.players) {
    const cls = p.status === "break" ? " break" : p.status === "keen" ? " keen" : "";
    const icon = p.status === "break" ? "☕ " : p.status === "keen" ? "⚡ " : "";
    html += `<button class="chip${cls}" onclick="cycleStatus(${p.id})">
      ${icon}${esc(p.name)}${tired.has(p.id) && p.status !== "break" ? " 🔥" : ""}</button>`;
  }
  html += `</div>
    <div class="legend">
      <span>plain = normal</span>
      <span style="color:var(--keen)">⚡ = wants to play (priority)</span>
      <span style="color:var(--rest)">☕ = on break</span>
      <span>🔥 = 2+ games in a row</span>
    </div>
    <p class="hint" style="font-size:11px">Status changes apply when a court picks its next game. If a game hasn't started yet and you want to redo it, use ↻ Remix on that court.</p>
  </div>`;

  if (s.showStats) {
    html += `<div class="card"><div class="label" style="margin-bottom:8px">Games played today</div>`;
    for (const p of [...s.players].sort((a, b) => b.games - a.games)) {
      const st = p.status === "break" ? ' <span style="color:var(--rest)">· on break</span>'
               : p.status === "keen" ? ' <span style="color:var(--keen)">· keen ⚡</span>' : "";
      html += `<div class="stat-row">
        <span>${esc(p.name)}${tierDots(p.tier, s.numTiers)}${st}</span>
        <span style="font-weight:700">${p.games} ${p.consec >= 2 ? "🔥" : ""}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (s.showLog) {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="label">Match history (${s.log.length})</div>
        <button class="mini-btn" onclick="copyLog()" ${s.log.length ? "" : "disabled"}>⧉ Copy as text</button>
      </div>`;
    if (s.log.length === 0) {
      html += `<p class="hint" style="margin:0">No games finished yet.</p>`;
    }
    for (const e of [...s.log].reverse()) {
      const nm = (t) => t.map((p) => esc(p.name) + (s.numTiers > 1 ? `<span style="color:var(--dim)"> T${p.tier}</span>` : "")).join(" + ");
      const flags = [];
      if (e.diff > 0) flags.push(`<span style="color:var(--danger)">imbalance ${e.diff}</span>`);
      if (e.repeatA || e.repeatB) flags.push(`<span style="color:var(--rest)">repeat team (x${Math.max(e.repeatA, e.repeatB)})</span>`);
      if (e.repeatMatch) flags.push(`<span style="color:var(--danger)">repeat matchup (x${e.repeatMatch})</span>`);
      if (!flags.length) flags.push(`<span style="color:var(--accent)">balanced · all fresh</span>`);
      html += `<div class="log-row">
        <div class="log-head">#${e.n} · Court ${e.court} · ${e.time}</div>
        <div class="log-teams">${nm(e.teamA)} <span style="color:var(--dim)">(${e.tierA})</span>
          <span style="color:var(--dim)"> vs </span>
          ${nm(e.teamB)} <span style="color:var(--dim)">(${e.tierB})</span></div>
        <div class="log-meta">${flags.join(" · ")}</div>
        <div class="log-meta">waiting: ${e.sat.map(esc).join(", ") || "—"}${e.onBreak.length ? " | break: " + e.onBreak.map(esc).join(", ") : ""}</div>
      </div>`;
    }
    html += `<p class="hint" style="font-size:11px">"imbalance N" = difference in combined tier numbers between the two sides (0 is perfect). Repeat flags mean the algorithm had to reuse a team or matchup because nothing fresher was available.</p>
    </div>`;
  }

  html += `<div class="center" style="margin-top:18px">
    <button class="btn danger" onclick="resetDay()">End / reset play day</button>
  </div>`;
  return html;
}

function render() {
  sweepPendingRemovals();
  const el = document.getElementById("root");
  el.className = "wrap" + (state.phase === "play" ? " wide" : "");
  el.innerHTML = state.phase === "setup" ? renderSetup() : renderPlay();
}
render();
