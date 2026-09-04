import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  MARKETPLACE_CLOSET_STATUS,
  parseMarketplaceUsername,
} from "@/lib/marketplace-profiles";
import {
  deleteMarketplaceAccount,
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
  recordMarketplaceCheckError,
  replaceMarketplaceClosetItems,
  upsertMarketplaceAccount,
  type ClosetCheckItemInput,
} from "@/lib/supabase/marketplace-closet";
import type { Platform } from "@/lib/types";

const platformSchema = z.enum(["mercari", "poshmark"]);

const linkBody = z.object({
  platform: platformSchema,
  username: z.string().min(1).max(120),
});

const checkItemBody = z.object({
  externalId: z.string().min(1).max(120),
  title: z.string().max(200).nullable(),
  price: z.number().nonnegative().nullable(),
  status: z.enum(MARKETPLACE_CLOSET_STATUS),
  url: z.string().min(1).max(500),
  thumbnailUrl: z.string().max(500).nullable(),
});

const checkBody = z.object({
  platform: platformSchema,
  listings: z.array(checkItemBody).max(200),
  error: z.string().max(240).optional(),
});

function marketplaceHostOk(platform: Platform, url: URL): boolean {
  const host = url.hostname.toLowerCase();
  switch (platform) {
    case "mercari":
      return host === "mercari.com" || host.endsWith(".mercari.com");
    case "poshmark":
      return host === "poshmark.com" || host.endsWith(".poshmark.com");
    default: {
      const _exhaustive: never = platform;
      return _exhaustive;
    }
  }
}

function sanitizeHttpsUrl(raw: string, platform?: Platform): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (platform && !marketplaceHostOk(platform, url)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(auth.user.id),
      listMarketplaceClosetItems(auth.user.id),
    ]);
    return NextResponse.json({ accounts, listings });
  } catch (err) {
    console.error("get marketplace closet error:", err);
    return NextResponse.json(
      { error: "Could not load linked closets" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
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
        {
          error:
            parsed.data.platform === "poshmark"
              ? "Use your Poshmark closet name, or paste the closet URL"
              : "Use your Mercari username, or paste the profile URL",
        },
        { status: 400 }
      );
    }

    const account = await upsertMarketplaceAccount(
      auth.user.id,
      parsed.data.platform,
      username
    );
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(auth.user.id),
      listMarketplaceClosetItems(auth.user.id),
    ]);
    return NextResponse.json({ account, accounts, listings });
  } catch (err) {
    console.error("link marketplace closet error:", err);
    return NextResponse.json(
      { error: "Could not link closet" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const platform = platformSchema.safeParse(
    new URL(request.url).searchParams.get("platform")
  );
  if (!platform.success) {
    return NextResponse.json(
      { error: "Choose Mercari or Poshmark" },
      { status: 400 }
    );
  }

  try {
    await deleteMarketplaceAccount(auth.user.id, platform.data);
    const [accounts, listings] = await Promise.all([
      listMarketplaceAccounts(auth.user.id),
      listMarketplaceClosetItems(auth.user.id),
    ]);
    return NextResponse.json({ accounts, listings });
  } catch (err) {
    console.error("unlink marketplace closet error:", err);
    return NextResponse.json(
      { error: "Could not unlink closet" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = checkBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Could not save closet listings" },
        { status: 400 }
      );
    }

    if (parsed.data.error) {
      await recordMarketplaceCheckError(
        auth.user.id,
        parsed.data.platform,
        parsed.data.error
      );
      const [accounts, listings] = await Promise.all([
        listMarketplaceAccounts(auth.user.id),
        listMarketplaceClosetItems(auth.user.id),
      ]);
      return NextResponse.json({
        accounts,
        listings,
        error: parsed.data.error,
      });
    }

    const items: ClosetCheckItemInput[] = [];
    for (const item of parsed.data.listings) {
      const url = sanitizeHttpsUrl(item.url, parsed.data.platform);
      if (!url) continue;
      const thumbnailUrl = item.thumbnailUrl
        ? sanitizeHttpsUrl(item.thumbnailUrl)
        : null;
      items.push({
        externalId: item.externalId,
        title: item.title?.trim() || null,
        price: item.price,
        status: item.status,
        url,
        thumbnailUrl,
      });
    }

    const listings = await replaceMarketplaceClosetItems(
      auth.user.id,
      parsed.data.platform,
      items
    );
    const accounts = await listMarketplaceAccounts(auth.user.id);
    return NextResponse.json({ accounts, listings });
  } catch (err) {
    console.error("save marketplace closet error:", err);
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 500 }
    );
  }
}
