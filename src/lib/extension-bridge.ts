export const EXTENSION_WEB_SOURCE = "reseller-assistant-web";
export const EXTENSION_ACK_SOURCE = "reseller-assistant-extension";

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

/** Wait briefly for the extension bridge to acknowledge pairing. */
export function waitForExtensionPairAck(
  timeoutMs = 1500
): Promise<{ ok: boolean; error?: string }> {
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
      resolve({
        ok: Boolean(data.ok),
        error: typeof data.error === "string" ? data.error : undefined,
      });
    }

    window.addEventListener("message", onMessage);
  });
}
