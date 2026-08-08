chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) =>
    console.error("Reseller Assistant: side panel setup failed", error)
  );

async function savePairing(payload) {
  const appUrl = String(payload.appUrl || "").replace(/\/+$/, "");
  const token = String(payload.token || "").trim();
  const listingId = String(payload.listingId || "").trim();
  if (!appUrl || !token || !listingId) {
    throw new Error("Missing appUrl, token, or listingId");
  }

  await chrome.storage.local.set({
    appUrl,
    token,
    listingId,
    joinCode: payload.joinCode ? String(payload.joinCode) : null,
    stepIndex: 0,
    pairedAt: Date.now(),
  });

  try {
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: "#1f5c4a" });
  } catch {
    // Badge is best-effort.
  }

  if (payload.openSidePanel) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (error) {
      console.warn("Reseller Assistant: could not open side panel", error);
    }
  }

  return { ok: true, appUrl, listingId };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "applyPairing") {
    void savePairing(message)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Pair failed",
        })
      );
    return true;
  }

  if (message.type === "reloadExtension") {
    chrome.runtime.reload();
    return;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.token?.newValue == null && changes.listingId?.newValue == null) {
    void chrome.action.setBadgeText({ text: "" });
  }
});
