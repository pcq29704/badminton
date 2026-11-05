import "server-only";
import { cookies } from "next/headers";
import { dehydrate, type QueryClient } from "@tanstack/react-query";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { loadGames, loadProfile, loadRanking, playerForToken, playerViewer, type Db } from "@/lib/player-api/data";
import { COOKIE_NAME } from "@/lib/player-api/session.mjs";
import { keys } from "@/features/queries";
import { getQueryClient } from "./client";

// Server-side prefetch for the pages. It fills the same query keys the client hooks read.
// Only player sessions are visible here (a cookie). Organisers keep their token in the browser,
// so their pages still load on the client.

export async function serverContext() {
  const queryClient: QueryClient = getQueryClient();
  if (!hasSupabaseConfig || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { queryClient, db: null, player: null };
  const db = getAdminClient();
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const player = token ? await playerForToken(db, token) : null;
  if (player) {
    queryClient.setQueryData(keys.viewer, { ok: true, ...playerViewer(player) });
    queryClient.setQueryData(keys.session, { ok: true, username: player.username });
  }
  return { queryClient, db, player };
}

// Dashboard, ranking and day pages: viewer, games and ranking in one go.
export async function prefetchClub() {
  const { queryClient, db, player } = await serverContext();
  if (db && player) {
    try {
      const [{ games }, { ranking }] = await Promise.all([loadGames(db), loadRanking(db)]);
      queryClient.setQueryData(keys.club, { viewer: { ok: true, ...playerViewer(player) }, games, ranking });
    } catch {
      // The client query loads it again and shows the error.
    }
  }
  return dehydrate(queryClient);
}

export async function prefetchProfile(db: Db | null, queryClient: QueryClient, username: string) {
  if (!db || !username) return;
  try {
    queryClient.setQueryData(keys.profile(username), await loadProfile(db, username));
  } catch {
    // The client query loads it again and shows the error.
  }
}
