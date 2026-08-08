const STEPS = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "brand", label: "Brand" },
  { key: "size", label: "Size" },
  { key: "color", label: "Color" },
  { key: "condition", label: "Condition" },
  { key: "price", label: "Price" },
  { key: "photos", label: "Photos" },
  { key: "review", label: "Review Publish" },
];

const DEFAULT_APP_URL = "https://reseller-assistant.vercel.app";
const APP_URL_CANDIDATES = [
  "https://reseller-assistant.vercel.app",
  "https://reseller.mvfeed.us",
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
  listingDescription: document.getElementById("listing-description"),
  stepsList: document.getElementById("steps-list"),
  fillTitleBtn: document.getElementById("fill-title-btn"),
  fillDescriptionBtn: document.getElementById("fill-description-btn"),
  fillAllBtn: document.getElementById("fill-all-btn"),
  syncSchemaBtn: document.getElementById("sync-schema-btn"),
  copyPhotosBtn: document.getElementById("copy-photos-btn"),
  nextStepBtn: document.getElementById("next-step-btn"),
  actionStatus: document.getElementById("action-status"),
  reloadExtensionBtn: document.getElementById("reload-extension-btn"),
};

/** @type {{ appUrl: string, token: string, listingId: string } | null} */
let pairing = null;
/** @type {Record<string, unknown> | null} */
let listing = null;
let stepIndex = 0;
let autoPairTimer = null;
let refreshing = false;

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
  const list = [normalizeAppUrl(preferred), ...APP_URL_CANDIDATES.map(normalizeAppUrl)];
  return [...new Set(list.filter(Boolean))];
}

/**
 * Parse a join URL, raw token, or 6-digit code from pasted text.
 * @returns {{ kind: "code", code: string } | { kind: "token", token: string, listingId?: string, appUrl?: string } | null}
 */
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

function renderSteps() {
  els.stepsList.innerHTML = "";
  STEPS.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.label;
    if (index < stepIndex) li.classList.add("done");
    if (index === stepIndex) li.classList.add("current");
    els.stepsList.appendChild(li);
  });
}

function showPairingUi() {
  els.pairSection.hidden = false;
  els.listingSection.hidden = true;
  els.appUrl.value = pairing?.appUrl || DEFAULT_APP_URL;
  setConnection("Not paired — open Post checklist in the web app, or enter a code.");
}

function showListingUi() {
  els.pairSection.hidden = true;
  els.listingSection.hidden = false;

  const title = String(listing?.title || listing?.name || "Listing");
  const brand = String(
    listing?.brand ||
      listing?.structuredFields?.brand ||
      listing?.structured_fields?.brand ||
      "—"
  );
  const description = String(listing?.description || "—");

  els.listingTitle.textContent = title;
  els.listingBrand.textContent = brand;
  els.listingDescription.textContent = description;
  renderSteps();
  setConnection(`Connected · ${pairing?.appUrl || ""}`, "ok");
}

async function loadStoredPairing() {
  const stored = await chrome.storage.local.get([
    "appUrl",
    "token",
    "listingId",
    "stepIndex",
  ]);

  if (stored.token && stored.listingId) {
    pairing = {
      appUrl: normalizeAppUrl(stored.appUrl),
      token: String(stored.token),
      listingId: String(stored.listingId),
    };
    stepIndex = Number.isInteger(stored.stepIndex) ? stored.stepIndex : 0;
    return true;
  }

  pairing = null;
  return false;
}

async function savePairing(next) {
  pairing = next;
  await chrome.storage.local.set({
    appUrl: next.appUrl,
    token: next.token,
    listingId: next.listingId,
    stepIndex,
    pairedAt: Date.now(),
  });
}

async function clearPairing() {
  pairing = null;
  listing = null;
  stepIndex = 0;
  await chrome.storage.local.remove([
    "appUrl",
    "token",
    "listingId",
    "stepIndex",
    "joinCode",
    "pairedAt",
  ]);
  showPairingUi();
  setStatus(els.pairStatus, "Unpaired. Open the web app Post page or enter a code.");
  setStatus(els.actionStatus, "");
}

