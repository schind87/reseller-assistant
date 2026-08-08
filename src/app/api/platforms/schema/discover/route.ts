import { NextResponse } from "next/server";
import {
  discoverSchemaBody,
  saveDiscoveredSchema,
} from "@/lib/listing-schema-service";
import { authorizeSchemaSync } from "@/lib/schema-auth";

/**
 * Accept discovered sell-form fields from the Chrome extension (or a manual sync).
 * Merges onto the seed schema so review/post stay aligned with the live marketplace.
 */
export async function POST(request: Request) {
  const denied = await authorizeSchemaSync(request);
  if (denied) return denied;

  try {
    const json = await request.json();
    const parsed = discoverSchemaBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid discovery payload" },
        { status: 400 }
      );
    }

    const schema = await saveDiscoveredSchema({
      platform: parsed.data.platform,
      sellPageUrl: parsed.data.sellPageUrl,
      discovered: parsed.data.fields,
    });

    return NextResponse.json({
      schema,
      message: `Updated ${schema.platform} form fields from the live sell page.`,
    });
  } catch (err) {
    console.error("discover listing schema error:", err);
    return NextResponse.json(
      { error: "Could not save discovered schema" },
      { status: 500 }
    );
  }
}
