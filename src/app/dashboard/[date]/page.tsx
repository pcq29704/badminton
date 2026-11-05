import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import DayPage from "@/features/dashboard/DayPage";
import { prefetchClub } from "@/lib/query/prefetch";

export const metadata: Metadata = { title: "Matches · Court Balancer" };

// Data loads on the server for signed-in players, so the page arrives ready.
export default async function DayMatchesPage() {
  return <HydrationBoundary state={await prefetchClub()}><DayPage /></HydrationBoundary>;
}
