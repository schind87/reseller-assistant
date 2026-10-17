#!/usr/bin/env node
/**
 * Writes public.project_keepalive.last_ping on the hosted Supabase project
 * so Free-plan inactivity pausing does not fire. Refuses localhost.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL — defaults to the hosted project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — or SUPABASE_ANON_KEY; optional if
 *     KEEPALIVE_APP_URL is set
 *   KEEPALIVE_APP_URL — production app origin that exposes
 *     /api/cron/supabase-keepalive
 */
const HOSTED_PROJECT_REF = "gcmbimhkpcilnccrkzlj";
const DEFAULT_HOSTED_URL = `https://${HOSTED_PROJECT_REF}.supabase.co`;
const DEFAULT_APP_URL = "https://reseller.mvfeed.us";

function hostedUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_HOSTED_URL).replace(
    /\/$/,
    ""
  );
}

function anonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

function assertHostedSupabaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Supabase URL: ${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    parsed.port === "54321"
  ) {
    throw new Error(`Keep-alive refuses a local Supabase URL (${host})`);
  }
  if (!host.includes(HOSTED_PROJECT_REF)) {
    throw new Error(
      `Keep-alive must target hosted project ${HOSTED_PROJECT_REF}, got ${host}`
    );
  }
  return parsed;
}

function isRecent(iso, maxAgeMs = 2 * 60 * 1000) {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return Math.abs(Date.now() - at) <= maxAgeMs;
}

async function pingRest(url, key) {
  const parsed = assertHostedSupabaseUrl(url);
  const pingedAt = new Date().toISOString();
  const endpoint = `${parsed.origin}/rest/v1/project_keepalive?id=eq.1`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const patch = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ last_ping: pingedAt }),
  });
  const patchText = await patch.text();
  if (!patch.ok) {
    throw new Error(
      `Hosted REST PATCH ${patch.status} ${patch.statusText} (${parsed.hostname})`
    );
  }

  let rows;
  try {
    rows = JSON.parse(patchText);
  } catch {
    throw new Error("Hosted REST PATCH did not return JSON");
  }
  const lastPing = rows?.[0]?.last_ping;
  if (!lastPing || !isRecent(lastPing)) {
    throw new Error("Hosted REST write did not return a fresh last_ping");
  }

  const read = await fetch(`${endpoint}&select=id,last_ping`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!read.ok) {
    throw new Error(`Hosted REST GET ${read.status} (${parsed.hostname})`);
  }
  const readRows = await read.json();
  const readPing = readRows?.[0]?.last_ping;
  if (!readPing || !isRecent(readPing)) {
    throw new Error("Hosted REST read-back was missing or stale");
  }

  return {
    ok: true,
    source: "rest",
    project: HOSTED_PROJECT_REF,
    host: parsed.hostname,
    last_ping: readPing,
  };
}

async function pingApp(appUrl) {
  const origin = appUrl.replace(/\/$/, "");
  const parsed = new URL(origin);
  if (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1"
  ) {
    throw new Error("Keep-alive app URL must not be localhost");
  }
  const headers = {};
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`;
  }
  const response = await fetch(`${origin}/api/cron/supabase-keepalive`, {
    headers,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`App keep-alive ${response.status} from ${parsed.hostname}`);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("App keep-alive did not return JSON");
  }
  if (!body?.ok || !String(body.host || "").includes(HOSTED_PROJECT_REF)) {
    throw new Error(
      "App keep-alive did not confirm the hosted Supabase project"
    );
  }
  if (!body.last_ping || !isRecent(body.last_ping)) {
    throw new Error("App keep-alive last_ping was missing or stale");
  }
  return {
    ok: true,
    source: "app",
    project: HOSTED_PROJECT_REF,
    host: body.host,
    last_ping: body.last_ping,
  };
}

async function main() {
  const results = [];
  const errors = [];
  const key = anonKey();
  if (key) {
    try {
      results.push(await pingRest(hostedUrl(), key));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const appUrl = (process.env.KEEPALIVE_APP_URL || "").trim();
  const shouldPingApp = Boolean(appUrl) || !key;
  if (shouldPingApp) {
    try {
      results.push(await pingApp(appUrl || DEFAULT_APP_URL));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (results.length === 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          project: HOSTED_PROJECT_REF,
          errors,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
}

await main();
