import { Fragment } from "react";
import { profileHref } from "../court-balancer/helpers";

export default function ProfileHistory({ games }) {
  if (!games.length) return <p className="hint">No finished games yet.</p>;
  function side(players) {
    return players.map((player, index) => <Fragment key={`${player.username || player.name}-${index}`}>
      {index > 0 && " + "}{player.username ? <a href={profileHref(player.username)}>{player.name}</a> : player.name}
    </Fragment>);
  }
  return <div className="profile-history">{games.map((game, index) => <article className="profile-game" key={`${game.ended_at}-${index}`}>
    <div className="log-head">{game.ended_at ? new Date(game.ended_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</div>
    <div className={`profile-game-team${game.winner === "A" ? " won" : ""}`}>Team A · {side(game.team_a || [])}{game.winner === "A" ? " 🏆" : ""}</div>
    <div className={`profile-game-team${game.winner === "B" ? " won" : ""}`}>Team B · {side(game.team_b || [])}{game.winner === "B" ? " 🏆" : ""}</div>
    <div className="log-meta">Team {game.winner} won</div>
  </article>)}</div>;
}
