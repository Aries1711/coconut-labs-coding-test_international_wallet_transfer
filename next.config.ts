import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The ledger lives in memory and every page reads it per request, so
  // Cache Components / partial prefetching are off: pages render dynamically.
  agentRules: false,
};

export default nextConfig;
