#!/usr/bin/env node
/**
 * Writes src/content/chrome-store-status.json from Chrome Web Store fetchStatus.
 * Skips (exit 0) when CHROME_WEB_STORE_* secrets are missing.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src/content/chrome-store-status.json");

const SECRET_NAMES = [
  "CHROME_WEB_STORE_CLIENT_ID",
  "CHROME_WEB_STORE_CLIENT_SECRET",
  "CHROME_WEB_STORE_REFRESH_TOKEN",
  "CHROME_WEB_STORE_EXTENSION_ID",
  "CHROME_WEB_STORE_PUBLISHER_ID",
];

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const STORE_ROOT = "https://chromewebstore.googleapis.com";

function missingSecrets() {
  return SECRET_NAMES.filter((name) => !process.env[name]?.trim());
}

function itemPath(publisherId, extensionId) {
  return `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
}

function revisionVersion(revision, fallback) {
  const fromChannel = revision?.distributionChannels?.find((channel) =>
    Boolean(channel.crxVersion?.trim())
  )?.crxVersion;
  const version = fromChannel?.trim() || fallback?.trim();
  return version || null;
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function fetchAccessToken(creds) {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
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

async function fetchStatus(creds, token) {
  const url = `${STORE_ROOT}/v2/${itemPath(creds.publisherId, creds.extensionId)}:fetchStatus`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(`Chrome Web Store fetchStatus failed (${response.status}).`);
  }
  return json;
}

function snapshotFromFetchStatus(body) {
  const published = body.publishedItemRevisionStatus;
  const submitted = body.submittedItemRevisionStatus;
  return {
    fetchedAt: new Date().toISOString(),
    takenDown: Boolean(body.takenDown),
    publishedVersion: revisionVersion(published, body.crxVersion),
    publishedState: published?.state?.trim() || null,
    submittedVersion: revisionVersion(submitted),
    submittedState: submitted?.state?.trim() || null,
  };
}

const missing = missingSecrets();
if (missing.length > 0) {
  console.log(
    "Chrome Web Store status skipped — secrets are not set:\n" +
      missing.map((name) => `  - ${name}`).join("\n")
  );
  process.exit(0);
}

const creds = {
  clientId: process.env.CHROME_WEB_STORE_CLIENT_ID.trim(),
  clientSecret: process.env.CHROME_WEB_STORE_CLIENT_SECRET.trim(),
  refreshToken: process.env.CHROME_WEB_STORE_REFRESH_TOKEN.trim(),
  extensionId: process.env.CHROME_WEB_STORE_EXTENSION_ID.trim(),
  publisherId: process.env.CHROME_WEB_STORE_PUBLISHER_ID.trim(),
};

const token = await fetchAccessToken(creds);
const body = await fetchStatus(creds, token);
const snapshot = snapshotFromFetchStatus(body);
await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${path.relative(root, outPath)} published=${snapshot.publishedVersion || "none"} submitted=${snapshot.submittedVersion || "none"} state=${snapshot.submittedState || snapshot.publishedState || "none"}`
);
