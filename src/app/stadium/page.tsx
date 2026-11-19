import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import StadiumPage from "@/features/stadium/StadiumPage";
import { prefetchClub } from "@/lib/query/prefetch";

export const metadata: Metadata = { title: "Stadium · Court Balancer" };

// Signed-in players get the viewer, games and ranking from the server (session cookie), the same
// as /ranking, so the walls arrive filled. Organisers sign in in the browser; the page loads the
// club data there and sends signed-out visitors to "/".
export default async function Stadium() {
  return <HydrationBoundary state={await prefetchClub()}><StadiumPage /></HydrationBoundary>;
}
