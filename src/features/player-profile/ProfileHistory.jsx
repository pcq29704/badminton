import MatchCard from "../../components/MatchCard";

export default function ProfileHistory({ games, username }) {
  if (!games.length) return <p className="ds-empty">No finished games yet.</p>;
  return <ol className="ds-dp-list">{games.map((game, index) => <MatchCard
    key={`${game.ended_at}-${index}`}
    game={game}
    focus={username}
    meta={<span>{game.ended_at ? new Date(game.ended_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</span>}
  />)}</ol>;
}
