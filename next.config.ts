import type { NextConfig } from "next";
import {
  CANONICAL_PRODUCTION_ORIGIN,
  STABLE_PRODUCTION_HOST_ALIASES,
} from "./src/lib/canonical-host";

const nextConfig: NextConfig = {
  // Cursor's browser cannot use localhost; allow 127.0.0.1 to load dev chunks.
  allowedDevOrigins: ["127.0.0.1"],
  // Keep the Chrome extension folder available to the download API on Vercel.
  outputFileTracingIncludes: {
    "/api/extension/download": ["./extension/**/*"],
  },
  async redirects() {
    const hosts = [
      ...STABLE_PRODUCTION_HOST_ALIASES,
      "www.reseller.mvfeed.us",
    ];
    return hosts.flatMap((host) => [
      {
        source: "/",
        has: [{ type: "host" as const, value: host }],
        destination: CANONICAL_PRODUCTION_ORIGIN,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${CANONICAL_PRODUCTION_ORIGIN}/:path*`,
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
