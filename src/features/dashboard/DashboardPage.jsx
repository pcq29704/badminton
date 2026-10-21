"use client";

import { useMemo } from "react";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { useClubGames } from "./useClubGames";
import PlayerRanking from "./PlayerRanking";
import { groupGamesByDay } from "./days.mjs";

const dayLabel = (date) => date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short", year: "numeric" });
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function DashboardPage() {
  const { loading, viewer, games, ranking, error, signOut } = useClubGames();
  const days = useMemo(() => groupGamesByDay(games), [games]);
  const shell = { current: "dashboard", viewer, onSignOut: signOut };

  if (!hasSupabaseConfig) return <Shell current="dashboard"><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}><p className="ds-alert error" role="alert">{error}</p></Shell>;
  if (loading) return <Shell current="dashboard"><p className="ds-empty">Loading your dashboard…</p></Shell>;

  return <Shell {...shell}>
    <div className="ds-eyebrow">Welcome, {viewer.name}</div>
    <PlayerRanking ranking={ranking} viewer={viewer} />
    <h1 className="ds-title" style={{ fontSize: "clamp(32px, 6vw, 48px)", lineHeight: 1.25 }}>Days played</h1>
    <p className="ds-lead">{days.length ? `${plural(days.length, "day")} · ${plural(games.length, "finished game")}. Pick a day to see every match.` : "Every day the club plays shows up here."}</p>
    {days.length ? <ul className="ds-days">{days.map((day) => <li key={day.key}>
      <a className="ds-day" href={`/dashboard/${day.key}`}>
        <span className="ds-day-date">{dayLabel(day.date)}</span>
        <span className="ds-day-games">{plural(day.games.length, "game")}</span>
        <span className="ds-day-record">{plural(day.playerCount, "player")}</span>
        <span className="ds-day-go" aria-hidden="true">→</span>
      </a>
    </li>)}</ul> : <p className="ds-empty">No finished games yet.</p>}
  </Shell>;
}
