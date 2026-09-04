import { createAdminClient } from "@/lib/supabase/admin";
import {
  MARKETPLACE_CLOSET_STATUS,
  type MarketplaceAccount,
  type MarketplaceClosetItem,
  type MarketplaceClosetStatus,
} from "@/lib/marketplace-profiles";
import type { Platform } from "@/lib/types";

type AccountRow = {
  user_id: string;
  platform: Platform;
  username: string;
  linked_at: string;
  last_checked_at: string | null;
  last_check_error: string | null;
};

type ItemRow = {
  id: string;
  user_id: string;
  platform: Platform;
  external_id: string;
  title: string | null;
  price: number | string | null;
  status: MarketplaceClosetStatus;
  url: string;
  thumbnail_url: string | null;
  synced_at: string;
};

function mapAccount(row: AccountRow): MarketplaceAccount {
  return {
    platform: row.platform,
    username: row.username,
    linkedAt: row.linked_at,
    lastCheckedAt: row.last_checked_at,
    lastCheckError: row.last_check_error,
  };
}

function mapItem(row: ItemRow): MarketplaceClosetItem {
  const price =
    row.price == null
      ? null
      : typeof row.price === "number"
        ? row.price
        : Number(row.price);
  return {
    id: row.id,
    platform: row.platform,
    externalId: row.external_id,
    title: row.title,
    price: price == null || Number.isNaN(price) ? null : price,
    status: row.status,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    syncedAt: row.synced_at,
  };
}

export async function listMarketplaceAccounts(
  userId: string
): Promise<MarketplaceAccount[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketplace_accounts")
    .select(
      "user_id, platform, username, linked_at, last_checked_at, last_check_error"
    )
    .eq("user_id", userId)
    .order("platform", { ascending: true });
  if (error) throw new Error(`listMarketplaceAccounts: ${error.message}`);
  return (data as AccountRow[] | null)?.map(mapAccount) ?? [];
}

export async function listMarketplaceClosetItems(
  userId: string
): Promise<MarketplaceClosetItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketplace_closet_items")
    .select(
      "id, user_id, platform, external_id, title, price, status, url, thumbnail_url, synced_at"
    )
    .eq("user_id", userId)
    .order("synced_at", { ascending: false });
  if (error) throw new Error(`listMarketplaceClosetItems: ${error.message}`);
  return (data as ItemRow[] | null)?.map(mapItem) ?? [];
}

export async function upsertMarketplaceAccount(
  userId: string,
  platform: Platform,
  username: string
): Promise<MarketplaceAccount> {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("marketplace_accounts")
    .select("username")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();
  if (existingError) {
    throw new Error(`upsertMarketplaceAccount lookup: ${existingError.message}`);
  }
  if (existing && existing.username !== username) {
    const { error: clearError } = await supabase
      .from("marketplace_closet_items")
      .delete()
      .eq("user_id", userId)
      .eq("platform", platform);
    if (clearError) {
      throw new Error(`upsertMarketplaceAccount clear: ${clearError.message}`);
    }
  }
  const { data, error } = await supabase
    .from("marketplace_accounts")
    .upsert(
      {
        user_id: userId,
        platform,
        username,
        linked_at: new Date().toISOString(),
        last_check_error: null,
      },
      { onConflict: "user_id,platform" }
    )
    .select(
      "user_id, platform, username, linked_at, last_checked_at, last_check_error"
    )
    .single();
  if (error) throw new Error(`upsertMarketplaceAccount: ${error.message}`);
  return mapAccount(data as AccountRow);
}

export async function deleteMarketplaceAccount(
  userId: string,
  platform: Platform
): Promise<void> {
  const supabase = createAdminClient();
  const { error: itemsError } = await supabase
    .from("marketplace_closet_items")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);
  if (itemsError) {
    throw new Error(`deleteMarketplaceAccount items: ${itemsError.message}`);
  }
  const { error } = await supabase
    .from("marketplace_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);
  if (error) throw new Error(`deleteMarketplaceAccount: ${error.message}`);
}

export type ClosetCheckItemInput = {
  externalId: string;
  title: string | null;
  price: number | null;
  status: MarketplaceClosetStatus;
  url: string;
  thumbnailUrl: string | null;
};

export async function replaceMarketplaceClosetItems(
  userId: string,
  platform: Platform,
  items: ClosetCheckItemInput[]
): Promise<MarketplaceClosetItem[]> {
  const supabase = createAdminClient();
  const syncedAt = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from("marketplace_closet_items")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);
  if (deleteError) {
    throw new Error(`replaceMarketplaceClosetItems delete: ${deleteError.message}`);
  }

  if (items.length > 0) {
    const { error: insertError } = await supabase
      .from("marketplace_closet_items")
      .insert(
        items.map((item) => ({
          user_id: userId,
          platform,
          external_id: item.externalId,
          title: item.title,
          price: item.price,
          status: item.status,
          url: item.url,
          thumbnail_url: item.thumbnailUrl,
          synced_at: syncedAt,
        }))
      );
    if (insertError) {
      throw new Error(
        `replaceMarketplaceClosetItems insert: ${insertError.message}`
      );
    }
  }

  const { error: accountError } = await supabase
    .from("marketplace_accounts")
    .update({
      last_checked_at: syncedAt,
      last_check_error: null,
    })
    .eq("user_id", userId)
    .eq("platform", platform);
  if (accountError) {
    throw new Error(
      `replaceMarketplaceClosetItems account: ${accountError.message}`
    );
  }

  return listMarketplaceClosetItems(userId);
}

export async function recordMarketplaceCheckError(
  userId: string,
  platform: Platform,
  message: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("marketplace_accounts")
    .update({ last_check_error: message })
    .eq("user_id", userId)
    .eq("platform", platform);
  if (error) {
    throw new Error(`recordMarketplaceCheckError: ${error.message}`);
  }
}

export function isClosetStatus(
  value: string
): value is MarketplaceClosetStatus {
  return (MARKETPLACE_CLOSET_STATUS as readonly string[]).includes(value);
}
