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
    const result = await chrome.runtime.sendMessage({
      type: "applyPairing",
      appUrl,
      token,
      listingId,
      joinCode: payload.joinCode ? String(payload.joinCode) : null,
      openSidePanel: payload.openSidePanel !== false,
    });
    if (!result?.ok) {
      throw new Error(result?.error || "Pair failed");
    }
    acknowledge({ listingId, appUrl });
    return true;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    if (data.type === "ping-extension") {
      window.postMessage(
        { source: ACK_SOURCE, type: "bridge-ready" },
        window.location.origin
      );
      return;
    }

    function postClosetCheck(result, error) {
      window.postMessage(
        {
          source: ACK_SOURCE,
          type: "closet-check-result",
          ok: Boolean(result?.ok),
          listings: result?.listings || [],
          error:
            typeof result?.error === "string"
              ? result.error
              : error instanceof Error
                ? error.message
                : error
                  ? "Could not check closet"
                  : undefined,
          loginRequired: Boolean(result?.loginRequired),
        },
        window.location.origin
      );
    }

    function postClosetUsername(result, error) {
      window.postMessage(
        {
          source: ACK_SOURCE,
          type: "closet-username-result",
          ok: Boolean(result?.ok),
          username:
            typeof result?.username === "string" ? result.username : undefined,
          error:
            typeof result?.error === "string"
              ? result.error
              : error instanceof Error
                ? error.message
                : error
                  ? "Could not find closet name"
                  : undefined,
          loginRequired: Boolean(result?.loginRequired),
        },
        window.location.origin
      );
    }

    // Holding a port open keeps the MV3 service worker alive while Check
    // listings waits on a slow closet page. The RPC stays on sendMessage so
    // older helpers still respond.
    function withHelperPort(run) {
      let port = null;
      try {
        port = chrome.runtime.connect({ name: "ra-web" });
      } catch {
        // sendMessage still works without the port.
      }
      return Promise.resolve()
        .then(run)
        .finally(() => {
          try {
            port?.disconnect();
          } catch {
            // already closed
          }
        });
    }

    if (data.type === "check-closet") {
      void withHelperPort(() =>
        chrome.runtime.sendMessage({
          type: "checkCloset",
          platform: data.platform,
          username: data.username,
          closetUrl: data.closetUrl,
        })
      )
        .then((result) => postClosetCheck(result))
        .catch((error) => postClosetCheck(null, error));
      return;
    }

    if (data.type === "detect-closet-username") {
      void withHelperPort(() =>
        chrome.runtime.sendMessage({
          type: "detectClosetUsername",
          platform: data.platform,
        })
      )
        .then((result) => postClosetUsername(result))
        .catch((error) => postClosetUsername(null, error));
      return;
    }

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
