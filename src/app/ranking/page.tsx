import type { Metadata } from "next";
import RankingPage from "@/features/dashboard/RankingPage";

export const metadata: Metadata = { title: "Player ranking · Court Balancer" };

export default function Ranking() {
  return <RankingPage />;
}