/**
 * Exchange a 6-digit join code for token + listingId.
 * Tries preferred app URL, then known fallbacks.
 */
async function pairWithJoinCode(preferredAppUrl, joinCode) {
  let lastError = null;
  for (const appUrl of uniqueAppUrls(preferredAppUrl)) {
    try {
      const url = `${appUrl}/api/extension/pair?joinCode=${encodeURIComponent(joinCode)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        lastError = new Error(
          data.error || `Pairing failed at ${appUrl} (${res.status})`
        );
        continue;
      }
      const data = await res.json();
      if (!data.token || !data.listingId) {
        lastError = new Error("Server did not return token and listingId");
        continue;
      }
      return {
        appUrl,
        token: String(data.token),
        listingId: String(data.listingId),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Pairing failed");
    }
  }
  throw lastError || new Error("Pairing failed");
}

async function pairWithJoinToken(preferredAppUrl, token) {
  let lastError = null;
  for (const appUrl of uniqueAppUrls(preferredAppUrl)) {
    try {
      const url = `${appUrl}/api/extension/pair?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        lastError = new Error(
          data.error || `Pairing failed at ${appUrl} (${res.status})`
        );
        continue;
      }
      const data = await res.json();
      if (!data.token || !data.listingId) {
        lastError = new Error("Server did not return token and listingId");
        continue;
      }
      return {
        appUrl,
        token: String(data.token),
        listingId: String(data.listingId),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Pairing failed");
    }
  }
  throw lastError || new Error("Pairing failed");
}

async function resolveTokenListingId(appUrl, token) {
  // Prefer pairing endpoint when the "token" is actually a join code.
  if (/^[A-Z0-9]{6}$/i.test(token)) {
    return pairWithJoinCode(appUrl, token.toUpperCase());
  }

  const listingId = els.listingId.value.trim();
  if (listingId) {
    return { appUrl: normalizeAppUrl(appUrl), token, listingId };
  }

  return pairWithJoinToken(appUrl, token);
}

