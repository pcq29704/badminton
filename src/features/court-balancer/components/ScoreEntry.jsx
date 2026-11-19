import { playerInfo } from "./Shared";
import { eloChanges, formatDelta, kFor, parseScore, resultLabel, scoreProblem } from "../scoring.mjs";

// The typed score for a game: numbers (null if not a whole number), why it can't be saved yet,
// and which side is ahead (for the green highlight).
export function readScore(state, gameId) {
  const draft = state.scoreDrafts[gameId] || { a: "", b: "" };
  const a = parseScore(draft.a), b = parseScore(draft.b);
  const empty = !draft.a.trim() || !draft.b.trim();
  const problem = empty ? "" : scoreProblem(a, b, state.settings);
  const leader = a != null && b != null && a !== b ? (a > b ? "A" : "B") : "";
  return { draft, a, b, empty, problem, leader, valid: !empty && !problem };
}

const teamNames = (team) => team.map((p) => p.name).join(" & ");
export const winnerFirst = (a, b) => `${Math.max(a, b)}–${Math.min(a, b)}`;

// Two number boxes (team A, team B). On a court, courtNo tags them so the keyboard can move
// between boxes, courts and the Finish button (see PlayScreen).
export function ScoreBoxes({ state, actions, gameId, names, courtNo }) {
  const s = readScore(state, gameId);
  const box = (side, label) => <input
    className={`cb-input cb-org-score${s.leader === side ? " leading" : ""}`}
    type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3} placeholder="–"
    enterKeyHint={side === "A" ? "next" : "done"}
    data-court={courtNo} data-score={courtNo != null ? side.toLowerCase() : undefined}
    aria-label={`Score for ${label}`} aria-invalid={Boolean(s.problem)}
    value={s.draft[side.toLowerCase()]}
    onFocus={(event) => event.target.select()}
    onChange={(event) => actions.setScore(gameId, side.toLowerCase(), event.target.value)} />;
  return <div className="cb-org-score-row">{box("A", names[0])}<span className="cb-org-score-dash" aria-hidden="true">–</span>{box("B", names[1])}</div>;
}

// The line under the boxes. `quiet` (on a court) shows only a problem, to keep the card short.
export function ScoreMessage({ state, gameId, quiet = false }) {
  const s = readScore(state, gameId);
  const cap = state.settings?.cap_points ?? CAP_POINTS;
  const text = s.problem || (quiet ? "" : s.empty ? `Enter each team's final score (0–${cap})` : resultLabel(s.a, s.b));
  return <p className={`cb-org-score-msg${s.problem ? " bad" : ""}${quiet ? " quiet" : ""}`} aria-live="polite">{text}</p>;
}

export function ScoreInputs({ state, actions, gameId, names }) {
  return <>
    <ScoreBoxes state={state} actions={actions} gameId={gameId} names={names} />
    <ScoreMessage state={state} gameId={gameId} />
  </>;
}

// "+13.3 each" when the whole team moves the same, otherwise per player
function teamDelta(team, changes) {
  const deltas = changes.map((c) => formatDelta(c.delta));
  return deltas.every((d) => d === deltas[0]) ? `${deltas[0]} each` : team.map((p, i) => `${p.name} ${deltas[i]}`).join(", ");
}

// Restates the result in words before anything is saved. Finishing a game shows the score typed
// on the court; editing a past game shows the score boxes here.
export function ScoreSheet({ state, actions }) {
  const sheet = state.scoreSheet;
  if (!sheet) return null;
  const correcting = sheet.kind === "correct";
  const entry = correcting ? state.log.find((e) => e.gameId === sheet.gameId) : null;
  const game = correcting ? null : state.courts.find((c) => c.game?.id === sheet.gameId)?.game;
  if (!entry && !game) return null;

  // Ratings the preview starts from: a finished game uses its stored before-values and K
  const live = (id) => { const p = playerInfo(state, id); return { id, name: p.name, elo: Number(p.elo), k: kFor(p.gamesTotal, state.settings) }; };
  const logged = (p) => ({ id: p.id, name: p.name, elo: p.before, k: p.k });
  const teamA = entry ? entry.teamA.map(logged) : game.teamA.map(live);
  const teamB = entry ? entry.teamB.map(logged) : game.teamB.map(live);
  const ranked = (entry || game).ranked;

  const s = readScore(state, sheet.gameId);
  const canPreview = s.valid && ranked && [...teamA, ...teamB].every((p) => p.k != null && Number.isFinite(p.elo));
  const preview = canPreview ? eloChanges(teamA, teamB, s.a, s.b, state.settings) : null;
  const aWon = s.a > s.b;
  const [winners, losers] = aWon ? [teamA, teamB] : [teamB, teamA];
  const ratings = preview
    ? `${teamDelta(winners, aWon ? preview.teamA : preview.teamB)} / ${teamDelta(losers, aWon ? preview.teamB : preview.teamA)}`
    : ranked ? "Ratings update when saved" : "Unranked · ratings unchanged";

  return <div className="cb-org-sheet-backdrop" onClick={actions.closeScoreSheet}>
    <section className="cb-org-sheet" role="dialog" aria-modal="true" aria-labelledby="score-sheet-title"
      onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") actions.closeScoreSheet(); }}>
      <h2 id="score-sheet-title" className="cb-org-label">{correcting ? "Edit score" : "Confirm result"} · Court {sheet.courtNo}</h2>
      {correcting && <ScoreInputs state={state} actions={actions} gameId={sheet.gameId} names={[teamNames(teamA), teamNames(teamB)]} />}
      {s.valid && <div className="cb-org-sheet-result">
        <p><b>{teamNames(winners)}</b> beat <b>{teamNames(losers)}</b>, {winnerFirst(s.a, s.b)}</p>
        <p className="cb-org-sheet-sub">{resultLabel(s.a, s.b)} · {ratings}</p>
      </div>}
      <div className="cb-org-sheet-actions">
        <button className="cb-btn quiet" onClick={actions.closeScoreSheet}>{correcting ? "Cancel" : "Edit"}</button>
        <button className="cb-btn" disabled={state.busy || !s.valid} onClick={actions.confirmScore} autoFocus={!correcting}>Confirm</button>
      </div>
    </section>
  </div>;
}
