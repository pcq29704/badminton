import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async redirects() {
    // Old links keep working; Next passes the query string (?u=) through.
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/profile.html", destination: "/profile", permanent: true },
    ];
  },
};

export default nextConfig;
