import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import PlayerProfile from "@/features/player-profile/PlayerProfile";
import { prefetchProfile, serverContext } from "@/lib/query/prefetch";

export const metadata: Metadata = { title: "Player profile · Court Balancer" };

// The profile depends on ?u= and the session cookie, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

// Signed-in players with no ?u= go straight to the dashboard. Otherwise the profile in ?u= loads on the server.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ u?: string | string[] }> }) {
  const { u } = await searchParams;
  const username = typeof u === "string" ? u : "";
  const { queryClient, db, player } = await serverContext();
  if (player && !username) redirect("/dashboard");
  await prefetchProfile(db, queryClient, username);
  return <HydrationBoundary state={dehydrate(queryClient)}><PlayerProfile initialUsername={username} /></HydrationBoundary>;
}
