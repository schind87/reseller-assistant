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
  const normalized = title
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return normalized || null;
}

export function coerceMatchPrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) ? price : null;
}

export function pricesMatch(a: unknown, b: unknown): boolean {
  const left = coerceMatchPrice(a);
  const right = coerceMatchPrice(b);
  if (left == null || right == null) return false;
  return Math.round(left * 100) === Math.round(right * 100);
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

function closetItemKey(item: MarketplaceClosetItem): string {
  return item.id || item.externalId || item.url;
}

/** Same store, titled drafts only. Title first; price only splits duplicate titles. */
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
    usedItemIds.add(closetItemKey(item));
  }

  const listingsByTitle = groupListingsByTitle(titledListings);
  const itemsByTitle = groupItemsByTitle(titledItems);

  for (const groupListings of listingsByTitle.values()) {
    const title = normalizeMatchTitle(groupListings[0]?.title);
    const groupItems = title ? (itemsByTitle.get(title) ?? []) : [];

    for (const listing of groupListings) {
      if (usedListingIds.has(listing.id)) continue;
      const priced = groupItems.filter(
        (item) =>
          !usedItemIds.has(closetItemKey(item)) &&
          pricesMatch(listing.price, item.price)
      );
      if (priced.length > 0) {
        take(listing, priced[0]!);
      }
    }

    const leftoverListings = groupListings.filter(
      (row) => !usedListingIds.has(row.id)
    );
    const leftoverItems = groupItems.filter(
      (item) => !usedItemIds.has(closetItemKey(item))
    );
    const count = Math.min(leftoverListings.length, leftoverItems.length);
    for (let index = 0; index < count; index += 1) {
      take(leftoverListings[index]!, leftoverItems[index]!);
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
