import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import RankingPage from "@/features/dashboard/RankingPage";
import { prefetchClub } from "@/lib/query/prefetch";

export const metadata: Metadata = { title: "Player ranking · Court Balancer" };

// Data loads on the server for signed-in players, so the page arrives ready.
export default async function Ranking() {
  return <HydrationBoundary state={await prefetchClub()}><RankingPage /></HydrationBoundary>;
}
