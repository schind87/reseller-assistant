import { createAdminClient } from "@/lib/supabase/admin";

export const HOSTED_PROJECT_REF = "gcmbimhkpcilnccrkzlj";

export function assertHostedSupabaseUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    parsed.port === "54321"
  ) {
    throw new Error("Keep-alive refuses a local Supabase URL");
  }
  if (!host.includes(HOSTED_PROJECT_REF)) {
    throw new Error(
      `Keep-alive must target hosted project ${HOSTED_PROJECT_REF}`
    );
  }
  return parsed;
}

export async function touchProjectKeepalive() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  const parsed = assertHostedSupabaseUrl(url);
  const supabase = createAdminClient();
  const pingedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_keepalive")
    .update({ last_ping: pingedAt })
    .eq("id", 1)
    .select("id, last_ping")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.last_ping) {
    throw new Error("Keep-alive write returned no row");
  }

  return {
    ok: true as const,
    project: HOSTED_PROJECT_REF,
    host: parsed.hostname,
    last_ping: data.last_ping as string,
  };
}
