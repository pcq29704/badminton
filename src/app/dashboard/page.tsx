import type { Metadata } from "next";
import DashboardPage from "@/features/dashboard/DashboardPage";

export const metadata: Metadata = { title: "Dashboard · Court Balancer" };

export default function Dashboard() {
  return <DashboardPage />;
}
