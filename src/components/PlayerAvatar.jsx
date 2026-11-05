import { profileImageUrl } from "../features/player-profile/api";

const TIERS = ["S", "A", "B", "C", "D"];

export function tierKey(tier) {
  const key = String(tier || "").toUpperCase();
  return TIERS.includes(key) ? key.toLowerCase() : "";
}

// Up to two letters from the player's name, for the no-photo disc.
export function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

// Profile picture inside the tier frame. The frame art has a circular opening, so the photo sits in the middle.
// Without a photo the disc shows the player's initials in the tier colour (`name` gives the initials).
export default function PlayerAvatar({ path, tier, name = "", className = "", alt = "" }) {
  const key = tierKey(tier);
  return <span className={`ds-pavatar ${className}`.trim()} data-tier={key ? key.toUpperCase() : undefined}>
    {path
      ? <img className="ds-pavatar-photo" src={profileImageUrl(path)} alt={alt} loading="lazy" />
      : <span className="ds-pavatar-photo ds-pavatar-initials" aria-hidden="true">{initials(name)}</span>}
    {key && <img className="ds-pavatar-frame" src={`/assets/profile-frames/frame-${key}.png`} alt="" aria-hidden="true" />}
  </span>;
}

export function RankIcon({ tier, className = "" }) {
  const key = tierKey(tier);
  if (!key) return <span className={className}>{tier}</span>;
  return <span className={`ds-rank-icon ${className}`.trim()}>
    <img src={`/assets/rank-badges/rank-${key}.png`} alt={`Tier ${key.toUpperCase()}`} />
  </span>;
}
