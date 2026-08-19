import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db"]);

async function addDir(
  zip: JSZip,
  dirPath: string,
  zipPrefix: string
): Promise<number> {
  let added = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_NAMES.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    const zipPath = `${zipPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      added += await addDir(zip, full, zipPath);
      continue;
    }
    const data = await readFile(full);
    zip.file(zipPath, data);
    added += 1;
  }
  return added;
}

export async function GET() {
  try {
    const extensionRoot = path.join(process.cwd(), "extension");
    const rootStat = await stat(extensionRoot).catch(() => null);
    if (!rootStat?.isDirectory()) {
      return NextResponse.json(
        { error: "Extension package is not available." },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    // Ship the whole extension folder so new scripts (e.g. coach-shared.js)
    // are never left out of a hand-maintained whitelist.
    const added = await addDir(zip, extensionRoot, "reseller-assistant-extension");

    if (added === 0) {
      return NextResponse.json(
        { error: "Extension package is empty." },
        { status: 404 }
      );
    }

    const bytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });

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
    return NextResponse.json(
      { error: "Could not build extension download" },
      { status: 500 }
    );
  }
}
