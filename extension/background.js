/* global RA_COACH_STEPS, RA_DETAIL_FIELDS, raIsMarketplaceUrl, raPlatformFromUrl,
   raFieldValueFromListing, raListingPhotoMeta, raPreviewForStep,
   raIsAutocompleteField, raAutocompleteValues, raAutocompleteTip,
   raAutocompleteLabel, raListingCacheForId, raIsListingEditUrl */

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

  // Ack as soon as listingId is stored so the web app can open Poshmark
  // without waiting on cache fetch / side panel.
  void finalizePairing(payload.openSidePanel !== false);

  return { ok: true, appUrl, listingId };
}

async function finalizePairing(openSidePanel) {
  try {
    await refreshListingCache();
  } catch (error) {
    console.warn("Reseller Assistant: listing cache refresh failed", error);
  }

  await broadcastCoachState();

  if (!openSidePanel) return;
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

async function getPairing() {
  const stored = await chrome.storage.local.get([
    "appUrl",
    "token",
    "listingId",
    "stepIndex",
    "listingCache",
  ]);
  if (!stored.token || !stored.listingId) return null;
  const listingId = String(stored.listingId);
  return {
    appUrl: String(stored.appUrl || "").replace(/\/+$/, ""),
    token: String(stored.token),
    listingId,
    stepIndex: Number.isInteger(stored.stepIndex) ? stored.stepIndex : 0,
    listing: raListingCacheForId(stored.listingCache, listingId),
  };
}

async function refreshListingCache() {
  const pairing = await getPairing();
  if (!pairing) return null;
  const listingId = pairing.listingId;
  const token = pairing.token;

  const res = await fetch(
    `${pairing.appUrl}/api/listings/${listingId}/extension`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Could not load listing (${res.status})`);
  }
  const still = await getPairing();
  if (!still || still.listingId !== listingId || still.token !== token) {
    return null;
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
        "Open your listing in Reseller Assistant to connect, then come back here.",
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
  if (!listing) {
    return {
      ok: true,
      paired: true,
      steps: RA_COACH_STEPS,
      stepIndex: pairing.stepIndex,
      listingTitle: "Listing",
      platform: null,
      message: extra.message || "Loading this listing…",
      ...extra,
    };
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
    files: ["coach-shared.js", "closet-sync.js", "content.js", "page-coach.js"],
  });
  await chrome.tabs.sendMessage(tabId, { type: "ping" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId, timeoutMs = 16000) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    function onUpdated(id, info) {
      if (id === tabId && info.status === "complete") finish();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        finish();
        return;
      }
      if (tab?.status === "complete") finish();
    });
    setTimeout(finish, timeoutMs);
  });
}

async function extractClosetFromTab(tabId) {
  await ensureContentScript(tabId);
  const result = await chrome.tabs.sendMessage(tabId, { type: "extractCloset" });
  return result || { ok: false, listings: [], error: "No closet response" };
}

async function openClosetTab(url, options) {
  const active = !options || options.active !== false;
  const tabs = await chrome.tabs.query({});
  const target = url.replace(/\/+$/, "");
  const reusable = tabs.find((tab) => {
    if (!tab.id || !tab.url) return false;
    try {
      return new URL(tab.url).href.replace(/\/+$/, "") === target;
    } catch {
      return false;
    }
  });
  if (reusable?.id) {
    await chrome.tabs.update(reusable.id, { active, url });
    if (active && reusable.windowId != null) {
      await chrome.windows.update(reusable.windowId, { focused: true }).catch(
        () => undefined
      );
    }
    return reusable.id;
  }
  const created = await chrome.tabs.create({ url, active });
  if (!created?.id) throw new Error("Could not open the closet page");
  return created.id;
}

function fallbackClosetUrl(platform, username) {
  if (platform === "mercari") {
    return "https://www.mercari.com/mypage/listings/active/";
  }
  if (platform === "poshmark" && username) {
    return `https://poshmark.com/closet/${encodeURIComponent(username)}`;
  }
  return null;
}

async function checkCloset(message) {
  const closetUrl = String(message.closetUrl || "").trim();
  const platform = message.platform === "poshmark" ? "poshmark" : "mercari";
  const username = String(message.username || "").trim();
  if (!closetUrl) {
    throw new Error("Missing closet URL");
  }

  const tabId = await openClosetTab(closetUrl);
  await waitForTabComplete(tabId);
  await sleep(1200);
  let result = await extractClosetFromTab(tabId);

  if (result?.loginRequired) return result;
  if (result?.ok && Array.isArray(result.listings) && result.listings.length) {
    return result;
  }

  const fallback = fallbackClosetUrl(platform, username);
  if (fallback && fallback !== closetUrl) {
    await chrome.tabs.update(tabId, { url: fallback });
    await waitForTabComplete(tabId);
    await sleep(1200);
    result = await extractClosetFromTab(tabId);
  }

  return result || { ok: false, listings: [], error: "Could not read closet" };
}

function isAccountTab(url, platform) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (platform === "poshmark") {
      return path === "/closet" || path.startsWith("/closet/");
    }
    return path.includes("/mypage") || /\/u\//.test(path);
  } catch {
    return false;
  }
}

