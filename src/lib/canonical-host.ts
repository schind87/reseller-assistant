/** User-facing production hostname. Session cookies are host-only to this host. */
export const CANONICAL_PRODUCTION_HOST = "reseller.mvfeed.us";
export const CANONICAL_PRODUCTION_ORIGIN = "https://reseller.mvfeed.us";

/**
 * Stable production aliases that always serve the production deployment.
 * Unique preview/deployment URLs (`{project}-{hash}-{team}.vercel.app`) are
 * not listed and must not redirect — they are for testing.
 */
export const STABLE_PRODUCTION_HOST_ALIASES = [
  "reseller-assistant.vercel.app",
  "reseller-assistant-schind87-4839s-projects.vercel.app",
  "reseller-assistant-git-main-schind87-4839s-projects.vercel.app",
] as const;

export function hostnameOf(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(",")[0].split(":")[0].trim().toLowerCase();
}

export function shouldRedirectToCanonicalHost(hostname: string): boolean {
  if (!hostname || hostname === CANONICAL_PRODUCTION_HOST) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname === `www.${CANONICAL_PRODUCTION_HOST}`) return true;
  return (STABLE_PRODUCTION_HOST_ALIASES as readonly string[]).includes(
    hostname
  );
}
