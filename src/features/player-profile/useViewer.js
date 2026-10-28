"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { postPlayerJson } from "./api";

async function organiserHeaders() {
  const { data } = (await getSupabaseClient()?.auth.getSession()) || {};
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The signed-in viewer (player or organiser), whichever profile is open. Null when signed out.
export function useViewer() {
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasSupabaseConfig) return;
    (async () => {
      try {
        const headers = await organiserHeaders();
        const result = await postPlayerJson("viewer", {}, controller.signal, headers);
        if (!controller.signal.aborted) setViewer(result);
      } catch {
        if (!controller.signal.aborted) setViewer(null);
      }
    })();
    return () => controller.abort();
  }, []);

  async function signOut() {
    await Promise.allSettled([postPlayerJson("logout", {}), getSupabaseClient()?.auth.signOut()]);
    setViewer(null);
  }

  return { viewer, signOut };
}