function accountDetectUrl(platform) {
  if (platform === "poshmark") return "https://poshmark.com/closet";
  return "https://www.mercari.com/mypage/";
}

async function extractUsernameFromTab(tabId) {
  await ensureContentScript(tabId);
  const result = await chrome.tabs.sendMessage(tabId, {
    type: "extractUsername",
  });
  return result || { ok: false, error: "No username response" };
}

async function detectClosetUsername(message) {
  const platform = message.platform === "poshmark" ? "poshmark" : "mercari";
  const existing = (await findMarketplaceTabs(platform)).filter(
    (tab) => tab.id && isAccountTab(tab.url, platform)
  );
  let tabId = existing[0]?.id ?? null;
  let openedDetectPage = false;

  if (!tabId) {
    tabId = await openClosetTab(accountDetectUrl(platform), { active: false });
    openedDetectPage = true;
    await waitForTabComplete(tabId);
    await sleep(1200);
  } else {
    await ensureContentScript(tabId);
  }

  let result = await extractUsernameFromTab(tabId);
  if (result?.ok && result.username) return result;

  if (!openedDetectPage) {
    tabId = await openClosetTab(accountDetectUrl(platform), { active: false });
    await waitForTabComplete(tabId);
    await sleep(1200);
    result = await extractUsernameFromTab(tabId);
  }

  if (result?.loginRequired && tabId) {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.windowId != null) {
      await chrome.windows
        .update(tab.windowId, { focused: true })
        .catch(() => undefined);
    }
  }

  return (
    result || { ok: false, error: "Could not find your closet name." }
  );
}

