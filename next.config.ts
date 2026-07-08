import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Hide the on-screen Next.js dev indicator (the floating "N"). It's dev-only
  // and never rendered in production, but we don't want it at all.
  devIndicators: false,
};

export default nextConfig;
