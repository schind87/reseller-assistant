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

const DEFAULT_APP_URL = "https://reseller.mvfeed.us";

const els = {
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
};

/** @type {{ appUrl: string, token: string, listingId: string } | null} */
let pairing = null;
/** @type {Record<string, unknown> | null} */
let listing = null;
let stepIndex = 0;

function setStatus(el, message, kind = "") {
  el.textContent = message || "";
  el.className = "status" + (kind ? ` ${kind}` : "");
}

function normalizeAppUrl(url) {
  const trimmed = (url || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_APP_URL;
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
}

function showListingUi() {
  els.pairSection.hidden = true;
  els.listingSection.hidden = false;

  const title = String(listing?.title || listing?.name || "Listing");
  const brand = String(listing?.brand || "—");
  const description = String(listing?.description || "—");

  els.listingTitle.textContent = title;
  els.listingBrand.textContent = brand;
  els.listingDescription.textContent = description;
  renderSteps();
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
  });
}

async function clearPairing() {
  pairing = null;
  listing = null;
  stepIndex = 0;
  await chrome.storage.local.remove(["appUrl", "token", "listingId", "stepIndex"]);
  showPairingUi();
  setStatus(els.pairStatus, "Unpaired. Enter a new code or token.");
  setStatus(els.actionStatus, "");
}

/**
 * Exchange a 6-digit join code for token + listingId.
 * GET /api/extension/pair?joinCode=XXXXXX
 */
async function pairWithJoinCode(appUrl, joinCode) {
  const url = `${appUrl}/api/extension/pair?joinCode=${encodeURIComponent(joinCode)}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Pairing failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.token || !data.listingId) {
    throw new Error("Server did not return token and listingId");
  }
  return {
    appUrl,
    token: String(data.token),
    listingId: String(data.listingId),
  };
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
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not load listing (${res.status})`);
  }
  return res.json();
}

async function refreshListing() {
  if (!pairing) return;
  listing = await fetchListing(pairing);
  showListingUi();
}

async function handlePair() {
  setStatus(els.pairStatus, "Pairing…");
  els.pairBtn.disabled = true;

  try {
    const appUrl = normalizeAppUrl(els.appUrl.value);
    const joinCode = els.joinCode.value
      .trim()
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    const token = els.token.value.trim();
    const listingId = els.listingId.value.trim();

    let next;
    if (joinCode) {
      if (joinCode.length !== 6) {
        throw new Error("Join code must be 6 digits");
      }
      next = await pairWithJoinCode(appUrl, joinCode);
    } else if (token) {
      if (!listingId) {
        throw new Error("Listing ID is required when pasting a token");
      }
      next = { appUrl, token, listingId };
    } else {
      throw new Error("Enter a 6-digit join code or paste a token");
    }

    listing = await fetchListing(next);
    stepIndex = 0;
    await savePairing(next);
    setStatus(els.pairStatus, "Paired!", "ok");
    showListingUi();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pairing failed";
    setStatus(els.pairStatus, message, "error");
  } finally {
    els.pairBtn.disabled = false;
  }
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

els.pairBtn.addEventListener("click", handlePair);
els.unpairBtn.addEventListener("click", clearPairing);
els.fillTitleBtn.addEventListener("click", handleFillTitle);
els.fillDescriptionBtn.addEventListener("click", handleFillDescription);
els.fillAllBtn.addEventListener("click", handleFillAll);
els.syncSchemaBtn.addEventListener("click", handleSyncSchema);
els.copyPhotosBtn.addEventListener("click", handleCopyPhotos);
els.nextStepBtn.addEventListener("click", handleNextStep);

els.joinCode.addEventListener("input", () => {
  els.joinCode.value = els.joinCode.value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
});

(async function init() {
  const hasPairing = await loadStoredPairing();
  if (!hasPairing) {
    showPairingUi();
    return;
  }

  try {
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
