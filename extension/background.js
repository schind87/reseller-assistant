/* global RA_COACH_STEPS, RA_DETAIL_FIELDS, raIsMarketplaceUrl, raPlatformFromUrl,
   raFieldValueFromListing, raListingPhotoMeta, raPreviewForStep */

importScripts("coach-shared.js");

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
    listingCache: null,
  });

  try {
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: "#1f5c4a" });
  } catch {
    // Badge is best-effort.
  }

  try {
    await refreshListingCache();
  } catch (error) {
    console.warn("Reseller Assistant: listing cache refresh failed", error);
  }

  await broadcastCoachState();

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

async function getPairing() {
  const stored = await chrome.storage.local.get([
    "appUrl",
    "token",
    "listingId",
    "stepIndex",
    "listingCache",
  ]);
  if (!stored.token || !stored.listingId) return null;
  return {
    appUrl: String(stored.appUrl || "").replace(/\/+$/, ""),
    token: String(stored.token),
    listingId: String(stored.listingId),
    stepIndex: Number.isInteger(stored.stepIndex) ? stored.stepIndex : 0,
    listing: stored.listingCache || null,
  };
}

async function refreshListingCache() {
  const pairing = await getPairing();
  if (!pairing) return null;

  const res = await fetch(
    `${pairing.appUrl}/api/listings/${pairing.listingId}/extension`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${pairing.token}`,
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Could not load listing (${res.status})`);
  }
  const listing = json.listing || json;
  await chrome.storage.local.set({ listingCache: listing });
  return listing;
}

async function buildCoachState(extra = {}) {
  const pairing = await getPairing();
  if (!pairing) {
    return {
      ok: true,
      paired: false,
      steps: RA_COACH_STEPS,
      stepIndex: 0,
      message:
        "Open your listing’s Post checklist in Reseller Assistant to connect, then come back here.",
      ...extra,
    };
  }

  let listing = pairing.listing;
  if (!listing) {
    try {
      listing = await refreshListingCache();
    } catch (error) {
      return {
        ok: true,
        paired: true,
        steps: RA_COACH_STEPS,
        stepIndex: pairing.stepIndex,
        listingTitle: "Listing",
        platform: null,
        message:
          error instanceof Error
            ? error.message
            : "Could not load listing details.",
        error: true,
        ...extra,
      };
    }
  }

  const stepIndex = Math.min(
    Math.max(pairing.stepIndex || 0, 0),
    RA_COACH_STEPS.length - 1
  );
  const step = RA_COACH_STEPS[stepIndex];

  return {
    ok: true,
    paired: true,
    steps: RA_COACH_STEPS,
    stepIndex,
    step,
    listingTitle: String(listing.title || listing.name || "Listing"),
    brand: raFieldValueFromListing(listing, "brand") || "—",
    platform: listing.platform || null,
    preview: raPreviewForStep(listing, step.key),
    photoCount: raListingPhotoMeta(listing).length,
    message: extra.message || null,
    error: Boolean(extra.error),
    ...extra,
  };
}

async function setStepIndex(nextIndex) {
  const clamped = Math.min(
    Math.max(nextIndex, 0),
    RA_COACH_STEPS.length - 1
  );
  await chrome.storage.local.set({ stepIndex: clamped });
  return clamped;
}

async function findMarketplaceTabs(preferredPlatform) {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => {
    if (!tab.id || !tab.url || !raIsMarketplaceUrl(tab.url)) return false;
    if (!preferredPlatform) return true;
    return raPlatformFromUrl(tab.url) === preferredPlatform;
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return;
  } catch {
    // inject
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["coach-shared.js", "content.js", "page-coach.js"],
  });
  await chrome.tabs.sendMessage(tabId, { type: "ping" });
}

async function sendToMarketplaceTab(message, preferredPlatform) {
  const tabs = await findMarketplaceTabs(preferredPlatform);
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error(
      "Open your Mercari or Poshmark sell page in Chrome first."
    );
  }
  await ensureContentScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, message);
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function encodeListingPhotos(listing) {
  const photoMeta = raListingPhotoMeta(listing);
  if (!photoMeta.length) {
    throw new Error(
      "No listing photos yet. Add shopper photos in the web app first."
    );
  }

  const encoded = [];
  for (let i = 0; i < photoMeta.length; i += 1) {
    const meta = photoMeta[i];
    const res = await fetch(meta.url);
    if (!res.ok) {
      throw new Error(`Could not download photo ${i + 1} (${res.status})`);
    }
    const blob = await res.blob();
    const contentType = blob.type || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const role = String(meta.role || "photo").replace(/[^a-z0-9_-]/gi, "");
    encoded.push({
      filename: `${String(i + 1).padStart(2, "0")}-${role}.${ext}`,
      contentType,
      base64: await blobToBase64(blob),
    });
  }
  return encoded;
}

