import {
  parseListingPreferences,
  type ListingPreferences,
} from "@/lib/seller-preferences";
import { deleteListing } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPostingPhotoRole, type ListingStatus, type PhotoRole, type Platform } from "@/lib/types";
import type { AdminUserListing, AdminUserRow } from "@/lib/admin-users";

const PAGE_SIZE = 1000;

type ProfileRow = {
  id: string;
  email: string | null;
  pin_hash: string | null;
  listing_preferences: unknown;
  listing_prefs_completed_at: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  user_id: string | null;
  platform: Platform;
  status: ListingStatus;
  title: string | null;
  updated_at: string;
};

type PhotoRow = {
  listing_id: string;
  role: PhotoRole;
};

async function selectAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(offset, offset + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function defaultStore(preferences: unknown): Platform | null {
  const parsed: ListingPreferences = parseListingPreferences(preferences);
  return parsed.sellingWebsite ?? null;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = createAdminClient();

  const [profiles, listings, photos] = await Promise.all([
    selectAll<ProfileRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, pin_hash, listing_preferences, listing_prefs_completed_at, created_at"
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(`listAdminUsers profiles: ${error.message}`);
      return (data ?? []) as ProfileRow[];
    }),
    selectAll<ListingRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, user_id, platform, status, title, updated_at")
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(`listAdminUsers listings: ${error.message}`);
      return (data ?? []) as ListingRow[];
    }),
    selectAll<PhotoRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("listing_photos")
        .select("listing_id, role")
        .range(from, to);
      if (error) throw new Error(`listAdminUsers photos: ${error.message}`);
      return (data ?? []) as PhotoRow[];
    }),
  ]);

  const photoCountByListing = new Map<string, number>();
  const postingPhotoByListing = new Set<string>();
  for (const photo of photos) {
    photoCountByListing.set(
      photo.listing_id,
      (photoCountByListing.get(photo.listing_id) ?? 0) + 1
    );
    if (isPostingPhotoRole(photo.role)) {
      postingPhotoByListing.add(photo.listing_id);
    }
  }

  const listingsByUser = new Map<string | null, AdminUserListing[]>();
  for (const listing of listings) {
    const row: AdminUserListing = {
      id: listing.id,
      title: listing.title,
      platform: listing.platform,
      status: listing.status,
      updatedAt: listing.updated_at,
      photoCount: photoCountByListing.get(listing.id) ?? 0,
      hasListingPhoto: postingPhotoByListing.has(listing.id),
    };
    const key = listing.user_id;
    const list = listingsByUser.get(key) ?? [];
    list.push(row);
    listingsByUser.set(key, list);
  }

  const users: AdminUserRow[] = profiles.map((profile) => {
    const owned = listingsByUser.get(profile.id) ?? [];
    return toUserRow({
      id: profile.id,
      email: profile.email,
      createdAt: profile.created_at,
      hasPin: Boolean(profile.pin_hash),
      prefsCompleted: Boolean(profile.listing_prefs_completed_at),
      defaultStore: defaultStore(profile.listing_preferences),
      listings: owned,
    });
  });

  const unowned = listingsByUser.get(null) ?? [];
  if (unowned.length > 0) {
    users.push(
      toUserRow({
        id: null,
        email: null,
        createdAt: null,
        hasPin: false,
        prefsCompleted: false,
        defaultStore: null,
        listings: unowned,
      })
    );
  }

  const profileIds = new Set(profiles.map((p) => p.id));
  for (const [userId, orphanListings] of listingsByUser) {
    if (userId == null || profileIds.has(userId)) continue;
    users.push(
      toUserRow({
        id: userId,
        email: null,
        createdAt: null,
        hasPin: false,
        prefsCompleted: false,
        defaultStore: null,
        listings: orphanListings,
      })
    );
  }

  return users;
}

function toUserRow(input: {
  id: string | null;
  email: string | null;
  createdAt: string | null;
  hasPin: boolean;
  prefsCompleted: boolean;
  defaultStore: Platform | null;
  listings: AdminUserListing[];
}): AdminUserRow {
  const listings = input.listings.toSorted((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  let postedCount = 0;
  let photoCount = 0;
  let lastListingAt: string | null = null;
  for (const listing of listings) {
    if (listing.status === "posted") postedCount += 1;
    photoCount += listing.photoCount;
    if (!lastListingAt || listing.updatedAt > lastListingAt) {
      lastListingAt = listing.updatedAt;
    }
  }
  return {
    id: input.id,
    email: input.email,
    createdAt: input.createdAt,
    hasPin: input.hasPin,
    prefsCompleted: input.prefsCompleted,
    defaultStore: input.defaultStore,
    listingCount: listings.length,
    postedCount,
    photoCount,
    lastListingAt,
    listings,
  };
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    throw new Error(`deleteAdminUser profile: ${profileError.message}`);
  }
  if (!profile) {
    throw new Error("User not found");
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id")
    .eq("user_id", userId);
  if (listingsError) {
    throw new Error(`deleteAdminUser listings: ${listingsError.message}`);
  }

  for (const listing of listings ?? []) {
    await deleteListing(listing.id as string);
  }

  const email = (profile.email as string | null)?.trim();
  if (email) {
    const { error: otpError } = await supabase
      .from("login_otps")
      .delete()
      .eq("contact", email);
    if (otpError) {
      console.error("deleteAdminUser otps:", otpError.message);
    }
  }

  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (deleteError) {
    throw new Error(`deleteAdminUser: ${deleteError.message}`);
  }
}