async function sendToMarketplaceTab(message, preferredPlatform, preferredTabId) {
  const tabs = await findMarketplaceTabs(preferredPlatform);
  const preferred =
    preferredTabId && tabs.find((tab) => tab.id === preferredTabId);
  const tab =
    preferred ||
    [...tabs].sort(
      (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
    )[0];
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
      "No listing photos yet. Add them on the listing hub first."
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

async function fillFieldsOnPage(listing, fieldKeys, preferredPlatform, preferredTabId) {
  let filled = 0;
  const missing = [];
  const assisted = [];
  const platform =
    preferredPlatform || listing.platform || null;

  for (const key of fieldKeys) {
    const value = raFieldValueFromListing(listing, key);
    if (!value) continue;

    if (raIsAutocompleteField(platform, key)) {
      const values = raAutocompleteValues(listing, key);
      if (!values.length) continue;
      const result = await sendToMarketplaceTab(
        {
          type: "showAutocompleteHelper",
          fieldKey: key,
          values,
          label: raAutocompleteLabel(key),
          tip: raAutocompleteTip(key),
        },
        preferredPlatform,
        preferredTabId
      );
      if (result?.ok && result.shown) assisted.push(key);
      else missing.push(key);
      continue;
    }

    const result = await sendToMarketplaceTab(
      { type: "fillField", fieldKey: key, value },
      preferredPlatform,
      preferredTabId
    );
    if (result?.ok && result.filled) filled += 1;
    else missing.push(key);
  }
  return { filled, missing, assisted };
}

async function advanceAfterSuccess(doneLabel) {
  const pairing = await getPairing();
  const current = pairing?.stepIndex || 0;
  if (current >= RA_COACH_STEPS.length - 1) {
    return buildCoachState({
      message: `${doneLabel} Look over the form, then press List / Publish.`,
    });
  }
  const next = await setStepIndex(current + 1);
  const nextStep = RA_COACH_STEPS[next];
  return buildCoachState({
    message: `${doneLabel} Next: ${nextStep.label}.`,
    advanced: true,
  });
}

async function verifyFilledField(fieldKey, expected, preferredPlatform, preferredTabId) {
  // Give the page a beat to commit React/controlled input state.
  await new Promise((resolve) => setTimeout(resolve, 200));
  const result = await sendToMarketplaceTab(
    { type: "verifyField", fieldKey, value: expected },
    preferredPlatform,
    preferredTabId
  );
  return Boolean(result?.ok && result.verified);
}

async function runCurrentStep(preferredTabId = null) {
  const pairing = await getPairing();
  if (!pairing) {
    return buildCoachState({
      error: true,
      message: "Connect a listing from Reseller Assistant first.",
    });
  }

  let listing = pairing.listing;
  if (!listing) listing = await refreshListingCache();
  if (!listing) {
    return buildCoachState({
      error: true,
      message: "Could not load this listing yet. Try again in a moment.",
    });
  }

  const stepIndex = pairing.stepIndex || 0;
  const step = RA_COACH_STEPS[stepIndex];
  const platform = listing.platform || null;

  try {
    if (step.key === "photos") {
      const photos = await encodeListingPhotos(listing);
      const result = await sendToMarketplaceTab(
        { type: "attachPhotos", photos },
        platform,
        preferredTabId
      );
      if (!result?.ok) {
        throw new Error(result?.error || "Could not attach photos.");
      }
      if (result.truncated) {
        return buildCoachState({
          message: `Added ${result.attached} photo. This page only took one file — tap Add my photos again.`,
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
        platform,
        preferredTabId
      );
      if (!result?.ok || !result.filled) {
        throw new Error(
          result?.error ||
            `Could not find the ${step.label.toLowerCase()} box on this page.`
        );
      }
      await sendToMarketplaceTab(
        { type: "highlightNext", fieldKey: step.key },
        platform,
        preferredTabId
      ).catch(() => null);

      const verified = await verifyFilledField(
        step.key,
        value,
        platform,
        preferredTabId
      );
      if (!verified) {
        return buildCoachState({
          error: true,
          message: `${step.label} didn’t stick on the page. Tap the field and try Fill this field again.`,
        });
      }
      return advanceAfterSuccess(`${step.label} filled.`);
    }

    if (step.key === "details") {
      const { filled, missing, assisted } = await fillFieldsOnPage(
        listing,
        RA_DETAIL_FIELDS,
        platform,
        preferredTabId
      );
      if (!filled && !(assisted && assisted.length)) {
        throw new Error(
          "Could not fill detail fields on this page. Some boxes may need a quick manual tap."
        );
      }

      // Spot-check text-friendly fields we actually auto-filled (skip autocomplete ones).
      const checkKeys = ["price", "originalPrice", "size"]
        .filter((key) => !raIsAutocompleteField(platform, key))
        .filter((key) => raFieldValueFromListing(listing, key));
      let verifiedCount = 0;
      for (const key of checkKeys) {
        const expected = raFieldValueFromListing(listing, key);
        if (await verifyFilledField(key, expected, platform, preferredTabId)) {
          verifiedCount += 1;
        }
      }

      if (checkKeys.length && verifiedCount === 0 && filled > 0) {
        return buildCoachState({
          error: true,
          message:
            "Detail fields may not have saved on the page. Check price/size, then try again.",
        });
      }

      let done = filled
        ? `Filled ${filled} detail field${filled === 1 ? "" : "s"}.`
        : "Opened helpers for fields that need autocomplete.";
      if (assisted?.length) {
        done += ` Use the green tips for ${assisted
          .map((key) => raAutocompleteLabel(key).toLowerCase())
          .join(" & ")} — type, then pick from suggestions.`;
      }
      if (missing.length) {
        done += ` Still check: ${missing.slice(0, 4).join(", ")}.`;
      }
      return advanceAfterSuccess(done);
    }

    if (step.key === "review") {
      return buildCoachState({
        message:
          "Look over the form, then press List / Publish.",
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

async function broadcastCoachState(prebuilt) {
  const state = prebuilt || (await buildCoachState());
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

async function openTweakListingWindow() {
  const pairing = await getPairing();
  if (!pairing?.appUrl || !pairing.listingId) {
    throw new Error("Connect a listing first.");
  }

  const url = `${pairing.appUrl}/app/listings/${pairing.listingId}?tweak=1&popup=1`;
  const current = await chrome.windows.getCurrent().catch(() => null);
  const width = Math.min(980, Math.max(720, (current?.width || 1200) - 80));
  const height = Math.min(920, Math.max(680, (current?.height || 900) - 40));
  const left = Math.round(
    (current?.left || 0) + ((current?.width || width) - width) / 2
  );
  const top = Math.round(
    (current?.top || 0) + ((current?.height || height) - height) / 2
  );

  const created = await chrome.windows.create({
    url,
    type: "popup",
    width,
    height,
    left,
    top,
    focused: true,
  });

  if (created?.id != null) {
    const windowId = created.id;
    const onRemoved = (removedId) => {
      if (removedId !== windowId) return;
      chrome.windows.onRemoved.removeListener(onRemoved);
      void refreshListingCache()
        .then(() =>
          buildCoachState({
            message: "Listing refreshed after you closed the editor.",
          })
        )
        .then((state) => broadcastCoachState(state))
        .catch(() => undefined);
    };
    chrome.windows.onRemoved.addListener(onRemoved);
  }

  return buildCoachState({
    message:
      "Opened the listing editor. Save, then close the window — it will refresh.",
  });
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

  if (message.type === "checkCloset") {
    void checkCloset(message)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          listings: [],
          error:
            error instanceof Error ? error.message : "Could not check closet",
        })
      );
    return true;
  }

  if (message.type === "detectClosetUsername") {
    void detectClosetUsername(message)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not find closet name",
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
    void runCurrentStep(sender.tab?.id ?? null)
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

  if (message.type === "openTweakListing") {
    void openTweakListingWindow()
      .then(async (state) => {
        await broadcastCoachState();
        sendResponse(state);
      })
      .catch((error) =>
        sendResponse({
          ok: false,
          error: true,
          message:
            error instanceof Error
              ? error.message
              : "Could not open listing editor.",
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
      if (!listing) throw new Error("Could not load this listing yet.");
      const keys = ["title", "description", ...RA_DETAIL_FIELDS];
      const { filled } = await fillFieldsOnPage(
        listing,
        keys,
        listing.platform || null,
        sender.tab?.id ?? null
      );
      const state = await buildCoachState({
        message: filled
          ? `Filled ${filled} fields.`
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
            error instanceof Error ? error.message : "Couldn’t fill fields.",
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
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !raIsListingEditUrl(tab.url)) return;
  void (async () => {
    try {
      await ensureContentScript(tabId);
      const state = await buildCoachState();
      await chrome.tabs.sendMessage(tabId, {
        type: "coachStateUpdated",
        state,
      });
    } catch {
      // Content script may not be ready yet; page-coach will refresh on load.
    }
  })();
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
