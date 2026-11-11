import { Card } from "@/components/ui";
import { fmtLeft } from "../helpers";
import { PlayerTag, RunBadge, StreakBadge, playerInfo } from "./Shared";
import { ScoreInputs, readScore } from "./ScoreEntry";

export default function CourtCard({ court, state, actions, runs, streaks }) {
  const game = court.game;
  if (!game) return <Card className="cb-court idle">
    <div className="cb-org-court-head">
      <h2 className="cb-org-court-label">Court {court.no}</h2>
      <button className="cb-btn quiet mini" onClick={() => actions.endCourt(court.no)} title="Remove this court">End</button>
    </div>
    <div className="cb-org-idle">
      {court.holdStartedAt ? <>
        <p>Holding — waiting for the other courts to finish</p>
        <div className="cb-org-countdown">{fmtLeft(Date.parse(court.holdStartedAt) + (state.settings?.hold_minutes ?? 10) * 60000 - state.now)}</div>
        <button className="cb-btn quiet mini" onClick={actions.fillNow}>Fill now</button>
      </> : <p>Waiting — need 4 free players here.</p>}
    </div>
  </Card>;

  const score = readScore(state, game.id);
  const names = (ids) => ids.map((id) => playerInfo(state, id).name).join(" & ");

  function team(ids, side, leading) {
    return <div className={`cb-org-team ${side}${leading ? " leading" : ""}`}>{ids.map((id) => {
      const player = playerInfo(state, id);
      return <PlayerTag key={id} player={player} size="lg">
        <span className="cb-org-flags">
          <StreakBadge count={streaks.get(id) || 0} />
          {player.pendingRemove && <span title="Leaving after this game">🚪</span>}
          {player.status === "keen" && <span title="Wants to play">⚡</span>}
          <RunBadge count={runs.get(id)} />
        </span>
      </PlayerTag>;
    })}</div>;
  }

  return <Card className="cb-court">
    <div className="cb-org-court-head">
      <h2 className="cb-org-court-label">Court {court.no} <span className="cb-org-tag">{game.ranked ? "Ranked" : "Unranked"}</span>{court.closing && <span className="cb-org-closing">closing after this game</span>}</h2>
      <div className="cb-org-actions">{!court.closing && <button className="cb-btn quiet mini" onClick={() => actions.reshuffleCourt(court.no)} title="Redraw this game">Remix</button>}<button className="cb-btn quiet mini" onClick={() => actions.endCourt(court.no)}>{court.closing ? "Keep open" : "End"}</button></div>
    </div>
    <div className="cb-org-teams">{team(game.teamA, "left", score.leader === "A")}<span className="cb-org-vs" aria-label="versus">vs</span>{team(game.teamB, "right", score.leader === "B")}</div>
    <ScoreInputs state={state} actions={actions} gameId={game.id} names={[names(game.teamA), names(game.teamB)]} />
    <button className="cb-btn cb-org-win" disabled={state.busy || !score.valid} onClick={() => actions.reviewScore(court.no)}>Finish</button>
  </Card>;
}
