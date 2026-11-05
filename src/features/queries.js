import { getSupabaseClient } from "@/lib/supabase/client";
import { postPlayerJson } from "./player-profile/api";

// Query keys and fetchers shared by every page. The server pages fill the same keys (src/lib/query/prefetch.ts).

export const SIGN_IN_REQUIRED = "Sign in to continue.";

export const keys = {
  club: ["club"], // { viewer, games, ranking }
  viewer: ["viewer"], // signed-in player or organiser, or null
  session: ["session"], // { username } of the signed-in player, or null
  profile: (username) => ["profile", String(username || "").toLowerCase()],
};

async function organiserHeaders() {
  const { data } = (await getSupabaseClient()?.auth.getSession()) || {};
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const nullWhenSignedOut = (error) => {
  if (error.message === SIGN_IN_REQUIRED) return null;
  throw error;
};

export const clubQuery = {
  queryKey: keys.club,
  queryFn: async ({ signal }) => postPlayerJson("club", {}, signal, await organiserHeaders()),
  retry: (count, error) => error.message !== SIGN_IN_REQUIRED && count < 2,
};

export const viewerQuery = {
  queryKey: keys.viewer,
  queryFn: async ({ signal }) => postPlayerJson("viewer", {}, signal, await organiserHeaders()).catch(nullWhenSignedOut),
};

export const sessionQuery = {
  queryKey: keys.session,
  queryFn: ({ signal }) => postPlayerJson("session", {}, signal).catch(() => null),
};

export const profileQuery = (username) => ({
  queryKey: keys.profile(username),
  queryFn: ({ signal }) => postPlayerJson("profile", { username }, signal),
  retry: false,
});

// Clears the player and organiser sessions. The nav updates at once; the server calls finish in the background.
export async function signOutEverywhere(queryClient) {
  queryClient.setQueryData(keys.viewer, null);
  queryClient.setQueryData(keys.session, null);
  queryClient.removeQueries({ queryKey: keys.club });
  await Promise.allSettled([postPlayerJson("logout", {}), getSupabaseClient()?.auth.signOut()]);
}
