import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "sidepanel.html",
  "sidepanel.css",
  "sidepanel.js",
  "README.md",
] as const;

async function addDir(
  zip: JSZip,
  dirPath: string,
  zipPrefix: string
): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dirPath, entry.name);
    const zipPath = `${zipPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await addDir(zip, full, zipPath);
      continue;
    }
    const data = await readFile(full);
    zip.file(zipPath, data);
  }
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
    // Prefer known files so we don't ship junk; fall back to full folder.
    let added = 0;
    for (const name of EXTENSION_FILES) {
      const full = path.join(extensionRoot, name);
      try {
        const data = await readFile(full);
        zip.file(`reseller-assistant-extension/${name}`, data);
        added += 1;
      } catch {
        /* optional file */
      }
    }

    if (added === 0) {
      await addDir(zip, extensionRoot, "reseller-assistant-extension");
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
