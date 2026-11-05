"use client";

import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { Notice } from "@/components/ui";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { useClubGames } from "./useClubGames";
import PlayerRanking from "./PlayerRanking";

export default function RankingPage() {
  const { loading, viewer, ranking, error, signOut } = useClubGames();
  const shell = { current: "ranking", viewer, onSignOut: signOut, page: "cb-page" };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}><Notice tone="error">{error}</Notice></Shell>;
  if (loading) return <Shell {...shell}><p className="cb-empty" role="status">Loading the ranking…</p></Shell>;

  return <Shell {...shell}><PlayerRanking ranking={ranking} viewer={viewer} /></Shell>;
}
