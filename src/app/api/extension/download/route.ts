import { NextResponse } from "next/server";
import { buildExtensionZip } from "@/lib/extension-package";

export const runtime = "nodejs";

export async function GET() {
  try {
    const bytes = await buildExtensionZip({ production: true });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="reseller-assistant-extension.zip"',
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("extension download error:", err);
    const missing =
      err instanceof Error && err.message.includes("not available");
    return NextResponse.json(
      {
        error: missing
          ? "Extension package is not available."
          : "Could not build extension download",
      },
      { status: missing ? 404 : 500 }
    );
  }
}
