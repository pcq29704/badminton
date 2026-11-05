import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { prefetchClub } from "@/lib/query/prefetch";

export const metadata: Metadata = { title: "Dashboard · Court Balancer" };

// Data loads on the server for signed-in players, so the page arrives ready.
export default async function Dashboard() {
  return <HydrationBoundary state={await prefetchClub()}><DashboardPage /></HydrationBoundary>;
}
