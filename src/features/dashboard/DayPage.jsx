"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import PlayerAvatar from "@/components/PlayerAvatar";
import Shell from "@/components/Shell";
import { Button, Card, MatchRow, Notice, StatStrip, playerKey } from "@/components/ui";
import { useIsClient } from "@/lib/useIsClient";
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

const back = <a className="cb-back cb-link" href="/dashboard">← Dashboard</a>;

export default function DayPage() {
  const { date } = useParams();
  const { loading, viewer, games, ranking, error, signOut } = useClubGames();
  const [focus, setFocus] = useState("");
  // On tablets and phones the standings start closed so the matches stay near the top. Desktop always shows them.
  const [standingsOpen, setStandingsOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 960px)").matches);
  const day = useMemo(() => isDayKey(date) ? groupGamesByDay(games).find((entry) => entry.key === date) : null, [games, date]);
  const standings = useMemo(() => day ? dayStandings(day.games) : [], [day]);
  const profiles = useMemo(() => new Map((ranking || []).map((player) => [playerKey(player), player])), [ranking]);
  // Days are grouped in the viewer's time zone, so the list draws in the browser (the data is already here).
  const isClient = useIsClient();
  const shell = { current: "dashboard", viewer, onSignOut: signOut, page: "cb-page" };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}>{back}<Notice tone="error">{error}</Notice></Shell>;
  if (loading || !isClient) return <Shell {...shell}><p className="cb-empty" role="status">Loading matches…</p></Shell>;
  if (!day) return <Shell {...shell}>{back}<p className="cb-empty">No games found for this day.</p></Shell>;

  const withProfile = (player) => ({ ...profiles.get(playerKey(player)), ...player });
  const numbered = day.games.map((game, index) => ({ ...game, team_a: game.team_a.map(withProfile), team_b: game.team_b.map(withProfile), number: index + 1 }));
  const shown = focus ? numbered.filter((game) => [...game.team_a, ...game.team_b].some((player) => playerKey(player) === focus)) : numbered;
  const focused = standings.find((row) => row.key === focus);
  const courts = new Set(day.games.map((game) => game.court_no).filter((court) => court != null)).size;
  const first = day.games[0].endedAt;
  const last = day.games[day.games.length - 1].endedAt;
  const unranked = day.games.length - day.rankedCount;
  const stats = [
    { label: "Games", value: day.games.length },
    { label: "Players", value: day.playerCount },
    { label: "Courts", value: courts || "–" },
    { label: "Ranked", value: day.rankedCount, unit: unranked > 0 ? ` / ${day.games.length}` : undefined },
  ];

  return <Shell {...shell}>
    {back}
    <header className="cb-day-head">
      <h1 className="cb-display-title">{day.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
      <p className="cb-note">{first === last ? timeLabel(first) : `${timeLabel(first)} – ${timeLabel(last)}`}</p>
    </header>

    <StatStrip items={stats} label="Day summary" />

    <div className="cb-day-layout">
      <Card
        title={focused ? `${focused.name}'s matches` : "Matches"}
        note={`${shown.length} of ${day.games.length}`}
        tools={focus ? <Button variant="quiet" onClick={() => setFocus("")}>Show all</Button> : undefined}
      >
        <ol className="cb-matches">{shown.map((game) => <MatchRow key={game.id ?? game.endedAt} game={game} viewer={viewer} focusKey={focus} meta={<>
          <b className="cb-match-num">#{game.number}</b>
          <span className="cb-note">{timeLabel(game.endedAt)}</span>
          {game.court_no != null && <span className="cb-tag">Court {game.court_no}</span>}
          {!game.ranked && <span className="cb-tag faint">Unranked</span>}
        </>} />)}</ol>
      </Card>

      <Card
        as="aside"
        className="cb-standings"
        title="Day standings"
        note="Pick a player to see only their matches."
        tools={<button type="button" className="cb-chip cb-standings-toggle" aria-expanded={standingsOpen} aria-controls="standings-body" onClick={() => setStandingsOpen((open) => !open)}>{standingsOpen ? "Hide" : "Show"}</button>}
      >
        <div id="standings-body" className={standingsOpen ? undefined : "collapsed"}>
          <ol className="cb-stand-list">{standings.map((row, index) => {
            const played = row.wins + row.losses;
            const active = focus === row.key;
            return <li key={row.key}>
              <button type="button" className="cb-stand-row" aria-pressed={active} onClick={() => setFocus(active ? "" : row.key)}>
                <span className="cb-stand-pos">{index + 1}</span>
                <PlayerAvatar className="cb-avatar-sm" path={profiles.get(row.key)?.profile_image_path} tier={profiles.get(row.key)?.tier} name={row.name} />
                <span className="cb-ledger-name">{row.name}</span>
                <span className="cb-ledger-rec"><b>{row.wins}</b>–{row.losses}</span>
                <span className="cb-ledger-bar" aria-label={`${played ? Math.round((row.wins / played) * 100) : 0}% wins`}><i style={{ width: `${played ? (row.wins / played) * 100 : 0}%` }} /></span>
              </button>
            </li>;
          })}</ol>
        </div>
      </Card>
    </div>
  </Shell>;
}
