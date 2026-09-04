import type {
  MarketplaceClosetStatus,
} from "@/lib/marketplace-profiles";
import type { Platform } from "@/lib/types";

export const EXTENSION_WEB_SOURCE = "reseller-assistant-web";
export const EXTENSION_ACK_SOURCE = "reseller-assistant-extension";
export const EXTENSION_PRESENT_KEY = "ra-extension-present";

export type ExtensionPairPayload = {
  token: string;
  listingId: string;
  joinCode?: string | null;
  appUrl?: string;
  openSidePanel?: boolean;
};

/** Ask the installed Chrome extension to pair with this listing. */
export function requestExtensionPair(payload: ExtensionPairPayload): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      source: EXTENSION_WEB_SOURCE,
      type: "pair-extension",
      appUrl: payload.appUrl ?? window.location.origin,
      token: payload.token,
      listingId: payload.listingId,
      joinCode: payload.joinCode ?? null,
      openSidePanel: payload.openSidePanel !== false,
    },
    window.location.origin
  );
}

/** Listen for ack first, then post the pair message so the ack cannot be missed. */
export async function pairExtensionWithListing(
  payload: ExtensionPairPayload,
  timeoutMs = 2000
): Promise<{ ok: boolean; error?: string }> {
  const pending = waitForExtensionPairAck(timeoutMs);
  requestExtensionPair(payload);
  const ack = await pending;
  if (
    ack.ok &&
    ack.listingId &&
    String(ack.listingId) !== String(payload.listingId)
  ) {
    return { ok: false, error: "Extension paired a different listing" };
  }
  return ack;
}

/** Ask the content-script bridge to announce itself. */
export function pingExtensionBridge(): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    { source: EXTENSION_WEB_SOURCE, type: "ping-extension" },
    window.location.origin
  );
}

export function rememberExtensionPresent(present: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (present) {
      window.sessionStorage.setItem(EXTENSION_PRESENT_KEY, "1");
    } else {
      window.sessionStorage.removeItem(EXTENSION_PRESENT_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function readCachedExtensionPresent(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(EXTENSION_PRESENT_KEY);
    if (value === "1") return true;
    return null;
  } catch {
    return null;
  }
}

/** Wait briefly for the extension bridge to acknowledge pairing. */
export function waitForExtensionPairAck(
  timeoutMs = 1500
): Promise<{ ok: boolean; error?: string; listingId?: string }> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "No window" });
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "Extension not detected" });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== EXTENSION_ACK_SOURCE) return;
      if (data.type !== "pair-ack") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      rememberExtensionPresent(true);
      resolve({
        ok: Boolean(data.ok),
        error: typeof data.error === "string" ? data.error : undefined,
        listingId:
          typeof data.listingId === "string" ? data.listingId : undefined,
      });
    }

    window.addEventListener("message", onMessage);
  });
}

/** Detect whether the Reseller Assistant Chrome extension bridge is present. */
export function detectExtensionPresent(
  timeoutMs = 700
): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  const cached = readCachedExtensionPresent();
  if (cached === true) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;

    function finish(present: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (present) rememberExtensionPresent(true);
      resolve(present);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== EXTENSION_ACK_SOURCE) return;
      if (data.type === "bridge-ready" || data.type === "pair-ack") {
        finish(true);
      }
    }

    window.addEventListener("message", onMessage);
    pingExtensionBridge();
    const timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}

export type ClosetCheckListing = {
  externalId: string;
  title: string | null;
  price: number | null;
  status: MarketplaceClosetStatus;
  url: string;
  thumbnailUrl: string | null;
};

export type ClosetCheckResult = {
  ok: boolean;
  listings: ClosetCheckListing[];
  error?: string;
  loginRequired?: boolean;
};

export type ClosetCheckPayload = {
  platform: Platform;
  username: string;
  closetUrl: string;
};

export function requestClosetCheck(payload: ClosetCheckPayload): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      source: EXTENSION_WEB_SOURCE,
      type: "check-closet",
      platform: payload.platform,
      username: payload.username,
      closetUrl: payload.closetUrl,
    },
    window.location.origin
  );
}

export function waitForClosetCheckResult(
  timeoutMs = 28000
): Promise<ClosetCheckResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      ok: false,
      listings: [],
      error: "No window",
    });
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({
        ok: false,
        listings: [],
        error: "Timed out waiting for the closet page. Reload the Chrome helper, then try again.",
      });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== EXTENSION_ACK_SOURCE) return;
      if (data.type !== "closet-check-result") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      rememberExtensionPresent(true);
      resolve({
        ok: Boolean(data.ok),
        listings: Array.isArray(data.listings) ? data.listings : [],
        error: typeof data.error === "string" ? data.error : undefined,
        loginRequired: Boolean(data.loginRequired),
      });
    }

    window.addEventListener("message", onMessage);
  });
}

export async function checkClosetWithExtension(
  payload: ClosetCheckPayload,
  timeoutMs = 28000
): Promise<ClosetCheckResult> {
  const pending = waitForClosetCheckResult(timeoutMs);
  requestClosetCheck(payload);
  return pending;
}

export type ClosetUsernameResult = {
  ok: boolean;
  username?: string;
  error?: string;
  loginRequired?: boolean;
};

export function requestClosetUsername(platform: Platform): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      source: EXTENSION_WEB_SOURCE,
      type: "detect-closet-username",
      platform,
    },
    window.location.origin
  );
}

export function waitForClosetUsernameResult(
  timeoutMs = 22000
): Promise<ClosetUsernameResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "No window" });
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({
        ok: false,
        error:
          "Timed out looking for your closet. Reload the Chrome helper, then try again.",
      });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== EXTENSION_ACK_SOURCE) return;
      if (data.type !== "closet-username-result") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      rememberExtensionPresent(true);
      resolve({
        ok: Boolean(data.ok),
        username:
          typeof data.username === "string" ? data.username : undefined,
        error: typeof data.error === "string" ? data.error : undefined,
        loginRequired: Boolean(data.loginRequired),
      });
    }

    window.addEventListener("message", onMessage);
  });
}

export async function detectClosetUsernameWithExtension(
  platform: Platform,
  timeoutMs = 22000
): Promise<ClosetUsernameResult> {
  const pending = waitForClosetUsernameResult(timeoutMs);
  requestClosetUsername(platform);
  return pending;
}
