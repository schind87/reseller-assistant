import { PLATFORM_LABELS } from "@/lib/platforms";
import type { Platform } from "@/lib/types";

export const MARKETPLACE_CLOSET_STATUS = [
  "active",
  "sold",
  "reserved",
  "not_for_sale",
  "unknown",
] as const;

export type MarketplaceClosetStatus =
  (typeof MARKETPLACE_CLOSET_STATUS)[number];

export type MarketplaceAccount = {
  platform: Platform;
  username: string;
  linkedAt: string;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
};

export type MarketplaceClosetItem = {
  id: string;
  platform: Platform;
  externalId: string;
  title: string | null;
  price: number | null;
  status: MarketplaceClosetStatus;
  url: string;
  thumbnailUrl: string | null;
  syncedAt: string;
};

const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;

export function marketplaceClosetUrl(
  platform: Platform,
  username: string
): string {
  const handle = username.trim();
  switch (platform) {
    case "mercari":
      return `https://www.mercari.com/u/${encodeURIComponent(handle)}/`;
    case "poshmark":
      return `https://poshmark.com/closet/${encodeURIComponent(handle)}`;
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

export function marketplaceMyListingsUrl(platform: Platform): string {
  switch (platform) {
    case "mercari":
      return "https://www.mercari.com/mypage/listings/active/";
    case "poshmark":
      return "https://poshmark.com/closet";
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

/** Account page used to read the signed-in closet name. */
export function marketplaceAccountDetectUrl(platform: Platform): string {
  switch (platform) {
    case "mercari":
      return "https://www.mercari.com/mypage/";
    case "poshmark":
      return "https://poshmark.com/closet";
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

export function parseMarketplaceUsername(
  platform: Platform,
  raw: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromUrl = usernameFromClosetUrl(platform, trimmed);
  if (fromUrl) return fromUrl;

  const handle = trimmed.replace(/^@/, "");
  if (!USERNAME_RE.test(handle)) return null;
  return handle;
}

function usernameFromClosetUrl(
  platform: Platform,
  raw: string
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);

  switch (platform) {
    case "mercari": {
      if (host !== "mercari.com" && !host.endsWith(".mercari.com")) return null;
      const uIndex = parts.findIndex((part) => part.toLowerCase() === "u");
      const handle = uIndex >= 0 ? parts[uIndex + 1] : null;
      if (!handle || !USERNAME_RE.test(handle)) return null;
      return handle;
    }
    case "poshmark": {
      if (host !== "poshmark.com" && !host.endsWith(".poshmark.com")) {
        return null;
      }
      if (parts[0]?.toLowerCase() !== "closet") return null;
      const handle = parts[1];
      if (!handle || !USERNAME_RE.test(handle)) return null;
      return handle;
    }
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

export function closetStatusLabel(status: MarketplaceClosetStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    case "not_for_sale":
      return "Not for sale";
    case "unknown":
      return "On closet";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function closetCheckHint(platform: Platform): string {
  return `Sign in to ${PLATFORM_LABELS[platform]} in Chrome, then tap Check listings.`;
}

export function closetFindHint(platform: Platform): string {
  return `Sign in to ${PLATFORM_LABELS[platform]} in Chrome, then try Find my closet.`;
}

export function closetLinkConfirmMessage(
  platform: Platform,
  username: string
): string {
  return `Link ${PLATFORM_LABELS[platform]} as @${username}?`;
}
