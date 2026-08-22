/** UI hint only. Never treat this as authentication. */

export const REMEMBERED_IDENTITY_KEY = "ra-sign-in:v1";
const LEGACY_EMAIL_KEY = "ra-remember-email";

export type RememberedIdentity = {
  v: 1;
  email: string;
  hasPin: boolean;
};

export function normalizeRememberedEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function rememberedEmailsMatch(a: string, b: string): boolean {
  return normalizeRememberedEmail(a) === normalizeRememberedEmail(b);
}

function notifyRememberedIdentityChanged() {
  window.dispatchEvent(new Event("storage"));
}

function parseIdentity(raw: string | null): RememberedIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedIdentity>;
    if (
      parsed?.v === 1 &&
      typeof parsed.email === "string" &&
      parsed.email.includes("@")
    ) {
      return {
        v: 1,
        email: parsed.email.trim(),
        hasPin: Boolean(parsed.hasPin),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Stable string for useSyncExternalStore. Empty means no remembered identity. */
export function getRememberedIdentitySnapshot(): string {
  try {
    const raw = window.localStorage.getItem(REMEMBERED_IDENTITY_KEY);
    if (raw) return raw;
    const legacy = window.localStorage.getItem(LEGACY_EMAIL_KEY);
    if (legacy?.includes("@")) {
      const migrated: RememberedIdentity = {
        v: 1,
        email: legacy.trim(),
        hasPin: false,
      };
      const next = JSON.stringify(migrated);
      window.localStorage.setItem(REMEMBERED_IDENTITY_KEY, next);
      window.localStorage.removeItem(LEGACY_EMAIL_KEY);
      return next;
    }
    return "";
  } catch {
    return "";
  }
}

export function parseRememberedIdentity(
  raw: string | null | undefined
): RememberedIdentity | null {
  return parseIdentity(raw || null);
}

export function readRememberedIdentity(): RememberedIdentity | null {
  return parseRememberedIdentity(getRememberedIdentitySnapshot());
}

export function saveRememberedIdentity(email: string, hasPin: boolean): void {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return;
  try {
    const next: RememberedIdentity = {
      v: 1,
      email: trimmed,
      hasPin,
    };
    window.localStorage.setItem(REMEMBERED_IDENTITY_KEY, JSON.stringify(next));
    window.localStorage.removeItem(LEGACY_EMAIL_KEY);
    notifyRememberedIdentityChanged();
  } catch {
    // ignore storage failures
  }
}

export function clearRememberedIdentity(): void {
  try {
    window.localStorage.removeItem(REMEMBERED_IDENTITY_KEY);
    window.localStorage.removeItem(LEGACY_EMAIL_KEY);
    notifyRememberedIdentityChanged();
  } catch {
    // ignore storage failures
  }
}

export function subscribeRememberedIdentity(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function rememberedHasPinForEmail(
  identity: RememberedIdentity | null,
  email: string
): boolean {
  if (!identity?.hasPin) return false;
  return rememberedEmailsMatch(identity.email, email);
}
