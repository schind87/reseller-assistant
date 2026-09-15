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

  function getRuntime() {
    try {
      const chromeObj = globalThis.chrome;
      const runtime = chromeObj && chromeObj.runtime;
      if (!runtime || !runtime.id) return null;
      return runtime;
    } catch {
      return null;
    }
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  function sendViaPort(port, message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        callback(value);
      }

      port.onMessage.addListener((reply) => {
        if (!reply || typeof reply !== "object") return;
        if (
          message.type === "checkCloset" &&
          reply.type === "checkClosetResult"
        ) {
          finish(resolve, reply.result);
          return;
        }
        if (
          message.type === "detectClosetUsername" &&
          reply.type === "detectClosetUsernameResult"
        ) {
          finish(resolve, reply.result);
        }
      });

      try {
        port.postMessage(message);
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function sendViaMessage(runtime, message) {
    if (!runtime || typeof runtime.sendMessage !== "function") {
      return Promise.reject(new Error("Could not check closet"));
    }
    try {
      const result = runtime.sendMessage(message);
      if (result && typeof result.then === "function") {
        return result;
      }
      return Promise.reject(new Error("Could not check closet"));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // Hold a port so the MV3 service worker stays alive during a slow closet
  // read. Prefer sendMessage when it exists (older helpers). If sendMessage is
  // missing or throws, fall back to the port RPC added in 0.7.0.9.
  function sendHelperTask(message, timeoutMs, timeoutMessage) {
    const runtime = getRuntime();
    if (!runtime) {
      return Promise.reject(new Error("Could not check closet"));
    }

    let port = null;
    try {
      port = runtime.connect({ name: "ra-web" });
    } catch {
      port = null;
    }

    const viaMessage = sendViaMessage(runtime, message);
    const rpc = viaMessage.catch((error) => {
      if (!port) throw error;
      return sendViaPort(port, message);
    });

    return withTimeout(rpc, timeoutMs, timeoutMessage).finally(() => {
      try {
        port?.disconnect();
      } catch {
        // already closed
      }
    });
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

    const runtime = getRuntime();
    if (!runtime) {
      throw new Error("Could not pair Chrome helper");
    }

    const appUrl = normalizeAppUrl(payload.appUrl || window.location.origin);
    const result = await sendViaMessage(runtime, {
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

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    try {
      if (data.type === "ping-extension") {
        window.postMessage(
          { source: ACK_SOURCE, type: "bridge-ready" },
          window.location.origin
        );
        return;
      }

      if (data.type === "check-closet") {
        void sendHelperTask(
          {
            type: "checkCloset",
            platform: data.platform,
            username: data.username,
            closetUrl: data.closetUrl,
          },
          50000,
          "The closet page took too long to read. Keep it open in Chrome, then try Check listings again."
        )
          .then((result) => postClosetCheck(result))
          .catch((error) => postClosetCheck(null, error));
        return;
      }

      if (data.type === "detect-closet-username") {
        void sendHelperTask(
          {
            type: "detectClosetUsername",
            platform: data.platform,
          },
          40000,
          "Looking for your closet took too long. Sign in to that store in Chrome, then try Find my closet again."
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
    } catch (error) {
      if (data.type === "check-closet") {
        postClosetCheck(null, error);
        return;
      }
      if (data.type === "detect-closet-username") {
        postClosetUsername(null, error);
      }
    }
  });

  // Announce that the extension bridge is present for the web UI.
  window.postMessage(
    { source: ACK_SOURCE, type: "bridge-ready" },
    window.location.origin
  );
})();
