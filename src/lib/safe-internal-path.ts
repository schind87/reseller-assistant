const DEFAULT_AFTER_AUTH = "/app";

function looksLikeExternalPath(value: string): boolean {
  if (!value.startsWith("/")) return true;
  if (value.startsWith("//") || value.startsWith("/\\")) return true;
  if (value.includes("\\") || value.includes("://")) return true;
  return false;
}

/** Local path only. Rejects protocol-relative and open-redirect values. */
export function safeInternalPath(next: unknown): string {
  const raw = Array.isArray(next) ? next[0] : next;
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_AFTER_AUTH;
  if (looksLikeExternalPath(raw)) return DEFAULT_AFTER_AUTH;
  try {
    const decoded = decodeURIComponent(raw);
    if (looksLikeExternalPath(decoded)) return DEFAULT_AFTER_AUTH;
    if (decoded === "/unlock" || decoded.startsWith("/unlock?")) {
      return DEFAULT_AFTER_AUTH;
    }
  } catch {
    return DEFAULT_AFTER_AUTH;
  }
  if (raw === "/unlock" || raw.startsWith("/unlock?")) return DEFAULT_AFTER_AUTH;
  return raw;
}
