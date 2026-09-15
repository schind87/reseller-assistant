import type { MarketplaceClosetItem } from "@/lib/marketplace-profiles";
import type { ListingStatus, Platform } from "@/lib/types";

export type ClosetMatchableListing = {
  id: string;
  platform: Platform;
  title: string | null;
  price: number | null;
  status: ListingStatus;
};

export type ListingClosetState = {
  closetMatch: MarketplaceClosetItem | null;
  closetChecked: boolean;
};

export function normalizeMatchTitle(
  title: string | null | undefined
): string | null {
  if (!title) return null;
  const normalized = title.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

export function pricesMatch(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  if (a == null || b == null) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

function listingMatchPriority(status: ListingStatus): number {
  switch (status) {
    case "posted":
      return 0;
    case "posting":
      return 1;
    case "ready":
      return 2;
    case "processing":
      return 3;
    case "drafting_photos":
      return 4;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function sortMatchableListings(
  listings: ClosetMatchableListing[]
): ClosetMatchableListing[] {
  return listings.toSorted((a, b) => {
    const byStatus = listingMatchPriority(a.status) - listingMatchPriority(b.status);
    if (byStatus !== 0) return byStatus;
    return a.id.localeCompare(b.id);
  });
}

export function checkedPlatformsFromAccounts(
  accounts: { platform: Platform; lastCheckedAt: string | null }[]
): Set<Platform> {
  const checked = new Set<Platform>();
  for (const account of accounts) {
    if (account.lastCheckedAt) checked.add(account.platform);
  }
  return checked;
}

export function listingClosetState(
  listingId: string,
  platform: Platform,
  matches: Map<string, MarketplaceClosetItem>,
  checkedPlatforms: ReadonlySet<Platform>
): ListingClosetState {
  return {
    closetMatch: matches.get(listingId) ?? null,
    closetChecked: checkedPlatforms.has(platform),
  };
}

/** Unique greedy match: same store, normalized title, price when it distinguishes. */
export function matchListingsToClosetItems(
  listings: ClosetMatchableListing[],
  items: MarketplaceClosetItem[]
): Map<string, MarketplaceClosetItem> {
  const matches = new Map<string, MarketplaceClosetItem>();
  const platforms = new Set<Platform>();
  for (const listing of listings) platforms.add(listing.platform);
  for (const item of items) platforms.add(item.platform);
  for (const platform of platforms) {
    matchPlatform(
      listings.filter((row) => row.platform === platform),
      items.filter((item) => item.platform === platform),
      matches
    );
  }
  return matches;
}

function matchPlatform(
  listings: ClosetMatchableListing[],
  items: MarketplaceClosetItem[],
  matches: Map<string, MarketplaceClosetItem>
): void {
  const titledListings = sortMatchableListings(
    listings.filter((row) => normalizeMatchTitle(row.title))
  );
  const titledItems = items.filter((item) => normalizeMatchTitle(item.title));
  const usedListingIds = new Set<string>();
  const usedItemIds = new Set<string>();

  function take(
    listing: ClosetMatchableListing,
    item: MarketplaceClosetItem
  ): void {
    matches.set(listing.id, item);
    usedListingIds.add(listing.id);
    usedItemIds.add(item.id);
  }

  for (const listing of titledListings) {
    const title = normalizeMatchTitle(listing.title);
    if (!title) continue;
    const candidates = titledItems.filter(
      (item) =>
        !usedItemIds.has(item.id) &&
        normalizeMatchTitle(item.title) === title &&
        pricesMatch(listing.price, item.price)
    );
    if (candidates.length > 0) {
      take(listing, candidates[0]!);
    }
  }

  const remainingListings = titledListings.filter(
    (row) => !usedListingIds.has(row.id)
  );
  const remainingItems = titledItems.filter((item) => !usedItemIds.has(item.id));
  const listingsByTitle = groupListingsByTitle(remainingListings);
  const itemsByTitle = groupItemsByTitle(remainingItems);

  for (const [title, groupListings] of listingsByTitle) {
    const groupItems = itemsByTitle.get(title) ?? [];
    const count = Math.min(groupListings.length, groupItems.length);
    for (let index = 0; index < count; index += 1) {
      take(groupListings[index]!, groupItems[index]!);
    }
  }
}

function groupListingsByTitle(
  listings: ClosetMatchableListing[]
): Map<string, ClosetMatchableListing[]> {
  const groups = new Map<string, ClosetMatchableListing[]>();
  for (const listing of listings) {
    const title = normalizeMatchTitle(listing.title);
    if (!title) continue;
    const list = groups.get(title) ?? [];
    list.push(listing);
    groups.set(title, list);
  }
  return groups;
}

function groupItemsByTitle(
  items: MarketplaceClosetItem[]
): Map<string, MarketplaceClosetItem[]> {
  const groups = new Map<string, MarketplaceClosetItem[]>();
  for (const item of items) {
    const title = normalizeMatchTitle(item.title);
    if (!title) continue;
    const list = groups.get(title) ?? [];
    list.push(item);
    groups.set(title, list);
  }
  return groups;
}
