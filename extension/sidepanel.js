/* global RA_COACH_STEPS, RA_MARKETPLACE_TAB_URLS, raListingCacheForId,
   raFillExtensionBuildLabel, raIsUnpackedExtension */

const DEFAULT_APP_URL = "https://reseller.mvfeed.us";
const APP_URL_CANDIDATES = [
  "https://reseller.mvfeed.us",
  // Stable production alias; the app 308s this host to the canonical URL.
  "https://reseller-assistant.vercel.app",
  "http://localhost:3000",
];

const els = {
  connectionStatus: document.getElementById("connection-status"),
  pairSection: document.getElementById("pair-section"),
  listingSection: document.getElementById("listing-section"),
  appUrl: document.getElementById("app-url"),
  joinCode: document.getElementById("join-code"),
  token: document.getElementById("token"),
  listingId: document.getElementById("listing-id"),
  pairBtn: document.getElementById("pair-btn"),
  pairStatus: document.getElementById("pair-status"),
  unpairBtn: document.getElementById("unpair-btn"),
  listingTitle: document.getElementById("listing-title"),
  listingBrand: document.getElementById("listing-brand"),
  coachStepLabel: document.getElementById("coach-step-label"),
  coachHelp: document.getElementById("coach-help"),
  coachPreview: document.getElementById("coach-preview"),
  doStepBtn: document.getElementById("do-step-btn"),
  tweakListingBtn: document.getElementById("tweak-listing-btn"),
  nextStepBtn: document.getElementById("next-step-btn"),
  prevStepBtn: document.getElementById("prev-step-btn"),
  fillAllBtn: document.getElementById("fill-all-btn"),
  syncSchemaBtn: document.getElementById("sync-schema-btn"),
  copyPhotosBtn: document.getElementById("copy-photos-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  actionStatus: document.getElementById("action-status"),
  reloadExtensionBtn: document.getElementById("reload-extension-btn"),
};

/** @type {{ appUrl: string, token: string, listingId: string } | null} */
let pairing = null;
/** @type {Record<string, unknown> | null} */
let listing = null;
let coachState = null;
let autoPairTimer = null;
let busy = false;

function setStatus(el, message, kind = "") {
  if (!el) return;
  el.textContent = message || "";
  el.className = "status" + (kind ? ` ${kind}` : "");
}

function setConnection(message, kind = "") {
  if (!els.connectionStatus) return;
  els.connectionStatus.textContent = message || "";
  els.connectionStatus.className = "connection" + (kind ? ` ${kind}` : "");
}

function normalizeAppUrl(url) {
  const trimmed = (url || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_APP_URL;
}

function uniqueAppUrls(preferred) {
  const list = [
    normalizeAppUrl(preferred),
    ...APP_URL_CANDIDATES.map(normalizeAppUrl),
  ];
  return [...new Set(list.filter(Boolean))];
}

function parsePairingInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const codeOnly = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(codeOnly) && !text.includes("/")) {
    return { kind: "code", code: codeOnly };
  }

  try {
    const url = new URL(text);
    const joinMatch = url.pathname.match(/\/join\/([^/?#]+)/i);
    if (joinMatch) {
      return {
        kind: "token",
        token: decodeURIComponent(joinMatch[1]),
        appUrl: `${url.protocol}//${url.host}`,
      };
    }
    const codeParam =
      url.searchParams.get("joinCode") || url.searchParams.get("code");
    if (codeParam && /^[A-Za-z0-9]{6}$/.test(codeParam)) {
      return {
        kind: "code",
        code: codeParam.toUpperCase(),
        appUrl: `${url.protocol}//${url.host}`,
      };
    }
  } catch {
    // not a URL
  }

  if (text.length > 20 && !/\s/.test(text)) {
    return { kind: "token", token: text };
  }

  if (/^[A-Z0-9]{6}$/i.test(codeOnly)) {
    return { kind: "code", code: codeOnly };
  }

  return null;
}

function showPairingUi() {
  els.pairSection.hidden = false;
  els.listingSection.hidden = true;
  els.appUrl.value = pairing?.appUrl || DEFAULT_APP_URL;
  setConnection(
    "Not connected — open the listing, or enter a code."
  );
}

function applyCoachState(state) {
  coachState = state;
  if (!state?.paired) {
    showPairingUi();
    return;
  }

  els.pairSection.hidden = true;
  els.listingSection.hidden = false;
  els.listingTitle.textContent = state.listingTitle || "Listing";
  els.listingBrand.textContent = state.brand || "—";

  const step = state.step || RA_COACH_STEPS[state.stepIndex || 0];
  const total = (state.steps || RA_COACH_STEPS).length;
  const index = state.stepIndex || 0;
  els.coachStepLabel.textContent = `Step ${index + 1} of ${total}: ${
    step?.label || "—"
  }`;
  els.coachHelp.textContent = step?.help || "";
  els.coachPreview.textContent = state.preview || "";
  els.coachPreview.hidden = !state.preview;
  els.doStepBtn.textContent = step?.actionLabel || "Fill this field";
  els.doStepBtn.disabled = busy || step?.key === "review";
  els.prevStepBtn.disabled = busy || index <= 0;
  els.nextStepBtn.disabled = busy || index >= total - 1;

  if (state.message) {
    setStatus(
      els.actionStatus,
      state.message,
      state.error ? "error" : "ok"
    );
  }

  setConnection(
    `Connected · helper sits beside the sell form`,
    "ok"
  );
}

async function loadStoredPairing() {
  const stored = await chrome.storage.local.get([
    "appUrl",
    "token",
    "listingId",
    "listingCache",
  ]);

  if (stored.token && stored.listingId) {
    pairing = {
      appUrl: normalizeAppUrl(stored.appUrl),
      token: String(stored.token),
      listingId: String(stored.listingId),
    };
    listing = raListingCacheForId(stored.listingCache, stored.listingId);
    return true;
  }

  pairing = null;
  listing = null;
  return false;
}

async function savePairing(next) {
  pairing = next;
  listing = null;
  await chrome.storage.local.set({
    appUrl: next.appUrl,
    token: next.token,
    listingId: next.listingId,
    stepIndex: 0,
    pairedAt: Date.now(),
    listingCache: null,
  });
}

async function clearPairing() {
  pairing = null;
  listing = null;
  coachState = null;
  await chrome.storage.local.remove([
    "appUrl",
    "token",
    "listingId",
    "joinCode",
    "stepIndex",
    "pairedAt",
    "listingCache",
  ]);
  showPairingUi();
  setStatus(els.pairStatus, "Disconnected.");
}

async function resolvePairingFromCode(code, preferredAppUrl) {
  let lastError = "Could not find that code.";
  for (const appUrl of uniqueAppUrls(preferredAppUrl)) {
    try {
      const res = await fetch(
        `${appUrl}/api/extension/pair?joinCode=${encodeURIComponent(code)}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = json.error || `Code lookup failed (${res.status})`;
        continue;
      }
      if (!json.token || !json.listingId) {
        lastError = "Server did not return a listing token.";
        continue;
      }
      return {
        appUrl,
        token: String(json.token),
        listingId: String(json.listingId),
      };
    } catch {
      lastError = `Could not reach ${appUrl}`;
    }
  }
  throw new Error(lastError);
}

async function resolvePairingFromToken(token, listingId, preferredAppUrl) {
  if (listingId) {
    return {
      appUrl: normalizeAppUrl(preferredAppUrl),
      token,
      listingId,
    };
  }

  let lastError = "Token needs a listing ID, or use a join link.";
  for (const appUrl of uniqueAppUrls(preferredAppUrl)) {
    try {
      const res = await fetch(
        `${appUrl}/api/extension/pair?token=${encodeURIComponent(token)}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = json.error || `Token lookup failed (${res.status})`;
        continue;
      }
      if (!json.token || !json.listingId) {
        lastError = "Server did not return listing details.";
        continue;
      }
      return {
        appUrl,
        token: String(json.token),
        listingId: String(json.listingId),
      };
    } catch {
      lastError = `Could not reach ${appUrl}`;
    }
  }
  throw new Error(lastError);
}

async function refreshCoach(messageType = "coachGetState") {
  const state = await chrome.runtime.sendMessage({ type: messageType });
  if (state?.listingTitle || state?.paired) {
    listing = (await chrome.storage.local.get(["listingCache"])).listingCache || listing;
  }
  applyCoachState(state);
  return state;
}

async function runCoach(type) {
  if (busy) return;
  busy = true;
  els.doStepBtn.disabled = true;
  setStatus(els.actionStatus, "Working…");
  try {
    await refreshCoach(type);
  } catch (error) {
    setStatus(
      els.actionStatus,
      error instanceof Error ? error.message : "Something went wrong",
      "error"
    );
  } finally {
    busy = false;
    applyCoachState(coachState);
  }
}

async function handlePair() {
  setStatus(els.pairStatus, "Connecting…");
  try {
    const preferred = els.appUrl.value;
    const parsed = parsePairingInput(els.joinCode.value);
    let next;

    if (parsed?.kind === "code") {
      next = await resolvePairingFromCode(parsed.code, parsed.appUrl || preferred);
    } else if (parsed?.kind === "token") {
      next = await resolvePairingFromToken(
        parsed.token,
        els.listingId.value.trim() || parsed.listingId,
        parsed.appUrl || preferred
      );
    } else if (els.token.value.trim()) {
      next = await resolvePairingFromToken(
        els.token.value.trim(),
        els.listingId.value.trim(),
        preferred
      );
    } else {
      throw new Error("Enter a 6-digit code, join link, or token.");
    }

    await savePairing(next);
    await chrome.runtime.sendMessage({
      type: "applyPairing",
      appUrl: next.appUrl,
      token: next.token,
      listingId: next.listingId,
      openSidePanel: false,
    });
    setStatus(els.pairStatus, "Connected.", "ok");
    await refreshCoach("coachRefreshListing");
  } catch (error) {
    setStatus(
      els.pairStatus,
      error instanceof Error ? error.message : "Could not connect",
      "error"
    );
  }
}

function scheduleAutoPairFromJoinField() {
  if (autoPairTimer) window.clearTimeout(autoPairTimer);
  autoPairTimer = window.setTimeout(() => {
    const parsed = parsePairingInput(els.joinCode.value);
    if (!parsed) return;
    void handlePair();
  }, 350);
}

async function handleSyncSchema() {
  try {
    setStatus(els.actionStatus, "Reading sell form…");
    const tabs = await chrome.tabs.query({ url: RA_MARKETPLACE_TAB_URLS });
    const market = tabs.find((tab) =>
      /mercari|poshmark/i.test(tab.url || "")
    );
    if (!market?.id) throw new Error("Open a Mercari or Poshmark sell page first.");
    const discovery = await chrome.tabs.sendMessage(market.id, {
      type: "discoverForm",
    });
    if (!discovery?.ok || !discovery.fields?.length) {
      throw new Error("No form fields found on this page.");
    }
    if (!pairing) throw new Error("Connect a listing first.");
    const platform =
      discovery.platform ||
      listing?.platform ||
      (/poshmark/i.test(market.url || "") ? "poshmark" : "mercari");
    const res = await fetch(`${pairing.appUrl}/api/platforms/schema/discover`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${pairing.token}`,
      },
      body: JSON.stringify({
        platform,
        sellPageUrl: discovery.url,
        fields: discovery.fields,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Sync failed");
    setStatus(
      els.actionStatus,
      json.message || `Synced ${discovery.fields.length} fields.`,
      "ok"
    );
  } catch (error) {
    setStatus(
      els.actionStatus,
      error instanceof Error ? error.message : "Sync failed",
      "error"
    );
  }
}

async function handleCopyPhotos() {
  setStatus(
    els.actionStatus,
    "Use Add my photos on the sell page. Photos stay in Reseller Assistant."
  );
}

els.pairBtn.addEventListener("click", () => void handlePair());
els.unpairBtn.addEventListener("click", () => void clearPairing());
els.doStepBtn.addEventListener("click", () => void runCoach("coachDoStep"));
els.tweakListingBtn.addEventListener("click", () =>
  void runCoach("openTweakListing")
);
els.nextStepBtn.addEventListener("click", () => void runCoach("coachNext"));
els.prevStepBtn.addEventListener("click", () => void runCoach("coachPrev"));
els.fillAllBtn.addEventListener("click", () => void runCoach("coachFillAll"));
els.refreshBtn.addEventListener("click", () =>
  void runCoach("coachRefreshListing")
);
els.syncSchemaBtn.addEventListener("click", () => void handleSyncSchema());
els.copyPhotosBtn.addEventListener("click", () => void handleCopyPhotos());
if (els.reloadExtensionBtn && raIsUnpackedExtension()) {
  els.reloadExtensionBtn.hidden = false;
  els.reloadExtensionBtn.addEventListener("click", () =>
    chrome.runtime.reload()
  );
}

els.joinCode.addEventListener("input", () => {
  const value = els.joinCode.value.trim();
  if (value.includes("://") || value.length > 8) {
    scheduleAutoPairFromJoinField();
    return;
  }
  els.joinCode.value = value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
  if (els.joinCode.value.length === 6) scheduleAutoPairFromJoinField();
});

els.joinCode.addEventListener("paste", () => {
  window.setTimeout(scheduleAutoPairFromJoinField, 0);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    changes.listingCache ||
    changes.stepIndex ||
    changes.token ||
    changes.listingId
  ) {
    void refreshCoach();
  }
});

async function boot() {
  const hasPairing = await loadStoredPairing();
  if (!hasPairing) {
    showPairingUi();
    return;
  }
  try {
    await refreshCoach("coachRefreshListing");
  } catch {
    await refreshCoach();
  }
}

void boot();
raFillExtensionBuildLabel(document.getElementById("build-label"));
