import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Chrome extension folder available to the download API on Vercel.
  outputFileTracingIncludes: {
    "/api/extension/download": ["./extension/**/*"],
  },
};

export default nextConfig;
