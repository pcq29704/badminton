import { fmtLeft } from "../helpers";
import { PlayerTag, StreakBadge, playerInfo } from "./Shared";
import { ScoreInputs, readScore } from "./ScoreEntry";

export default function CourtCard({ court, state, actions, tired, streaks }) {
  const game = court.game;
  if (!game) return <section className="ds-org-court idle">
    <div className="ds-org-court-head">
      <h2 className="ds-org-court-label">Court {court.no}</h2>
      <button className="ds-btn tertiary ds-org-mini" onClick={() => actions.endCourt(court.no)} title="Remove this court">✕ End</button>
    </div>
    <div className="ds-org-idle">
      <div className="ds-org-idle-icon" aria-hidden="true">{court.holdStartedAt ? "⏳" : "💤"}</div>
      {court.holdStartedAt ? <>
        <p>Holding — waiting for the other courts to finish</p>
        <div className="ds-org-countdown">{fmtLeft(Date.parse(court.holdStartedAt) + (state.settings?.hold_minutes ?? 10) * 60000 - state.now)}</div>
        <button className="ds-btn tertiary ds-org-mini" onClick={actions.fillNow}>▶ Fill now</button>
      </> : <p>Waiting — need 4 free players here.</p>}
    </div>
  </section>;

  const score = readScore(state, game.id);
  const names = (ids) => ids.map((id) => playerInfo(state, id).name).join(" & ");

  function team(ids, side, leading) {
    return <div className={`ds-org-team ${side}${leading ? " leading" : ""}`}>{ids.map((id) => {
      const player = playerInfo(state, id);
      return <PlayerTag key={id} player={player} size="lg">
        <span className="ds-org-flags">
          <StreakBadge count={streaks.get(id) || 0} />
          {player.pendingRemove && <span title="Leaving after this game">🚪</span>}
          {player.status === "keen" && <span title="Wants to play">⚡</span>}
          {tired.has(id) && <span title="Played 2+ in a row">💃</span>}
        </span>
      </PlayerTag>;
    })}</div>;
  }

  return <section className="ds-org-court">
    <div className="ds-org-court-head">
      <h2 className="ds-org-court-label">Court {court.no} <span className="ds-dp-tag">{game.ranked ? "Ranked" : "Unranked"}</span>{court.closing && <span className="ds-org-closing">closing after this game</span>}</h2>
      <div className="ds-org-actions">{!court.closing && <button className="ds-btn tertiary ds-org-mini" onClick={() => actions.reshuffleCourt(court.no)} title="Redraw this game">↻ Remix</button>}<button className="ds-btn tertiary ds-org-mini" onClick={() => actions.endCourt(court.no)}>{court.closing ? "↩ Keep open" : "✕ End"}</button></div>
    </div>
    <div className="ds-org-teams">{team(game.teamA, "left", score.leader === "A")}<span className="ds-org-vs" aria-label="versus">vs</span>{team(game.teamB, "right", score.leader === "B")}</div>
    <ScoreInputs state={state} actions={actions} gameId={game.id} names={[names(game.teamA), names(game.teamB)]} />
    <button className="ds-btn blue block ds-org-win" disabled={state.busy || !score.valid} onClick={() => actions.reviewScore(court.no)}>Finish</button>
  </section>;
}
