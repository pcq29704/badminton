"use client";

import { useMemo } from "react";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { Card, Notice } from "@/components/ui";
import { useIsClient } from "@/lib/useIsClient";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { useClubGames } from "./useClubGames";
import { groupGamesByDay } from "./days.mjs";
import RankLadder from "./RankLadder";

const dayLabel = (date) => date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short", year: "numeric" });
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function DashboardPage() {
  const { loading, viewer, games, error, signOut } = useClubGames();
  const days = useMemo(() => groupGamesByDay(games), [games]);
  // Days are grouped in the viewer's time zone, so the list draws in the browser (the data is already here).
  const isClient = useIsClient();
  const shell = { current: "dashboard", viewer, onSignOut: signOut, page: "cb-page" };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}><Notice tone="error">{error}</Notice></Shell>;
  if (loading || !isClient) return <Shell {...shell}><p className="cb-empty" role="status">Loading your dashboard…</p></Shell>;

  return <Shell {...shell}>
    <h1 className="cb-sr">Dashboard</h1>
    <RankLadder />
    <Card
      title="Days played"
      note={days.length ? `${plural(days.length, "day")} · ${plural(games.length, "finished game")}. Pick a day to see every match.` : "Every day the club plays shows up here."}
    >
      {days.length
        ? <ul className="cb-days">{days.map((day) => <li key={day.key}>
          <a href={`/dashboard/${day.key}`}>
            <span className="cb-day-date">{dayLabel(day.date)}</span>
            <span className="cb-day-meta">{plural(day.games.length, "game")} · {plural(day.playerCount, "player")}</span>
            <span className="cb-day-go" aria-hidden="true" />
          </a>
        </li>)}</ul>
        : <p className="cb-empty">No finished games yet.</p>}
    </Card>
  </Shell>;
}
