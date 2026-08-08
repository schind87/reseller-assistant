import { NextResponse } from "next/server";
import { resolveListingSchema } from "@/lib/listing-schema-service";
import { authorizeSchemaSync } from "@/lib/schema-auth";
import type { Platform } from "@/lib/types";

type RouteContext = { params: Promise<{ platform: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await authorizeSchemaSync(request);
  if (denied) return denied;

  const { platform: raw } = await context.params;
  if (raw !== "mercari" && raw !== "poshmark") {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }

  try {
    const schema = await resolveListingSchema(raw as Platform);
    return NextResponse.json({ schema });
  } catch (err) {
    console.error("get listing schema error:", err);
    return NextResponse.json(
      { error: "Could not load listing schema" },
      { status: 500 }
    );
  }
}
