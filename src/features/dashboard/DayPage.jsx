"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import MatchCard, { playerKey } from "@/components/MatchCard";
import PlayerAvatar from "@/components/PlayerAvatar";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { useClubGames } from "./useClubGames";
import { groupGamesByDay, isDayKey } from "./days.mjs";

const timeLabel = (ms) => new Date(ms).toLocaleTimeString([], { timeStyle: "short" });

// Win and loss count per player for one day. Best record first.
function dayStandings(games) {
  const rows = new Map();
  for (const game of games) {
    for (const [team, side] of [[game.team_a, "A"], [game.team_b, "B"]]) {
      for (const player of team) {
        const key = playerKey(player);
        const row = rows.get(key) || { key, name: player.name, username: player.username, wins: 0, losses: 0 };
        if (game.winner === side) row.wins += 1;
        else if (game.winner) row.losses += 1;
        rows.set(key, row);
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
}

const back = <a className="ds-back" href="/dashboard">← Dashboard</a>;

export default function DayPage() {
  const { date } = useParams();
  const { loading, viewer, games, ranking, error, signOut } = useClubGames();
  const [focus, setFocus] = useState("");
  // On tablets and phones the standings start closed so the matches stay near the top. Desktop always shows them.
  const [standingsOpen, setStandingsOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 960px)").matches);
  const day = useMemo(() => isDayKey(date) ? groupGamesByDay(games).find((entry) => entry.key === date) : null, [games, date]);
  const standings = useMemo(() => day ? dayStandings(day.games) : [], [day]);
  const profiles = useMemo(() => new Map((ranking || []).map((player) => [playerKey(player), player])), [ranking]);
  const shell = { current: "dashboard", viewer, onSignOut: signOut };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}>{back}<p className="ds-alert error" role="alert">{error}</p></Shell>;
  if (loading) return <Shell {...shell}><p className="ds-empty">Loading matches…</p></Shell>;
  if (!day) return <Shell {...shell}>{back}<p className="ds-empty">No games found for this day.</p></Shell>;

  const withProfile = (player) => ({ ...profiles.get(playerKey(player)), ...player });
  const numbered = day.games.map((game, index) => ({ ...game, team_a: game.team_a.map(withProfile), team_b: game.team_b.map(withProfile), number: index + 1 }));
  const shown = focus ? numbered.filter((game) => [...game.team_a, ...game.team_b].some((player) => playerKey(player) === focus)) : numbered;
  const focused = standings.find((row) => row.key === focus);
  const courts = new Set(day.games.map((game) => game.court_no).filter((court) => court != null)).size;
  const first = day.games[0].endedAt;
  const last = day.games[day.games.length - 1].endedAt;
  const unranked = day.games.length - day.rankedCount;

  return <Shell {...shell}>
    <div className="ds-daypage">
      {back}
      <header className="ds-dp-head">
        <h1 className="ds-username">{day.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
        <p className="ds-sub">{first === last ? timeLabel(first) : `${timeLabel(first)} – ${timeLabel(last)}`}</p>
      </header>

      <dl className="ds-dp-stats">
        <div><dt>Games</dt><dd>{day.games.length}</dd></div>
        <div><dt>Players</dt><dd>{day.playerCount}</dd></div>
        <div><dt>Courts</dt><dd>{courts || "–"}</dd></div>
        <div><dt>Ranked</dt><dd>{day.rankedCount}{unranked > 0 && <small> / {day.games.length}</small>}</dd></div>
      </dl>

      <div className="ds-dp-layout">
        <section className="ds-dp-matches" aria-labelledby="matches-title">
          <div className="ds-dp-bar">
            <h2 id="matches-title" className="ds-h2">{focused ? `${focused.name}'s matches` : "Matches"}</h2>
            <span className="ds-dp-count">{shown.length} of {day.games.length}</span>
            {focus && <button type="button" className="ds-btn tertiary" onClick={() => setFocus("")}>Show all</button>}
          </div>
          <ol className="ds-dp-list">{shown.map((game) => <MatchCard key={game.id ?? game.endedAt} game={game} viewer={viewer} focus={focus} meta={<>
              <span className="ds-dp-num">#{game.number}</span>
              <span>{timeLabel(game.endedAt)}</span>
              {game.court_no != null && <span className="ds-dp-court">Court {game.court_no}</span>}
              {!game.ranked && <span className="ds-dp-tag">Unranked</span>}
            </>} />)}</ol>
        </section>

        <aside className="ds-dp-standings" aria-labelledby="standings-title">
          <div className="ds-dp-standings-head">
            <h2 id="standings-title" className="ds-h2">Day standings</h2>
            <button type="button" className="ds-btn tertiary ds-dp-toggle" aria-expanded={standingsOpen} aria-controls="standings-body" onClick={() => setStandingsOpen((open) => !open)}>{standingsOpen ? "Hide" : "Show"}</button>
          </div>
          <div id="standings-body" className={`ds-dp-standings-body${standingsOpen ? "" : " collapsed"}`}>
          <p className="ds-hint">Pick a player to see only their matches.</p>
          <ol className="ds-dp-table">{standings.map((row, index) => {
            const played = row.wins + row.losses;
            const active = focus === row.key;
            return <li key={row.key}>
              <button type="button" className={`ds-dp-row${active ? " active" : ""}`} aria-pressed={active} onClick={() => setFocus(active ? "" : row.key)}>
                <span className="ds-dp-pos">{index + 1}</span>
                <PlayerAvatar className="ds-dp-avatar" path={profiles.get(row.key)?.profile_image_path} tier={profiles.get(row.key)?.tier} />
                <span className="ds-dp-name">{row.name}</span>
                <span className="ds-dp-record"><b>{row.wins}</b>–{row.losses}</span>
                <span className="ds-dp-rate" style={{ "--rate": played ? row.wins / played : 0 }} aria-label={`${played ? Math.round((row.wins / played) * 100) : 0}% wins`} />
              </button>
            </li>;
          })}</ol>
          </div>
        </aside>
      </div>
    </div>
  </Shell>;
}
