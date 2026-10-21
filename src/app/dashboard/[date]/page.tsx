import type { Metadata } from "next";
import DayPage from "@/features/dashboard/DayPage";

export const metadata: Metadata = { title: "Matches · Court Balancer" };

export default function DayMatchesPage() {
  return <DayPage />;
}
