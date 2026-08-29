import {
  listingJobStep,
  listingJobStepLabel,
  type ListingJobStep,
} from "@/lib/listing-job";
import type { ListingStatus, Platform } from "@/lib/types";

export type AdminUserListing = {
  id: string;
  title: string | null;
  platform: Platform;
  status: ListingStatus;
  updatedAt: string;
  photoCount: number;
  hasListingPhoto: boolean;
};

export type AdminUserRow = {
  /** `null` is the bucket for listings with no owner. */
  id: string | null;
  email: string | null;
  createdAt: string | null;
  hasPin: boolean;
  prefsCompleted: boolean;
  defaultStore: Platform | null;
  listingCount: number;
  postedCount: number;
  photoCount: number;
  lastListingAt: string | null;
  listings: AdminUserListing[];
};

export type AdminUserFilters = {
  q: string;
  platform: "all" | Platform;
  job: "all" | ListingJobStep;
  listings: "all" | "with" | "none";
  pin: "all" | "set" | "none";
  prefs: "all" | "complete" | "incomplete";
};

export const DEFAULT_ADMIN_USER_FILTERS: AdminUserFilters = {
  q: "",
  platform: "all",
  job: "all",
  listings: "all",
  pin: "all",
  prefs: "all",
};

export const ADMIN_USER_JOB_FILTERS: ListingJobStep[] = [
  "add_photos",
  "finish_with_ai",
  "open_marketplace",
  "mark_posted",
  "posted",
];

export type AdminUserSummary = {
  userCount: number;
  listingCount: number;
  postedCount: number;
  mercariCount: number;
  poshmarkCount: number;
};

function listingMatchesFilters(
  listing: AdminUserListing,
  filters: AdminUserFilters
): boolean {
  if (filters.platform !== "all" && listing.platform !== filters.platform) {
    return false;
  }
  if (filters.job !== "all") {
    const job = listingJobStep({
      status: listing.status,
      title: listing.title,
      hasListingPhoto: listing.hasListingPhoto,
    });
    if (job !== filters.job) return false;
  }
  return true;
}

export function listingJobLabel(listing: AdminUserListing): string {
  return listingJobStepLabel(
    listingJobStep({
      status: listing.status,
      title: listing.title,
      hasListingPhoto: listing.hasListingPhoto,
    })
  );
}

export function matchingListings(
  user: AdminUserRow,
  filters: AdminUserFilters
): AdminUserListing[] {
  if (filters.platform === "all" && filters.job === "all") {
    return user.listings;
  }
  return user.listings.filter((listing) =>
    listingMatchesFilters(listing, filters)
  );
}

export function filterAdminUsers(
  users: AdminUserRow[],
  filters: AdminUserFilters
): AdminUserRow[] {
  const q = filters.q.trim().toLowerCase();
  return users.filter((user) => {
    if (q) {
      const hay = [user.id ?? "unowned", user.email ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (user.id == null) {
      if (filters.pin !== "all" || filters.prefs !== "all") return false;
    } else {
      if (filters.pin === "set" && !user.hasPin) return false;
      if (filters.pin === "none" && user.hasPin) return false;
      if (filters.prefs === "complete" && !user.prefsCompleted) return false;
      if (filters.prefs === "incomplete" && user.prefsCompleted) return false;
    }
    if (filters.listings === "with" && user.listingCount === 0) return false;
    if (filters.listings === "none" && user.listingCount > 0) return false;
    if (filters.platform !== "all" || filters.job !== "all") {
      if (matchingListings(user, filters).length === 0) return false;
    }
    return true;
  });
}

export function summarizeAdminUsers(
  users: AdminUserRow[],
  filters: AdminUserFilters
): AdminUserSummary {
  let listingCount = 0;
  let postedCount = 0;
  let mercariCount = 0;
  let poshmarkCount = 0;
  for (const user of users) {
    const listings = matchingListings(user, filters);
    listingCount += listings.length;
    for (const listing of listings) {
      if (listing.status === "posted") postedCount += 1;
      if (listing.platform === "mercari") mercariCount += 1;
      if (listing.platform === "poshmark") poshmarkCount += 1;
    }
  }
  return {
    userCount: users.length,
    listingCount,
    postedCount,
    mercariCount,
    poshmarkCount,
  };
}

export function parseAdminUserFilters(
  params: URLSearchParams
): AdminUserFilters {
  const q = params.get("q")?.trim() ?? "";
  const platformRaw = params.get("platform");
  const jobRaw = params.get("job");
  const listingsRaw = params.get("listings");
  const pinRaw = params.get("pin");
  const prefsRaw = params.get("prefs");

  const platform: AdminUserFilters["platform"] =
    platformRaw === "mercari" || platformRaw === "poshmark"
      ? platformRaw
      : "all";
  const job: AdminUserFilters["job"] = ADMIN_USER_JOB_FILTERS.some(
    (step) => step === jobRaw
  )
    ? (jobRaw as AdminUserFilters["job"])
    : "all";
  const listings: AdminUserFilters["listings"] =
    listingsRaw === "with" || listingsRaw === "none" ? listingsRaw : "all";
  const pin: AdminUserFilters["pin"] =
    pinRaw === "set" || pinRaw === "none" ? pinRaw : "all";
  const prefs: AdminUserFilters["prefs"] =
    prefsRaw === "complete" || prefsRaw === "incomplete" ? prefsRaw : "all";

  return { q, platform, job, listings, pin, prefs };
}

export function adminUserFiltersToSearch(filters: AdminUserFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.platform !== "all") params.set("platform", filters.platform);
  if (filters.job !== "all") params.set("job", filters.job);
  if (filters.listings !== "all") params.set("listings", filters.listings);
  if (filters.pin !== "all") params.set("pin", filters.pin);
  if (filters.prefs !== "all") params.set("prefs", filters.prefs);
  return params.toString();
}

export function formatAdminUserSummary(summary: AdminUserSummary): string {
  const userLabel = summary.userCount === 1 ? "user" : "users";
  const listingLabel = summary.listingCount === 1 ? "listing" : "listings";
  const stores: string[] = [];
  if (summary.mercariCount > 0) {
    stores.push(`${summary.mercariCount} Mercari`);
  }
  if (summary.poshmarkCount > 0) {
    stores.push(`${summary.poshmarkCount} Poshmark`);
  }
  const listingPart =
    stores.length > 0
      ? `${summary.listingCount} ${listingLabel} (${stores.join(", ")})`
      : `${summary.listingCount} ${listingLabel}`;
  return `${summary.userCount} ${userLabel} · ${listingPart} · ${summary.postedCount} posted`;
}
