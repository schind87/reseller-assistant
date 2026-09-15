import { NextResponse } from "next/server";
import type { AdminUserShopLink } from "@/lib/admin-users";
import {
  applyMarketplaceClosetCheck,
  marketplaceClosetCheckBodySchema,
} from "@/lib/marketplace-closet-check";
import type { MarketplaceAccount } from "@/lib/marketplace-profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMarketplaceAccounts } from "@/lib/supabase/marketplace-closet";

export function shopLinksPayload(
  accounts: MarketplaceAccount[]
): AdminUserShopLink[] {
  return accounts.map((account) => ({
    platform: account.platform,
    username: account.username,
    lastCheckedAt: account.lastCheckedAt,
    lastCheckError: account.lastCheckError,
  }));
}

export async function profileExists(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`admin closet profile: ${error.message}`);
  return Boolean(data);
}

export async function adminClosetCheckResponse(
  userId: string,
  json: unknown
): Promise<NextResponse> {
  const parsed = marketplaceClosetCheckBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 400 }
    );
  }

  const linked = await listMarketplaceAccounts(userId);
  const hasPlatform = linked.some(
    (account) => account.platform === parsed.data.platform
  );
  if (!hasPlatform) {
    return NextResponse.json(
      { error: "Link this closet first" },
      { status: 400 }
    );
  }

  const result = await applyMarketplaceClosetCheck(userId, parsed.data);
  return NextResponse.json({
    ...result,
    shopLinks: shopLinksPayload(result.accounts),
    listings: result.listings,
  });
}
