"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { postPlayerJson } from "../player-profile/api";

async function organiserHeaders() {
  const { data } = (await getSupabaseClient()?.auth.getSession()) || {};
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Loads the signed-in viewer (player or organiser) and the club's finished games. Signed-out visitors go to "/".
export function useClubGames() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, viewer: null, games: [], error: "" });

  useEffect(() => {
    const controller = new AbortController();
    if (!hasSupabaseConfig) { setState({ loading: false, viewer: null, games: [], error: "" }); return; }
    (async () => {
      try {
        const headers = await organiserHeaders();
        const viewer = await postPlayerJson("viewer", {}, controller.signal, headers);
        const { games } = await postPlayerJson("games", {}, controller.signal, headers);
        if (!controller.signal.aborted) setState({ loading: false, viewer, games, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.message === "Sign in to continue.") router.replace("/");
        else setState({ loading: false, viewer: null, games: [], error: error.message });
      }
    })();
    return () => controller.abort();
  }, [router]);

  async function signOut() {
    await Promise.allSettled([postPlayerJson("logout", {}), getSupabaseClient()?.auth.signOut()]);
    router.replace("/");
  }

  return { ...state, signOut };
}
