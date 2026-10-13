import type { Metadata } from "next";
import PlayerProfile from "@/features/player-profile/PlayerProfile";

export const metadata: Metadata = { title: "Player profile · Court Balancer" };

export default function ProfilePage() {
  return <PlayerProfile />;
}