async function fetchListing(current) {
  const url = `${current.appUrl}/api/listings/${encodeURIComponent(current.listingId)}/extension`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${current.token}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Could not load listing (${res.status})`);
  }
  return res.json();
}

async function refreshListing() {
  if (!pairing || refreshing) return;
  refreshing = true;
  try {
    listing = await fetchListing(pairing);
    showListingUi();
  } finally {
    refreshing = false;
  }
}

async function connectWithPairing(next, statusEl = els.pairStatus) {
  listing = await fetchListing(next);
  stepIndex = 0;
  await savePairing(next);
  setStatus(statusEl, "Paired!", "ok");
  showListingUi();
}

async function handlePair() {
  setStatus(els.pairStatus, "Pairing…");
  els.pairBtn.disabled = true;

  try {
    const appUrl = normalizeAppUrl(els.appUrl.value);
    const parsed = parsePairingInput(els.joinCode.value) ||
      parsePairingInput(els.token.value);

    let next;
    if (parsed?.kind === "code") {
      if (parsed.appUrl) els.appUrl.value = parsed.appUrl;
      next = await pairWithJoinCode(parsed.appUrl || appUrl, parsed.code);
    } else if (parsed?.kind === "token") {
      const preferred = parsed.appUrl || appUrl;
      if (parsed.appUrl) els.appUrl.value = parsed.appUrl;
      if (parsed.listingId) els.listingId.value = parsed.listingId;
      els.token.value = parsed.token;
      next = await resolveTokenListingId(preferred, parsed.token);
    } else if (els.token.value.trim()) {
      next = await resolveTokenListingId(appUrl, els.token.value.trim());
    } else {
      throw new Error("Enter a 6-digit join code, join link, or paste a token");
    }

    await connectWithPairing(next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pairing failed";
    setStatus(els.pairStatus, message, "error");
    setConnection("Pairing failed", "error");
  } finally {
    els.pairBtn.disabled = false;
  }
}

function scheduleAutoPairFromJoinField() {
  if (autoPairTimer) window.clearTimeout(autoPairTimer);
  autoPairTimer = window.setTimeout(() => {
    const parsed = parsePairingInput(els.joinCode.value);
    if (!parsed) return;
    if (parsed.kind === "code" || parsed.kind === "token") {
      void handlePair();
    }
  }, 450);
}

function fieldValue(fieldKey) {
  if (!listing) return "";
  const structured = listing.structuredFields || listing.structured_fields || {};
  const map = {
    title: listing.title ?? listing.name,
    description: listing.description,
    brand: listing.brand ?? structured.brand,
    category: structured.category,
    subcategory: structured.subcategory,
    size: listing.size ?? structured.size,
    color: listing.color ?? structured.color,
    colorSecondary: structured.colorSecondary,
    condition: listing.condition ?? structured.condition,
    price: listing.price ?? listing.listPrice,
    originalPrice: structured.originalPrice,
    styleTags: Array.isArray(structured.styleTags)
      ? structured.styleTags.join(", ")
      : structured.styleTags,
    packageWeight: structured.packageWeight,
    shippingPayer: structured.shippingPayer,
    fabric: structured.fabric,
    measurements: structured.measurements,
    smokePetNotes: structured.smokePetNotes,
  };
  const value = map[fieldKey];
  return value == null ? "" : String(value);
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab. Open a Mercari or Poshmark sell page first.");
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error(
      "Content script not found. Open a Mercari or Poshmark create/sell/list page, then try again."
    );
  }
}

async function fillField(fieldKey) {
  const value = fieldValue(fieldKey);
  if (!value) {
    setStatus(els.actionStatus, `No ${fieldKey} on this listing.`, "error");
    return false;
  }
  const result = await sendToActiveTab({ type: "fillField", fieldKey, value });
  if (result?.ok && result.filled) {
    setStatus(els.actionStatus, `Filled ${fieldKey}.`, "ok");
    return true;
  }
  setStatus(
    els.actionStatus,
    result?.error || `Could not find a ${fieldKey} field on this page.`,
    "error"
  );
  return false;
}

async function highlightCurrentStep() {
  const step = STEPS[stepIndex];
  if (!step || step.key === "review" || step.key === "photos") return;
  try {
    await sendToActiveTab({ type: "highlightNext", fieldKey: step.key });
  } catch {
    // Highlight is best-effort when the sell page is open.
  }
}

async function handleFillTitle() {
  try {
    await fillField("title");
  } catch (error) {
    setStatus(els.actionStatus, error instanceof Error ? error.message : "Fill failed", "error");
  }
}

async function handleFillDescription() {
  try {
    await fillField("description");
  } catch (error) {
    setStatus(els.actionStatus, error instanceof Error ? error.message : "Fill failed", "error");
  }
}

async function handleFillAll() {
  const keys = [
    "title",
    "description",
    "brand",
    "category",
    "subcategory",
    "size",
    "color",
    "colorSecondary",
    "condition",
    "originalPrice",
    "price",
    "styleTags",
    "packageWeight",
    "shippingPayer",
  ];
  let filled = 0;
  try {
    for (const key of keys) {
      const value = fieldValue(key);
      if (!value) continue;
      const result = await sendToActiveTab({ type: "fillField", fieldKey: key, value });
      if (result?.ok && result.filled) filled += 1;
    }
    setStatus(
      els.actionStatus,
      filled
        ? `Filled ${filled} text field${filled === 1 ? "" : "s"}.`
        : "No matching fields found on this page.",
      filled ? "ok" : "error"
    );
  } catch (error) {
    setStatus(els.actionStatus, error instanceof Error ? error.message : "Fill failed", "error");
  }
}

async function handleSyncSchema() {
  if (!pairing) {
    setStatus(els.actionStatus, "Pair a listing first.", "error");
    return;
  }
  try {
    setStatus(els.actionStatus, "Reading sell form…");
    const discovery = await sendToActiveTab({ type: "discoverForm" });
    if (!discovery?.ok || !Array.isArray(discovery.fields) || !discovery.fields.length) {
      throw new Error(
        discovery?.error || "No form fields found. Open the marketplace sell/create page."
      );
    }
    const platform =
      discovery.platform ||
      (listing?.platform === "poshmark" || listing?.platform === "mercari"
        ? listing.platform
        : null);
    if (!platform) {
      throw new Error("Could not tell if this is Mercari or Poshmark.");
    }

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
    if (!res.ok) {
      throw new Error(json.error || `Sync failed (${res.status})`);
    }
    setStatus(
      els.actionStatus,
      json.message ||
        `Synced ${discovery.fields.length} fields from the live ${platform} sell page.`,
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
  const photos = listing?.photos || listing?.images || listing?.photoUrls || [];
  const links = Array.isArray(photos)
    ? photos
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            return item.url || item.src || item.downloadUrl || "";
          }
          return "";
        })
        .filter(Boolean)
    : [];

  if (!links.length) {
    setStatus(els.actionStatus, "No photo links on this listing.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(links.join("\n"));
    setStatus(
      els.actionStatus,
      `Copied ${links.length} photo link${links.length === 1 ? "" : "s"}. Upload them yourself.`,
      "ok"
    );
  } catch {
    setStatus(els.actionStatus, "Could not copy to clipboard.", "error");
  }
}

async function handleNextStep() {
  if (stepIndex < STEPS.length - 1) {
    stepIndex += 1;
  }
  await chrome.storage.local.set({ stepIndex });
  renderSteps();

  const step = STEPS[stepIndex];
  if (step.key === "review") {
    setStatus(
      els.actionStatus,
      "Review everything carefully. You press Publish yourself.",
      "ok"
    );
    return;
  }
  if (step.key === "photos") {
    setStatus(
      els.actionStatus,
      "Use Copy photo download links, then upload photos on the site yourself.",
      "ok"
    );
    return;
  }

  setStatus(els.actionStatus, `Next: ${step.label}`, "ok");
  await highlightCurrentStep();
}

function reloadExtension() {
  chrome.runtime.reload();
}

els.pairBtn.addEventListener("click", handlePair);
els.unpairBtn.addEventListener("click", clearPairing);
els.fillTitleBtn.addEventListener("click", handleFillTitle);
els.fillDescriptionBtn.addEventListener("click", handleFillDescription);
els.fillAllBtn.addEventListener("click", handleFillAll);
els.syncSchemaBtn.addEventListener("click", handleSyncSchema);
els.copyPhotosBtn.addEventListener("click", handleCopyPhotos);
els.nextStepBtn.addEventListener("click", handleNextStep);
els.reloadExtensionBtn.addEventListener("click", reloadExtension);

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
  if (els.joinCode.value.length === 6) {
    scheduleAutoPairFromJoinField();
  }
});

els.joinCode.addEventListener("paste", () => {
  window.setTimeout(scheduleAutoPairFromJoinField, 0);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.token && !changes.listingId && !changes.appUrl) return;

  void (async () => {
    const hasPairing = await loadStoredPairing();
    if (!hasPairing) {
      showPairingUi();
      return;
    }
    try {
      setConnection("Connecting…");
      await refreshListing();
      setStatus(els.pairStatus, "Connected from the web app.", "ok");
    } catch (error) {
      showPairingUi();
      setStatus(
        els.pairStatus,
        error instanceof Error
          ? `Auto-connect failed: ${error.message}`
          : "Auto-connect failed.",
        "error"
      );
    }
  })();
});

(async function init() {
  const hasPairing = await loadStoredPairing();
  if (!hasPairing) {
    showPairingUi();
    return;
  }

  try {
    setConnection("Connecting…");
    await refreshListing();
  } catch (error) {
    showPairingUi();
    setStatus(
      els.pairStatus,
      error instanceof Error
        ? `Saved pairing failed to load: ${error.message}`
        : "Saved pairing failed to load.",
      "error"
    );
  }
})();
