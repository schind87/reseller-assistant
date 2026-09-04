import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(root, "extension");
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "reseller-assistant-chrome.zip");

const SKIP = new Set([".DS_Store", "Thumbs.db", "README.md", "STORE.md"]);
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

async function addDir(zip, dirPath, zipPrefix) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDir(zip, full, zipPath);
      continue;
    }
    if (entry.name === "manifest.json") {
      const source = JSON.parse(await readFile(full, "utf8"));
      zip.file(zipPath, JSON.stringify(productionManifest(source), null, 2));
      continue;
    }
    zip.file(zipPath, await readFile(full));
  }
}

await mkdir(outDir, { recursive: true });
const zip = new JSZip();
await addDir(zip, extensionRoot, "");
const bytes = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
await writeFile(outFile, bytes);
console.log(`Wrote ${outFile} (${bytes.length} bytes)`);