async function fillFieldsOnPage(listing, fieldKeys, preferredPlatform) {
  let filled = 0;
  const missing = [];
  for (const key of fieldKeys) {
    const value = raFieldValueFromListing(listing, key);
    if (!value) continue;
    const result = await sendToMarketplaceTab(
      { type: "fillField", fieldKey: key, value },
      preferredPlatform
    );
    if (result?.ok && result.filled) filled += 1;
    else missing.push(key);
  }
  return { filled, missing };
}

async function advanceAfterSuccess(doneLabel) {
  const pairing = await getPairing();
  const current = pairing?.stepIndex || 0;
  if (current >= RA_COACH_STEPS.length - 1) {
    return buildCoachState({
      message: `${doneLabel} Look over the form, then press List / Publish yourself.`,
    });
  }
  const next = await setStepIndex(current + 1);
  const nextStep = RA_COACH_STEPS[next];
  return buildCoachState({
    message: `${doneLabel} Next: ${nextStep.label}.`,
    advanced: true,
  });
}

async function verifyFilledField(fieldKey, expected, preferredPlatform) {
  // Give the page a beat to commit React/controlled input state.
  await new Promise((resolve) => setTimeout(resolve, 200));
  const result = await sendToMarketplaceTab(
    { type: "verifyField", fieldKey, value: expected },
    preferredPlatform
  );
  return Boolean(result?.ok && result.verified);
}

async function runCurrentStep() {
  const pairing = await getPairing();
  if (!pairing) {
    return buildCoachState({
      error: true,
      message: "Connect a listing from the web app first.",
    });
  }

  let listing = pairing.listing;
  if (!listing) listing = await refreshListingCache();

  const stepIndex = pairing.stepIndex || 0;
  const step = RA_COACH_STEPS[stepIndex];
  const platform = listing.platform || null;

  try {
    if (step.key === "photos") {
      const photos = await encodeListingPhotos(listing);
      const result = await sendToMarketplaceTab(
        { type: "attachPhotos", photos },
        platform
      );
      if (!result?.ok) {
        throw new Error(result?.error || "Could not attach photos.");
      }
      if (result.truncated) {
        return buildCoachState({
          message: `Added ${result.attached} photo. This page only took one file — tap Add my photos again, or use the ZIP, then Next step.`,
        });
      }
      return advanceAfterSuccess(
        `Added ${result.attached} photo${result.attached === 1 ? "" : "s"}.`
      );
    }

    if (step.key === "title" || step.key === "description") {
      const value = raFieldValueFromListing(listing, step.key);
      if (!value) {
        throw new Error(`This listing has no ${step.key} yet.`);
      }
      const result = await sendToMarketplaceTab(
        { type: "fillField", fieldKey: step.key, value },
        platform
      );
      if (!result?.ok || !result.filled) {
        throw new Error(
          result?.error ||
            `Could not find the ${step.label.toLowerCase()} box on this page.`
        );
      }
      await sendToMarketplaceTab(
        { type: "highlightNext", fieldKey: step.key },
        platform
      ).catch(() => null);

      const verified = await verifyFilledField(step.key, value, platform);
      if (!verified) {
        return buildCoachState({
          error: true,
          message: `${step.label} didn’t stick on the page. Tap the field and try Do this for me again.`,
        });
      }
      return advanceAfterSuccess(`${step.label} filled.`);
    }

    if (step.key === "details") {
      const { filled, missing } = await fillFieldsOnPage(
        listing,
        RA_DETAIL_FIELDS,
        platform
      );
      if (!filled) {
        throw new Error(
          "Could not fill detail fields on this page. Some boxes may need a quick manual tap."
        );
      }

      // Spot-check a couple of text-friendly fields when we have values.
      const checkKeys = ["brand", "price", "originalPrice"].filter((key) =>
        raFieldValueFromListing(listing, key)
      );
      let verifiedCount = 0;
      for (const key of checkKeys) {
        const expected = raFieldValueFromListing(listing, key);
        if (await verifyFilledField(key, expected, platform)) {
          verifiedCount += 1;
        }
      }

      if (checkKeys.length && verifiedCount === 0) {
        return buildCoachState({
          error: true,
          message:
            "Detail fields may not have saved on the page. Check brand/price, then try again.",
        });
      }

      let done = `Filled ${filled} detail field${filled === 1 ? "" : "s"}.`;
      if (missing.length) {
        done += ` Still check: ${missing.slice(0, 4).join(", ")}.`;
      }
      return advanceAfterSuccess(done);
    }

    if (step.key === "review") {
      return buildCoachState({
        message:
          "Look over the form. When it looks right, press List / Publish on the website yourself.",
      });
    }

    return buildCoachState({ message: "Unknown step." });
  } catch (error) {
    return buildCoachState({
      error: true,
      message:
        error instanceof Error ? error.message : "Something went wrong.",
    });
  }
}

