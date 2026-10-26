import { profileImageUrl } from "../features/player-profile/api";

const TIERS = ["S", "A", "B", "C", "D"];

export function tierKey(tier) {
  const key = String(tier || "").toUpperCase();
  return TIERS.includes(key) ? key.toLowerCase() : "";
}

// Profile picture inside the tier frame. The frame art has a circular opening, so the photo sits in the middle.
export default function PlayerAvatar({ path, tier, className = "", alt = "" }) {
  const key = tierKey(tier);
  return <span className={`ds-pavatar ${className}`.trim()}>
    {path
      ? <img className="ds-pavatar-photo" src={profileImageUrl(path)} alt={alt} loading="lazy" />
      : <span className="ds-pavatar-photo" aria-hidden="true">🏸</span>}
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
