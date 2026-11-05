import PlayerAvatar from "../PlayerAvatar";
import { profileHref } from "../../features/court-balancer/helpers";

const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

export const playerKey = (player) => player.username || player.name;

function Player({ player, me, you }) {
  const inner = <>
    <PlayerAvatar className="cb-avatar-sm" path={player.profile_image_path} tier={player.tier} name={player.name} />
    <span>{player.name}{you && " (you)"}{me && !you && <span className="cb-sr"> (this player)</span>}</span>
  </>;
  const className = `cb-match-player${me ? " me" : ""}`;
  return player.username
    ? <a className={className} href={profileHref(player.username)}>{inner}</a>
    : <span className={className}>{inner}</span>;
}

function Side({ players, state, them, isMe, isYou, winLabel }) {
  return <div className={`cb-match-side${them ? " them" : ""}${state ? ` ${state}` : ""}`}>
    {players.map((player, index) => <Player key={`${playerKey(player)}-${index}`} player={player} me={isMe(player)} you={isYou(player)} />)}
    {winLabel && state === "won" && <span className="cb-match-won">Won</span>}
  </div>;
}

// One finished game from one player's side (DESIGN.md, Components > Match row): result and time,
// the player's team, "vs", the other team. `focus` is that player's username; their team is shown first.
// Without `focus`, `meta` (number, time, court, tags) takes the result column, team A is on the left and a "Won" tag marks the winning side.
// `focusKey` highlights one player by playerKey(); `viewer` adds "(you)".
export default function MatchRow({ game, focus, when, meta, focusKey, viewer }) {
  if (meta) return <NeutralRow game={game} meta={meta} focusKey={focusKey} viewer={viewer} />;
  const teamA = game.team_a || [];
  const teamB = game.team_b || [];
  const inB = teamB.some((player) => same(player.username, focus));
  const [us, them, ourKey] = inB ? [teamB, teamA, "B"] : [teamA, teamB, "A"];
  const decided = game.winner === "A" || game.winner === "B";
  const won = decided && game.winner === ourKey;
  const result = !decided ? "open" : won ? "won" : "lost";
  return <li className="cb-match">
    <div className={`cb-match-res ${result}`}>
      <b>{result === "won" ? "Won" : result === "lost" ? "Lost" : "No result"}</b>
      <span className="cb-note">{when}</span>
    </div>
    <Side players={us} state={decided ? (won ? "won" : "lost") : ""} isMe={(player) => Boolean(focus) && same(player.username, focus)} isYou={() => false} />
    <span className="cb-match-vs" aria-label="versus">vs</span>
    <Side players={them} state={decided ? (won ? "lost" : "won") : ""} them isMe={() => false} isYou={() => false} />
  </li>;
}

function NeutralRow({ game, meta, focusKey, viewer }) {
  const decided = game.winner === "A" || game.winner === "B";
  const state = (side) => decided ? (game.winner === side ? "won" : "lost") : "";
  const isMe = (player) => Boolean(focusKey) && playerKey(player) === focusKey;
  const isYou = (player) => Boolean(viewer?.username) && same(player.username, viewer.username);
  return <li className="cb-match neutral">
    <div className="cb-match-meta">{meta}</div>
    <Side players={game.team_a || []} state={state("A")} isMe={isMe} isYou={isYou} winLabel />
    <span className="cb-match-vs" aria-label="versus">vs</span>
    <Side players={game.team_b || []} state={state("B")} them isMe={isMe} isYou={isYou} winLabel />
  </li>;
}

// Which side of a game the player was on, and whether they won. Used for the history filter.
export function resultFor(game, username) {
  const inB = (game.team_b || []).some((player) => same(player.username, username));
  if (game.winner !== "A" && game.winner !== "B") return "open";
  return game.winner === (inB ? "B" : "A") ? "won" : "lost";
}
