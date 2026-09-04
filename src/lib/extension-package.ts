import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import JSZip from "jszip";

const SKIP_NAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "README.md",
  "STORE.md",
]);

const LOCAL_APP_MATCHES = [
  "http://localhost/*",
  "http://localhost:3000/*",
  "http://127.0.0.1/*",
  "http://127.0.0.1:3000/*",
];

type ManifestJson = {
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
};

function isLocalAppMatch(match: string): boolean {
  return LOCAL_APP_MATCHES.includes(match);
}

export function productionExtensionManifest(source: ManifestJson): ManifestJson {
  const host_permissions = (source.host_permissions ?? []).filter(
    (match) => !isLocalAppMatch(match)
  );
  const content_scripts = (source.content_scripts ?? []).map((script) => ({
    ...script,
    matches: (script.matches ?? []).filter((match) => !isLocalAppMatch(match)),
  }));
  return { ...source, host_permissions, content_scripts };
}

async function addDir(
  zip: JSZip,
  dirPath: string,
  zipPrefix: string,
  production: boolean
): Promise<number> {
  let added = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_NAMES.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    const zipPath = `${zipPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      added += await addDir(zip, full, zipPath, production);
      continue;
    }
    if (production && entry.name === "manifest.json") {
      const source = JSON.parse(await readFile(full, "utf8")) as ManifestJson;
      zip.file(
        zipPath,
        JSON.stringify(productionExtensionManifest(source), null, 2)
      );
      added += 1;
      continue;
    }
    zip.file(zipPath, await readFile(full));
    added += 1;
  }
  return added;
}

export async function buildExtensionZip(opts?: {
  production?: boolean;
}): Promise<Uint8Array> {
  const production = opts?.production !== false;
  const extensionRoot = path.join(process.cwd(), "extension");
  const rootStat = await stat(extensionRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error("Extension package is not available.");
  }

  const zip = new JSZip();
  const added = await addDir(
    zip,
    extensionRoot,
    "reseller-assistant-extension",
    production
  );
  if (added === 0) {
    throw new Error("Extension package is empty.");
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
}
