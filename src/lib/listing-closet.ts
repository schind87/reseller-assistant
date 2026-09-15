import {
  checkedPlatformsFromAccounts,
  listingClosetState,
  matchListingsToClosetItems,
  type ListingClosetState,
} from "@/lib/listing-closet-match";
import type { MarketplaceClosetItem } from "@/lib/marketplace-profiles";
import {
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
} from "@/lib/supabase/marketplace-closet";
import {
  listListingMatchRows,
  markMatchedListingsPosted,
} from "@/lib/supabase/queries";
import type { Platform } from "@/lib/types";

export async function loadListingClosetState(
  userId: string | null,
  listingId: string,
  platform: Platform
): Promise<ListingClosetState> {
  if (!userId) {
    return { closetMatch: null, closetChecked: false };
  }

  const [accounts, closetItems, listings] = await Promise.all([
    listMarketplaceAccounts(userId),
    listMarketplaceClosetItems(userId),
    listListingMatchRows(userId),
  ]);
  const matches = matchListingsToClosetItems(listings, closetItems);
  return listingClosetState(
    listingId,
    platform,
    matches,
    checkedPlatformsFromAccounts(accounts)
  );
}

/** Persist Posted for drafts that match this store's closet. Never un-posts. */
export async function confirmPostedFromCloset(
  userId: string,
  platform: Platform,
  closetItems: MarketplaceClosetItem[]
): Promise<number> {
  const listings = await listListingMatchRows(userId);
  const matches = matchListingsToClosetItems(listings, closetItems);
  const matchedIds: string[] = [];
  const newlyPostedIds: string[] = [];
  for (const listing of listings) {
    if (listing.platform !== platform) continue;
    if (!matches.has(listing.id)) continue;
    matchedIds.push(listing.id);
    if (listing.status !== "posted") newlyPostedIds.push(listing.id);
  }
  await markMatchedListingsPosted(newlyPostedIds);
  return matchedIds.length;
}
