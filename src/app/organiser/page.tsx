import type { Metadata } from "next";
import CourtBalancer from "@/features/court-balancer/CourtBalancer";

export const metadata: Metadata = { title: "Organiser · Court Balancer" };

export default function OrganiserPage() {
  return <CourtBalancer />;
}
