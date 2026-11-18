import { Card } from "@/components/ui";
import { fmtLeft } from "../helpers";
import { MoreMenu, PlayerTag, RunBadge, StreakBadge, playerInfo } from "./Shared";
import { ScoreBoxes, ScoreMessage, readScore } from "./ScoreEntry";

// Compact density only (see PlayScreen): the court number on the left, which opens the court's
// actions, so the card loses its head row. The roomy head stays in the markup and CSS shows one.
function CourtRail({ court, items }) {
  return <div className="cb-org-rail">
    <MoreMenu className="start" summaryClass="cb-org-rail-no" label={court.no} ariaLabel={`Court ${court.no} actions`} items={items} />
    {court.closing && <span className="cb-org-closing">closing</span>}
  </div>;
}

// One court as a versus strip: team A | score boxes and Finish | team B.
// Keyboard: the score boxes carry data-court / data-score, and PlayScreen moves focus between them.
export default function CourtCard({ court, state, actions, runs, streaks }) {
  const game = court.game;
  if (!game) return <Card className="cb-court idle">
    <CourtRail court={court} items={[{ label: "End court", onClick: () => actions.endCourt(court.no), danger: true }]} />
    <div className="cb-org-court-head">
      <h2 className="cb-org-court-label">Court {court.no}</h2>
      <button className="cb-btn quiet mini" onClick={() => actions.endCourt(court.no)} title="Remove this court">End</button>
    </div>
    <div className="cb-org-idle">
      {court.holdStartedAt ? <>
        <p>Holding for the other courts</p>
        <span className="cb-org-countdown">{fmtLeft(Date.parse(court.holdStartedAt) + (state.settings?.hold_minutes ?? 10) * 60000 - state.now)}</span>
        <button className="cb-btn quiet mini" onClick={actions.fillNow}>Fill now</button>
      </> : <p>Waiting — need 4 free players here.</p>}
    </div>
  </Card>;

  const score = readScore(state, game.id);
  const names = (ids) => ids.map((id) => playerInfo(state, id).name).join(" & ");

  function team(ids, side, leading) {
    return <div className={`cb-org-team ${side}${leading ? " leading" : ""}`}>{ids.map((id) => {
      const player = playerInfo(state, id);
      return <PlayerTag key={id} player={player} size="sm">
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
    <CourtRail court={court} items={[
      !court.closing && { label: "Remix", onClick: () => actions.reshuffleCourt(court.no) },
      { label: court.closing ? "Keep open" : "End court", onClick: () => actions.endCourt(court.no), danger: !court.closing },
    ]} />
    <div className="cb-org-court-head">
      <h2 className="cb-org-court-label">Court {court.no} <span className="cb-org-tag">{game.ranked ? "Ranked" : "Unranked"}</span>{court.closing && <span className="cb-org-closing">closing after this game</span>}</h2>
      <div className="cb-org-actions">{!court.closing && <button className="cb-btn quiet mini" onClick={() => actions.reshuffleCourt(court.no)} title="Redraw this game">Remix</button>}<button className="cb-btn quiet mini" onClick={() => actions.endCourt(court.no)}>{court.closing ? "Keep open" : "End"}</button></div>
    </div>
    <div className="cb-org-strip">
      {team(game.teamA, "left", score.leader === "A")}
      <div className="cb-org-strip-mid">
        <ScoreBoxes state={state} actions={actions} gameId={game.id} courtNo={court.no} names={[names(game.teamA), names(game.teamB)]} />
        <button className="cb-btn cb-org-win" disabled={state.busy || !score.valid} onClick={() => actions.reviewScore(court.no)}>Finish</button>
      </div>
      {team(game.teamB, "right", score.leader === "B")}
    </div>
    <ScoreMessage state={state} gameId={game.id} quiet />
  </Card>;
}
