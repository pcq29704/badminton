"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { profileHref } from "../court-balancer/helpers";
import { useClubGames } from "./useClubGames";
import { groupGamesByDay, isDayKey } from "./days.mjs";

function Team({ players }) {
  return players.map((player, index) => <span key={`${player.username || player.name}-${index}`}>
    {index > 0 && " + "}{player.username ? <a href={profileHref(player.username)}>{player.name}</a> : player.name}
  </span>);
}

const back = <a className="ds-back" href="/dashboard">← Dashboard</a>;

export default function DayPage() {
  const { date } = useParams();
  const { loading, viewer, games, error, signOut } = useClubGames();
  const day = useMemo(() => isDayKey(date) ? groupGamesByDay(games).find((entry) => entry.key === date) : null, [games, date]);
  const shell = { current: "dashboard", viewer, onSignOut: signOut };

  if (!hasSupabaseConfig) return <Shell current="dashboard"><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}>{back}<p className="ds-alert error" role="alert">{error}</p></Shell>;
  if (loading) return <Shell current="dashboard"><p className="ds-empty">Loading matches…</p></Shell>;
  if (!day) return <Shell {...shell}>{back}<p className="ds-empty">No games found for this day.</p></Shell>;

  return <Shell {...shell}>
    {back}
    <h1 className="ds-username" style={{ marginTop: 12 }}>{day.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
    <p className="ds-sub">{day.games.length} {day.games.length === 1 ? "game" : "games"} · {day.playerCount} players · {day.rankedCount} ranked</p>
    <div className="ds-table-wrap"><table className="ds-table">
      <caption className="ds-sr">Matches played on {date}</caption>
      <thead><tr><th scope="col">Time</th><th scope="col">Court</th><th scope="col">Team A</th><th scope="col">Team B</th><th scope="col">Winner</th><th scope="col">Type</th></tr></thead>
      <tbody>{day.games.map((game) => <tr key={game.id ?? game.endedAt}>
        <td>{new Date(game.endedAt).toLocaleTimeString([], { timeStyle: "short" })}</td>
        <td>{game.court_no ?? "–"}</td>
        <td className={game.winner === "A" ? "won" : undefined}><Team players={game.team_a} /></td>
        <td className={game.winner === "B" ? "won" : undefined}><Team players={game.team_b} /></td>
        <td>{game.winner ? `Team ${game.winner}` : "–"}</td>
        <td>{game.ranked ? "Ranked" : "Unranked"}</td>
      </tr>)}</tbody>
    </table></div>
  </Shell>;
}
