import { redirect } from "next/navigation";
import { AppHome } from "@/components/AppHome";
import { getAuthUser } from "@/lib/api-auth";
import { getProfileById } from "@/lib/auth/otp";
import {
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
} from "@/lib/supabase/marketplace-closet";
import { listListings, type ListingWithThumb } from "@/lib/supabase/queries";
import type {
  MarketplaceAccount,
  MarketplaceClosetItem,
} from "@/lib/marketplace-profiles";

export default async function AppHomePage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/unlock");
  }

  const listingsPromise = listListings(user.id);
  const profilePromise = getProfileById(user.id).catch(() => null);
  const closetPromise = Promise.all([
    listMarketplaceAccounts(user.id),
    listMarketplaceClosetItems(user.id),
  ]).catch((err) => {
    console.error("list marketplace closet failed:", err);
    return [[], []] as [MarketplaceAccount[], MarketplaceClosetItem[]];
  });

  let listings: ListingWithThumb[] = [];
  try {
    listings = await listingsPromise;
  } catch (err) {
    console.error("listListings failed:", err);
  }

  const profile = await profilePromise;
  const [marketplaceAccounts, marketplaceListings] = await closetPromise;

  return (
    <AppHome
      initialListings={listings}
      preferencesCompleted={Boolean(profile?.listing_prefs_completed_at)}
      initialPreferences={profile?.listing_preferences ?? null}
      userEmail={user.email}
      initialMarketplaceAccounts={marketplaceAccounts}
      initialMarketplaceListings={marketplaceListings}
    />
  );
}
