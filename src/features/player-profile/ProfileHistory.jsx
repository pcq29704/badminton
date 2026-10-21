import { Fragment } from "react";
import { profileHref } from "../court-balancer/helpers";

export default function ProfileHistory({ games }) {
  if (!games.length) return <p className="ds-empty">No finished games yet.</p>;
  function side(players) {
    return players.map((player, index) => <Fragment key={`${player.username || player.name}-${index}`}>
      {index > 0 && " + "}{player.username ? <a href={profileHref(player.username)}>{player.name}</a> : player.name}
    </Fragment>);
  }
  return <div className="ds-games">{games.map((game, index) => <article className="ds-game" key={`${game.ended_at}-${index}`}>
    <div className="ds-game-head"><span>{game.ended_at ? new Date(game.ended_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</span><span>Team {game.winner} won</span></div>
    {["A", "B"].map((team) => <div key={team} className={`ds-game-team${game.winner === team ? " won" : ""}`}>
      <span>Team {team} · {side(game[`team_${team.toLowerCase()}`] || [])}</span>{game.winner === team && <span aria-label="Winner">🏆</span>}
    </div>)}
  </article>)}</div>;
}
