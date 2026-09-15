import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminClosetCheckResponse,
  profileExists,
  shopLinksPayload,
} from "@/lib/admin-closet-api";
import { requireAdmin } from "@/lib/admin";
import { marketplacePlatformSchema } from "@/lib/marketplace-closet-check";
import {
  closetUsernameParseError,
  parseMarketplaceUsername,
} from "@/lib/marketplace-profiles";
import {
  deleteMarketplaceAccount,
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
  upsertMarketplaceAccount,
} from "@/lib/supabase/marketplace-closet";

type RouteContext = { params: Promise<{ id: string }> };

const linkBody = z.object({
  platform: marketplacePlatformSchema,
  username: z.string().min(1).max(120),
});

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
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(id),
      listMarketplaceClosetItems(id),
    ]);
    return NextResponse.json({
      account: { platform: account.platform, username: account.username },
      shopLinks: shopLinksPayload(accounts),
      listings,
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
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(id),
      listMarketplaceClosetItems(id),
    ]);
    return NextResponse.json({
      shopLinks: shopLinksPayload(accounts),
      listings,
    });
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

    const json = await request.json().catch(() => null);
    return await adminClosetCheckResponse(id, json);
  } catch (err) {
    console.error("admin check closet error:", err);
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 500 }
    );
  }
}
