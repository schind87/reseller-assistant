/**
 * Runs on Reseller Assistant web pages. Relays pairing payloads from the site
 * into extension storage so the side panel connects without manual codes.
 */
(function () {
  const SOURCE = "reseller-assistant-web";
  const ACK_SOURCE = "reseller-assistant-extension";

  function normalizeAppUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return window.location.origin;
    }
  }

  function acknowledge(detail) {
    window.postMessage(
      {
        source: ACK_SOURCE,
        type: "pair-ack",
        ok: true,
        ...detail,
      },
      window.location.origin
    );
  }

  async function applyPairing(payload) {
    const token = String(payload.token || "").trim();
    const listingId = String(payload.listingId || "").trim();
    if (!token || !listingId) return false;

    const appUrl = normalizeAppUrl(payload.appUrl || window.location.origin);
    await chrome.runtime.sendMessage({
      type: "applyPairing",
      appUrl,
      token,
      listingId,
      joinCode: payload.joinCode ? String(payload.joinCode) : null,
      openSidePanel: payload.openSidePanel !== false,
    });
    acknowledge({ listingId, appUrl });
    return true;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;
    if (data.type !== "pair-extension") return;
    void applyPairing(data).catch((error) => {
      console.error("Reseller Assistant bridge pair failed:", error);
      window.postMessage(
        {
          source: ACK_SOURCE,
          type: "pair-ack",
          ok: false,
          error: error instanceof Error ? error.message : "Pair failed",
        },
        window.location.origin
      );
    });
  });

  // Announce that the extension bridge is present for the web UI.
  window.postMessage(
    { source: ACK_SOURCE, type: "bridge-ready" },
    window.location.origin
  );
})();
