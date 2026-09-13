import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import type { AdminUserShopLink } from "@/lib/admin-users";
import {
  applyMarketplaceClosetCheck,
  marketplaceClosetCheckBodySchema,
  marketplacePlatformSchema,
} from "@/lib/marketplace-closet-check";
import {
  closetUsernameParseError,
  parseMarketplaceUsername,
  type MarketplaceAccount,
} from "@/lib/marketplace-profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteMarketplaceAccount,
  listMarketplaceAccounts,
  upsertMarketplaceAccount,
} from "@/lib/supabase/marketplace-closet";

type RouteContext = { params: Promise<{ id: string }> };

const linkBody = z.object({
  platform: marketplacePlatformSchema,
  username: z.string().min(1).max(120),
});

async function profileExists(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`admin closet profile: ${error.message}`);
  return Boolean(data);
}

function shopLinksPayload(
  accounts: MarketplaceAccount[]
): AdminUserShopLink[] {
  return accounts.map((account) => ({
    platform: account.platform,
    username: account.username,
    lastCheckedAt: account.lastCheckedAt,
    lastCheckError: account.lastCheckError,
  }));
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const json = await request.json();
    const parsed = linkBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a Mercari or Poshmark username" },
        { status: 400 }
      );
    }

    const username = parseMarketplaceUsername(
      parsed.data.platform,
      parsed.data.username
    );
    if (!username) {
      return NextResponse.json(
        { error: closetUsernameParseError(parsed.data.platform) },
        { status: 400 }
      );
    }

    const account = await upsertMarketplaceAccount(
      id,
      parsed.data.platform,
      username
    );
    const accounts = await listMarketplaceAccounts(id);
    return NextResponse.json({
      account: { platform: account.platform, username: account.username },
      shopLinks: shopLinksPayload(accounts),
    });
  } catch (err) {
    console.error("admin link closet error:", err);
    return NextResponse.json(
      { error: "Could not link closet" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const platform = marketplacePlatformSchema.safeParse(
    new URL(request.url).searchParams.get("platform")
  );
  if (!platform.success) {
    return NextResponse.json(
      { error: "Choose Mercari or Poshmark" },
      { status: 400 }
    );
  }

  try {
    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await deleteMarketplaceAccount(id, platform.data);
    const accounts = await listMarketplaceAccounts(id);
    return NextResponse.json({ shopLinks: shopLinksPayload(accounts) });
  } catch (err) {
    console.error("admin unlink closet error:", err);
    return NextResponse.json(
      { error: "Could not unlink closet" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const json = await request.json();
    const parsed = marketplaceClosetCheckBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Could not save closet listings" },
        { status: 400 }
      );
    }

    const linked = await listMarketplaceAccounts(id);
    const hasPlatform = linked.some(
      (account) => account.platform === parsed.data.platform
    );
    if (!hasPlatform) {
      return NextResponse.json(
        { error: "Link this closet first" },
        { status: 400 }
      );
    }

    const result = await applyMarketplaceClosetCheck(id, parsed.data);
    return NextResponse.json({
      ...result,
      shopLinks: shopLinksPayload(result.accounts),
    });
  } catch (err) {
    console.error("admin check closet error:", err);
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 500 }
    );
  }
}
