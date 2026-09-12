import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep file tracing inside OfferPilot when a parent directory also has a
    // package lockfile.
    root: process.cwd(),
  },
};

export default nextConfig;
