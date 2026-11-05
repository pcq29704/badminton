"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { clubQuery, keys, signOutEverywhere, SIGN_IN_REQUIRED } from "../queries";

// The signed-in viewer (player or organiser), the club's finished games and the ranking.
// Signed-in players get this from the server render. Signed-out visitors go to "/".
export function useClubGames() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery({ ...clubQuery, enabled: hasSupabaseConfig });
  const signedOut = error?.message === SIGN_IN_REQUIRED;

  useEffect(() => { if (signedOut) router.replace("/"); }, [signedOut, router]);
  useEffect(() => { if (data?.viewer) queryClient.setQueryData(keys.viewer, data.viewer); }, [data, queryClient]);

  async function signOut() {
    // Wait for the server to clear the cookie, or "/" would send the player back to the dashboard.
    await signOutEverywhere(queryClient);
    router.replace("/");
  }

  return {
    loading: isPending || signedOut,
    viewer: data?.viewer ?? null,
    games: data?.games ?? [],
    ranking: data?.ranking ?? [],
    error: error && !signedOut ? error.message : "",
    signOut,
  };
}
