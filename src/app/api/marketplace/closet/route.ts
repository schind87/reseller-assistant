import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  applyMarketplaceClosetCheck,
  marketplaceClosetCheckBodySchema,
  marketplacePlatformSchema,
} from "@/lib/marketplace-closet-check";
import { parseMarketplaceUsername } from "@/lib/marketplace-profiles";
import {
  deleteMarketplaceAccount,
  listMarketplaceAccounts,
  listMarketplaceClosetItems,
  upsertMarketplaceAccount,
} from "@/lib/supabase/marketplace-closet";

const linkBody = z.object({
  platform: marketplacePlatformSchema,
  username: z.string().min(1).max(120),
});

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
    const parsed = marketplaceClosetCheckBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Could not save closet listings" },
        { status: 400 }
      );
    }

    const result = await applyMarketplaceClosetCheck(
      auth.user.id,
      parsed.data
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("save marketplace closet error:", err);
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 500 }
    );
  }
}