async function broadcastCoachState() {
  const state = await buildCoachState();
  const tabs = await findMarketplaceTabs(state.platform || null);
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await ensureContentScript(tab.id);
        await chrome.tabs.sendMessage(tab.id, {
          type: "coachStateUpdated",
          state,
        });
      } catch {
        // Tab may not accept messages yet.
      }
    })
  );
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message.type === "coachGetState") {
    void buildCoachState()
      .then((state) => sendResponse(state))
      .catch((error) =>
        sendResponse({
          ok: false,
          paired: false,
          error: true,
          message:
            error instanceof Error ? error.message : "Could not load coach.",
        })
      );
    return true;
  }

  if (message.type === "coachRefreshListing") {
    void refreshListingCache()
      .then(() => buildCoachState({ message: "Listing refreshed." }))
      .then(async (state) => {
        await broadcastCoachState();
        sendResponse(state);
      })
      .catch((error) =>
        sendResponse({
          ok: false,
          error: true,
          message:
            error instanceof Error ? error.message : "Refresh failed.",
        })
      );
    return true;
  }

  if (message.type === "coachDoStep") {
    void runCurrentStep()
      .then(async (state) => {
        await broadcastCoachState();
        sendResponse(state);
      })
      .catch((error) =>
        sendResponse({
          ok: false,
          error: true,
          message:
            error instanceof Error ? error.message : "Step failed.",
        })
      );
    return true;
  }

  if (message.type === "coachNext") {
    void (async () => {
      const pairing = await getPairing();
      const next = await setStepIndex((pairing?.stepIndex || 0) + 1);
      const state = await buildCoachState({
        message: `Step ${next + 1}: ${RA_COACH_STEPS[next].label}`,
      });
      await broadcastCoachState();
      sendResponse(state);
    })().catch((error) =>
      sendResponse({
        ok: false,
        error: true,
        message: error instanceof Error ? error.message : "Could not move on.",
      })
    );
    return true;
  }

  if (message.type === "coachPrev") {
    void (async () => {
      const pairing = await getPairing();
      const next = await setStepIndex((pairing?.stepIndex || 0) - 1);
      const state = await buildCoachState({
        message: `Back to step ${next + 1}: ${RA_COACH_STEPS[next].label}`,
      });
      await broadcastCoachState();
      sendResponse(state);
    })().catch((error) =>
      sendResponse({
        ok: false,
        error: true,
        message: error instanceof Error ? error.message : "Could not go back.",
      })
    );
    return true;
  }

  if (message.type === "coachFillAll") {
    void (async () => {
      const pairing = await getPairing();
      if (!pairing) throw new Error("Connect a listing first.");
      let listing = pairing.listing;
      if (!listing) listing = await refreshListingCache();
      const keys = ["title", "description", ...RA_DETAIL_FIELDS];
      const { filled } = await fillFieldsOnPage(
        listing,
        keys,
        listing.platform || null
      );
      const state = await buildCoachState({
        message: filled
          ? `Filled ${filled} fields. Add photos next if you haven’t.`
          : "No matching fields found on this page.",
        error: !filled,
      });
      await broadcastCoachState();
      sendResponse(state);
    })().catch((error) =>
      sendResponse({
        ok: false,
        error: true,
        message:
          error instanceof Error ? error.message : "Fill all failed.",
      })
    );
    return true;
  }

  if (message.type === "listingCacheUpdated") {
    void broadcastCoachState()
      .then((state) => sendResponse(state))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  // Keep sender available for future tab-scoped actions.
  void sender;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.token?.newValue == null && changes.listingId?.newValue == null) {
    void chrome.action.setBadgeText({ text: "" });
  }
  if (
    changes.listingCache ||
    changes.stepIndex ||
    changes.token ||
    changes.listingId
  ) {
    void broadcastCoachState();
  }
});
