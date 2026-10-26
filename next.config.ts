import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async redirects() {
    return [{ source: "/index.html", destination: "/", permanent: true }];
  },
};

export default nextConfig;
