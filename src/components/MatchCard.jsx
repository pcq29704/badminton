import PlayerAvatar from "./PlayerAvatar";
import { profileHref } from "../features/court-balancer/helpers";
import { formatScore, resultLabel } from "../features/court-balancer/scoring.mjs";

export const playerKey = (player) => player.username || player.name;

function Player({ player, me }) {
  const inner = <>
    <PlayerAvatar className="ds-dp-avatar" path={player.profile_image_path} tier={player.tier} />
    <span className="ds-dp-name">{player.name}{me && <span className="ds-dp-you"> (you)</span>}</span>
  </>;
  return player.username
    ? <a className="ds-dp-player" href={profileHref(player.username)}>{inner}</a>
    : <span className="ds-dp-player">{inner}</span>;
}

function Side({ players, won, decided, viewer, focus }) {
  const state = !decided ? "" : won ? " won" : " lost";
  return <div className={`ds-dp-side${state}`}>
    <div className="ds-dp-players">{players.map((player, index) => <div key={`${playerKey(player)}-${index}`} className={focus === playerKey(player) ? "ds-dp-focus" : undefined}>
      <Player player={player} me={Boolean(viewer?.username) && player.username === viewer.username} />
    </div>)}</div>
    {won && <span className="ds-dp-win">Won</span>}
  </div>;
}

// One finished game: a meta line (time, court, tags) above the two teams. The winning side gets the gold fill.
// Players need name and username; profile_image_path and tier show their avatar frame.
// `focus` is a player key to highlight, `viewer` marks the signed-in player with "(you)".
// Games with a score show it between the teams (team A first); older games show "vs".
export default function MatchCard({ game, meta, viewer, focus, as: Tag = "li" }) {
  const decided = Boolean(game.winner);
  const score = formatScore(game.score_a, game.score_b);
  return <Tag className="ds-dp-match">
    <div className="ds-dp-meta">{meta}{score && <span className="ds-dp-label">{resultLabel(game.score_a, game.score_b)}</span>}</div>
    <div className="ds-dp-teams">
      <Side players={game.team_a || []} won={game.winner === "A"} decided={decided} viewer={viewer} focus={focus} />
      {score ? <span className="ds-dp-score" aria-label={`score ${score}`}>{score}</span> : <span className="ds-dp-vs" aria-label="versus">vs</span>}
      <Side players={game.team_b || []} won={game.winner === "B"} decided={decided} viewer={viewer} focus={focus} />
    </div>
  </Tag>;
}
