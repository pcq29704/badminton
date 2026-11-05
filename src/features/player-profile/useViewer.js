"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { signOutEverywhere, viewerQuery } from "../queries";

// The signed-in viewer (player or organiser), whichever profile is open. Null when signed out.
export function useViewer() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ ...viewerQuery, enabled: hasSupabaseConfig });
  return { viewer: data ?? null, signOut: () => signOutEverywhere(queryClient) };
}
