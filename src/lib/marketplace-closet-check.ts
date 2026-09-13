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
  listings: z.array(marketplaceClosetCheckItemSchema).max(200),
  error: z.string().max(240).optional(),
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

  const items: ClosetCheckItemInput[] = [];
  for (const item of body.listings) {
    const url = sanitizeHttpsUrl(item.url, body.platform);
    if (!url) continue;
    const thumbnailUrl = item.thumbnailUrl
      ? sanitizeHttpsUrl(item.thumbnailUrl)
      : null;
    items.push({
      externalId: item.externalId,
      title: item.title?.trim() || null,
      price: item.price,
      status: item.status,
      url,
      thumbnailUrl,
    });
  }

  const listings = await replaceMarketplaceClosetItems(
    userId,
    body.platform,
    items
  );
  const accounts = await listMarketplaceAccounts(userId);
  return { accounts, listings };
}
