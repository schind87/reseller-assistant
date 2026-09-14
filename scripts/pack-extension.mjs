import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(root, "extension");
const outDir = path.join(root, "dist");
const unpackedDir = path.join(outDir, "reseller-assistant-chrome");
const outFile = path.join(outDir, "reseller-assistant-chrome.zip");

const SKIP = new Set([".DS_Store", "Thumbs.db", "README.md", "STORE.md"]);
const SKIP_DIRS = new Set(["store-assets"]);
const LOCAL_APP_MATCHES = new Set([
  "http://localhost/*",
  "http://localhost:3000/*",
  "http://127.0.0.1/*",
  "http://127.0.0.1:3000/*",
]);

function productionManifest(source) {
  return {
    ...source,
    host_permissions: (source.host_permissions ?? []).filter(
      (match) => !LOCAL_APP_MATCHES.has(match)
    ),
    content_scripts: (source.content_scripts ?? []).map((script) => ({
      ...script,
      matches: (script.matches ?? []).filter(
        (match) => !LOCAL_APP_MATCHES.has(match)
      ),
    })),
  };
}

async function addDir(zip, dirPath, zipPrefix, diskPrefix) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    const diskPath = path.join(diskPrefix, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await mkdir(diskPath, { recursive: true });
      await addDir(zip, full, zipPath, diskPath);
      continue;
    }
    let bytes;
    if (entry.name === "manifest.json") {
      const source = JSON.parse(await readFile(full, "utf8"));
      bytes = Buffer.from(JSON.stringify(productionManifest(source), null, 2));
    } else {
      bytes = await readFile(full);
    }
    zip.file(zipPath, bytes);
    await writeFile(diskPath, bytes);
  }
}

await mkdir(outDir, { recursive: true });
await rm(unpackedDir, { recursive: true, force: true });
await mkdir(unpackedDir, { recursive: true });
const zip = new JSZip();
await addDir(zip, extensionRoot, "", unpackedDir);
const bytes = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
await writeFile(outFile, bytes);
const manifest = JSON.parse(await readFile(path.join(unpackedDir, "manifest.json"), "utf8"));
console.log(`Wrote ${outFile} (${bytes.length} bytes) version ${manifest.version}`);
console.log(`Wrote unpacked ${unpackedDir} (Load unpacked this folder)`);
