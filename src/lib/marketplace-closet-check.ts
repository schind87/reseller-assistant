import { z } from "zod";
import {
  MARKETPLACE_CLOSET_STATUS,
  type MarketplaceAccount,
  type MarketplaceClosetItem,
} from "@/lib/marketplace-profiles";
import {
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
  recordMarketplaceCheckError,
  replaceMarketplaceClosetItems,
  type ClosetCheckItemInput,
} from "@/lib/supabase/marketplace-closet";
import type { Platform } from "@/lib/types";

export const marketplacePlatformSchema = z.enum(["mercari", "poshmark"]);

export const marketplaceClosetCheckItemSchema = z.object({
  externalId: z.string().min(1).max(120),
  title: z.string().max(200).nullable(),
  price: z.number().nonnegative().nullable(),
  status: z.enum(MARKETPLACE_CLOSET_STATUS),
  url: z.string().min(1).max(500),
  thumbnailUrl: z.string().max(500).nullable(),
});

export const marketplaceClosetCheckBodySchema = z.object({
  platform: marketplacePlatformSchema,
  listings: z.array(z.unknown()).transform((listings) => listings.slice(0, 200)),
  error: z
    .string()
    .optional()
    .transform((value) => (value ? value.slice(0, 240) : value)),
});

export type MarketplaceClosetCheckBody = z.infer<
  typeof marketplaceClosetCheckBodySchema
>;

export type MarketplaceClosetCheckResult = {
  accounts: MarketplaceAccount[];
  listings: MarketplaceClosetItem[];
  error?: string;
};

function marketplaceHostOk(platform: Platform, url: URL): boolean {
  const host = url.hostname.toLowerCase();
  switch (platform) {
    case "mercari":
      return host === "mercari.com" || host.endsWith(".mercari.com");
    case "poshmark":
      return host === "poshmark.com" || host.endsWith(".poshmark.com");
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

function sanitizeHttpsUrl(raw: string, platform?: Platform): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (platform && !marketplaceHostOk(platform, url)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clipString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function clipUrl(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeClosetCheckItem(
  raw: unknown
): z.infer<typeof marketplaceClosetCheckItemSchema> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const parsed = marketplaceClosetCheckItemSchema.safeParse({
    externalId: clipString(record.externalId, 120),
    title: clipString(record.title, 200),
    price:
      typeof record.price === "number" &&
      Number.isFinite(record.price) &&
      record.price >= 0
        ? record.price
        : null,
    status: record.status,
    url: clipUrl(record.url, 500),
    thumbnailUrl: clipUrl(record.thumbnailUrl, 500),
  });
  return parsed.success ? parsed.data : null;
}

export async function applyMarketplaceClosetCheck(
  userId: string,
  body: MarketplaceClosetCheckBody
): Promise<MarketplaceClosetCheckResult> {
  if (body.error) {
    await recordMarketplaceCheckError(userId, body.platform, body.error);
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(userId),
      listMarketplaceClosetItems(userId),
    ]);
    return { accounts, listings, error: body.error };
  }

  const itemsById = new Map<string, ClosetCheckItemInput>();
  for (const raw of body.listings) {
    const item = normalizeClosetCheckItem(raw);
    if (!item) continue;
    if (itemsById.has(item.externalId)) continue;
    const url = sanitizeHttpsUrl(item.url, body.platform);
    if (!url) continue;
    const thumbnailUrl = item.thumbnailUrl
      ? sanitizeHttpsUrl(item.thumbnailUrl)
      : null;
    itemsById.set(item.externalId, {
      externalId: item.externalId,
      title: item.title?.trim() || null,
      price: item.price,
      status: item.status,
      url,
      thumbnailUrl,
    });
  }
  const items = [...itemsById.values()];

  const listings = await replaceMarketplaceClosetItems(
    userId,
    body.platform,
    items
  );
  const accounts = await listMarketplaceAccounts(userId);
  return { accounts, listings };
}
