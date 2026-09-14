import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";
import {
  formatChromeStoreChip,
  snapshotFromFetchStatus,
  type ChromeHelperStoreChip,
  type ChromeStoreFetchStatusResponse,
  type ChromeStoreStatusSnapshot,
} from "@/lib/chrome-store-chip";

export {
  formatChromeStoreChip,
  snapshotFromFetchStatus,
  type ChromeHelperStoreChip,
  type ChromeStoreStatusSnapshot,
};

const SECRET_NAMES = [
  "CHROME_WEB_STORE_CLIENT_ID",
  "CHROME_WEB_STORE_CLIENT_SECRET",
  "CHROME_WEB_STORE_REFRESH_TOKEN",
  "CHROME_WEB_STORE_EXTENSION_ID",
  "CHROME_WEB_STORE_PUBLISHER_ID",
] as const;

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const STORE_ROOT = "https://chromewebstore.googleapis.com";
const SNAPSHOT_PATH = join(process.cwd(), "src/content/chrome-store-status.json");

export function chromeWebStoreSecretsMissing(): string[] {
  return SECRET_NAMES.filter((name) => !process.env[name]?.trim());
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function fetchAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.CHROME_WEB_STORE_CLIENT_ID!.trim(),
    client_secret: process.env.CHROME_WEB_STORE_CLIENT_SECRET!.trim(),
    refresh_token: process.env.CHROME_WEB_STORE_REFRESH_TOKEN!.trim(),
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await readJsonSafe(response);
  if (!response.ok || typeof json.access_token !== "string") {
    throw new Error("Chrome Web Store token request failed.");
  }
  return json.access_token;
}

function itemPath(publisherId: string, extensionId: string): string {
  return `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
}

async function fetchStoreStatusLive(): Promise<ChromeStoreStatusSnapshot> {
  const token = await fetchAccessToken();
  const publisherId = process.env.CHROME_WEB_STORE_PUBLISHER_ID!.trim();
  const extensionId = process.env.CHROME_WEB_STORE_EXTENSION_ID!.trim();
  const url = `${STORE_ROOT}/v2/${itemPath(publisherId, extensionId)}:fetchStatus`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await readJsonSafe(response)) as ChromeStoreFetchStatusResponse;
  if (!response.ok) {
    throw new Error("Chrome Web Store status request failed.");
  }
  return snapshotFromFetchStatus(json);
}

function isUsableSnapshot(value: unknown): value is ChromeStoreStatusSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as ChromeStoreStatusSnapshot;
  return typeof snapshot.fetchedAt === "string" && snapshot.fetchedAt.length > 0;
}

async function readCommittedSnapshot(): Promise<ChromeStoreStatusSnapshot | null> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isUsableSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const getCachedLiveSnapshot = unstable_cache(
  async () => fetchStoreStatusLive(),
  ["chrome-helper-store-status"],
  { revalidate: 300 }
);

/**
 * Live Store status when CHROME_WEB_STORE_* is set. Otherwise the last
 * snapshot GitHub Actions wrote. Never invents a version or review state.
 */
export async function getChromeHelperStoreChip(): Promise<ChromeHelperStoreChip | null> {
  try {
    if (chromeWebStoreSecretsMissing().length === 0) {
      return formatChromeStoreChip(await getCachedLiveSnapshot());
    }
    const snapshot = await readCommittedSnapshot();
    return snapshot ? formatChromeStoreChip(snapshot) : null;
  } catch (err) {
    console.error(
      "Chrome Web Store status unavailable:",
      err instanceof Error ? err.message : err
    );
    const snapshot = await readCommittedSnapshot();
    return snapshot ? formatChromeStoreChip(snapshot) : null;
  }
}
