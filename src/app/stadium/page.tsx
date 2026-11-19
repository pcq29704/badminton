import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import StadiumPage from "@/features/stadium/StadiumPage";
import { prefetchClub } from "@/lib/query/prefetch";
import { STADIUM_ENABLED } from "@/lib/app-env";

export const metadata: Metadata = { title: "Stadium · Court Balancer" };

// Signed-in players get the viewer, games and ranking from the server (session cookie), the same
// as /ranking, so the walls arrive filled. Organisers sign in in the browser; the page loads the
// club data there and sends signed-out visitors to "/".
// Outside the dev environment the page does not exist (404).
export default async function Stadium() {
  if (!STADIUM_ENABLED) notFound();
  return <HydrationBoundary state={await prefetchClub()}><StadiumPage /></HydrationBoundary>;
}
