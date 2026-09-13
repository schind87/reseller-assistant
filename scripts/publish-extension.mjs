import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = path.join(root, "dist", "reseller-assistant-chrome.zip");

const SECRET_NAMES = [
  "CHROME_WEB_STORE_CLIENT_ID",
  "CHROME_WEB_STORE_CLIENT_SECRET",
  "CHROME_WEB_STORE_REFRESH_TOKEN",
  "CHROME_WEB_STORE_EXTENSION_ID",
  "CHROME_WEB_STORE_PUBLISHER_ID",
];

const SENSITIVE_KEY = /token|secret|authorization|refresh|password|credential/i;
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const STORE_ROOT = "https://chromewebstore.googleapis.com";
const UPLOAD_WAIT_MS = 60_000;
const UPLOAD_POLL_MS = 2_000;

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  return {
    skipPack: flags.has("--skip-pack"),
    noPublish: flags.has("--no-publish"),
    require: flags.has("--require"),
  };
}

function envFlag(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  return !/^(0|false|no|off)$/i.test(raw.trim());
}

function missingSecrets() {
  return SECRET_NAMES.filter((name) => !process.env[name]?.trim());
}

function skipMessage(missing) {
  return [
    "Chrome Web Store upload skipped — required secrets are not set.",
    "Add these GitHub Actions secrets (Settings → Secrets and variables → Actions).",
    "Do not commit them. Do not put them on Vercel.",
    ...missing.map((name) => `  - ${name}`),
    "How to create them: extension/STORE.md (Publish from CI).",
    "The packed zip is still at dist/reseller-assistant-chrome.zip.",
  ].join("\n");
}

function sanitizeForLog(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeForLog(nested);
    }
    return out;
  }
  return value;
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

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const body = await readJsonSafe(response);
  if (!response.ok) {
    const summary = JSON.stringify(sanitizeForLog(body));
    throw new Error(`Chrome Web Store API ${response.status} ${url}: ${summary}`);
  }
  return body;
}

function itemPath(publisherId, extensionId) {
  return `publishers/${publisherId}/items/${extensionId}`;
}

async function fetchAccessToken(creds) {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  });
  const json = await requestJson(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!json.access_token || typeof json.access_token !== "string") {
    throw new Error("Chrome Web Store token response did not include an access token.");
  }
  return json.access_token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function fetchStatus(creds, token) {
  const url = `${STORE_ROOT}/v2/${itemPath(creds.publisherId, creds.extensionId)}:fetchStatus`;
  return requestJson(url, { method: "GET", headers: authHeaders(token) });
}

const UPLOAD_OK = new Set([
  "",
  "SUCCESS",
  "SUCCEEDED",
  "UPLOAD_SUCCESS",
  "UPLOAD_SUCCEEDED",
]);

function uploadState(resource) {
  return resource.uploadState ?? resource.lastAsyncUploadState ?? "";
}

function isUploadOk(state) {
  return UPLOAD_OK.has(state);
}

async function waitForUpload(creds, token, initial, startedAt) {
  let resource = initial;
  while (uploadState(resource) === "UPLOAD_IN_PROGRESS" || uploadState(resource) === "IN_PROGRESS") {
    if (Date.now() - startedAt > UPLOAD_WAIT_MS) {
      throw new Error("Chrome Web Store upload stayed in progress too long.");
    }
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_POLL_MS));
    resource = await fetchStatus(creds, token);
  }
  const state = uploadState(resource);
  if (!isUploadOk(state)) {
    throw new Error(
      `Chrome Web Store upload did not succeed (${state || "empty"}). Bump extension/manifest.json version if this zip was already submitted.`
    );
  }
  return resource;
}

async function uploadZip(creds, token, zipBytes) {
  const url = `${STORE_ROOT}/upload/v2/${itemPath(creds.publisherId, creds.extensionId)}:upload`;
  const resource = await requestJson(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "X-Goog-Upload-Protocol": "raw",
      "X-Goog-Upload-File-Name": "reseller-assistant-chrome.zip",
    },
    body: zipBytes,
  });
  return waitForUpload(creds, token, resource, Date.now());
}

async function publishItem(creds, token) {
  const url = `${STORE_ROOT}/v2/${itemPath(creds.publisherId, creds.extensionId)}:publish`;
  return requestJson(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requireSecrets = args.require || envFlag("CHROME_WEB_STORE_REQUIRE", false);
  const shouldPublish = !args.noPublish && envFlag("CHROME_WEB_STORE_PUBLISH", true);

  if (!args.skipPack) {
    await import("./pack-extension.mjs");
  }

  const missing = missingSecrets();
  if (missing.length > 0) {
    const message = skipMessage(missing);
    if (requireSecrets) {
      console.error(message);
      process.exit(1);
    }
    console.log(message);
    return;
  }

  const creds = {
    clientId: process.env.CHROME_WEB_STORE_CLIENT_ID.trim(),
    clientSecret: process.env.CHROME_WEB_STORE_CLIENT_SECRET.trim(),
    refreshToken: process.env.CHROME_WEB_STORE_REFRESH_TOKEN.trim(),
    extensionId: process.env.CHROME_WEB_STORE_EXTENSION_ID.trim(),
    publisherId: process.env.CHROME_WEB_STORE_PUBLISHER_ID.trim(),
  };

  let zipBytes;
  try {
    zipBytes = await readFile(zipPath);
  } catch {
    throw new Error("Missing dist/reseller-assistant-chrome.zip. Run npm run extension:pack first.");
  }
  console.log(`Uploading store zip (${zipBytes.length} bytes) for item ${creds.extensionId}.`);

  const token = await fetchAccessToken(creds);
  const uploaded = await uploadZip(creds, token, zipBytes);
  console.log(
    `Upload ${uploadState(uploaded) || "ok"} for ${creds.extensionId}${
      uploaded.crxVersion ? ` (crx ${uploaded.crxVersion})` : ""
    }.`
  );

  if (!shouldPublish) {
    console.log("Draft uploaded. Not submitted for Google review (--no-publish).");
    return;
  }

  const published = await publishItem(creds, token);
  const state = published.state ? ` state=${published.state}` : "";
  console.log(
    `Submitted for Chrome Web Store review${state}. Google still has to approve the listing.`
  );
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
