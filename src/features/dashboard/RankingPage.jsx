"use client";

import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { useClubGames } from "./useClubGames";
import PlayerRanking from "./PlayerRanking";

export default function RankingPage() {
  const { loading, viewer, ranking, error, signOut } = useClubGames();
  const shell = { current: "ranking", viewer, onSignOut: signOut };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}><p className="ds-alert error" role="alert">{error}</p></Shell>;
  if (loading) return <Shell {...shell}><p className="ds-empty">Loading the ranking…</p></Shell>;

  return <Shell {...shell}><PlayerRanking ranking={ranking} viewer={viewer} /></Shell>;
}
