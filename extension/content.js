const FIELD_KEYWORDS = {
  title: ["title", "item name", "listing title", "name your item", "what are you selling"],
  description: ["description", "describe", "details", "item description", "tell buyers"],
  brand: ["brand", "designer", "make"],
  category: ["category", "item category", "select a category"],
  subcategory: ["subcategory", "sub category", "sub-category"],
  size: ["size"],
  color: ["color", "colour", "primary color"],
  colorSecondary: ["secondary color", "second color", "color 2"],
  condition: ["condition", "nwt", "nwot"],
  price: ["price", "listing price", "ask price", "set a price", "asking price"],
  originalPrice: ["original price", "retail price", "original"],
  styleTags: ["style tags", "style tag", "tags"],
  packageWeight: ["weight", "package weight", "shipping weight", "item weight"],
  shippingPayer: ["who pays", "shipping fee", "payer", "shipping paid"],
  fabric: ["fabric", "material", "composition"],
  measurements: ["measurement", "measurements"],
};

const HIGHLIGHT_STYLE_ID = "reseller-assistant-highlight-style";

function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .ra-highlight-target {
      outline: 3px solid #1F5C4A !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 6px rgba(31, 92, 74, 0.25) !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isFillable(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.disabled || el.readOnly) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !["hidden", "checkbox", "radio", "file", "submit", "button", "image", "reset"].includes(
      type
    );
  }
  if (el.isContentEditable) return true;
  return false;
}

function candidates() {
  return Array.from(
    document.querySelectorAll("input, textarea, select, [contenteditable='true']")
  ).filter(isFillable);
}

function labelTextFor(el) {
  const chunks = [];

  if (el.id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (byFor) chunks.push(byFor.textContent || "");
  }

  const wrappingLabel = el.closest("label");
  if (wrappingLabel) chunks.push(wrappingLabel.textContent || "");

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach((id) => {
      const node = document.getElementById(id);
      if (node) chunks.push(node.textContent || "");
    });
  }

  const describedBy = el.getAttribute("aria-describedby");
  if (describedBy) {
    describedBy.split(/\s+/).forEach((id) => {
      const node = document.getElementById(id);
      if (node) chunks.push(node.textContent || "");
    });
  }

  const prev = el.previousElementSibling;
  if (prev && /^(LABEL|SPAN|P|DIV|LEGEND|H[1-6])$/i.test(prev.tagName)) {
    chunks.push(prev.textContent || "");
  }

  const parent = el.parentElement;
  if (parent) {
    const parentLabel = parent.querySelector("label, legend, [class*='label'], [class*='Label']");
    if (parentLabel) chunks.push(parentLabel.textContent || "");
  }

  return normalizeText(chunks.join(" "));
}

function metaTextFor(el) {
  return normalizeText(
    [
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("data-testid"),
      el.getAttribute("autocomplete"),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function scoreElement(el, fieldKey) {
  const keywords = FIELD_KEYWORDS[fieldKey] || [fieldKey];
  const haystack = `${labelTextFor(el)} ${metaTextFor(el)}`;
  let score = 0;

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += keyword.length >= 5 ? 12 : 8;
    }
  }

  if (fieldKey === "description" && el.tagName === "TEXTAREA") score += 6;
  if (fieldKey === "title" && el.tagName === "INPUT") score += 3;
  if (fieldKey === "price") {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "number" || type === "tel" || type === "text") score += 2;
    if (/price|amount|cost/.test(haystack)) score += 4;
  }

  // Prefer visible fields.
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) score += 2;

  return score;
}

function findField(fieldKey, selector) {
  if (selector) {
    const direct = document.querySelector(selector);
    if (direct && isFillable(direct)) return direct;
  }

  let best = null;
  let bestScore = 0;
  for (const el of candidates()) {
    const score = scoreElement(el, fieldKey);
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }

  return bestScore >= 6 ? best : null;
}

function setNativeValue(el, value) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : null;

  if (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, value);
      return;
    }
  }

  el.value = value;
}

function dispatchInputEvents(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: String(el.value ?? ""), inputType: "insertText" }));
}

function fillElement(el, value) {
  el.focus();

  if (el.isContentEditable) {
    el.textContent = value;
    dispatchInputEvents(el);
    return true;
  }

  if (el instanceof HTMLSelectElement) {
    const normalized = normalizeText(value);
    const option =
      Array.from(el.options).find((opt) => normalizeText(opt.text) === normalized) ||
      Array.from(el.options).find((opt) => normalizeText(opt.value) === normalized) ||
      Array.from(el.options).find((opt) => normalizeText(opt.text).includes(normalized));

    if (!option) return false;
    el.value = option.value;
    dispatchInputEvents(el);
    return true;
  }

  setNativeValue(el, value);
  dispatchInputEvents(el);
  return true;
}

function clearHighlights() {
  document.querySelectorAll(".ra-highlight-target").forEach((node) => {
    node.classList.remove("ra-highlight-target");
  });
}

function highlightElement(el) {
  ensureHighlightStyle();
  clearHighlights();
  el.classList.add("ra-highlight-target");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleFillField(payload) {
  const fieldKey = payload?.fieldKey || "title";
  const value = payload?.value == null ? "" : String(payload.value);
  const selector = payload?.selector || null;

  if (!value) {
    return { ok: false, filled: false, error: "Empty value" };
  }

  const el = findField(fieldKey, selector);
  if (!el) {
    return { ok: false, filled: false, error: `No field matched for ${fieldKey}` };
  }

  const filled = fillElement(el, value);
  if (filled) highlightElement(el);
  return { ok: filled, filled };
}

function handleHighlightNext(payload) {
  const fieldKey = payload?.fieldKey || "title";
  const el = findField(fieldKey, payload?.selector || null);
  if (!el) {
    return { ok: false, filled: false, error: `No field matched for ${fieldKey}` };
  }
  highlightElement(el);
  return { ok: true, filled: false };
}

function guessInputType(el, label) {
  if (el.tagName === "TEXTAREA") return "textarea";
  if (el.tagName === "SELECT") return "select";
  const type = (el.getAttribute("type") || "text").toLowerCase();
  if (type === "number" || /price|weight/.test(label)) return "number";
  if (/tag/.test(label)) return "tags";
  return "text";
}

function discoverFormFields() {
  const seen = new Set();
  const fields = [];

  for (const el of candidates()) {
    const label = labelTextFor(el) || metaTextFor(el);
    if (!label || label.length < 2) continue;
    const shortLabel = label.slice(0, 80);
    const key = `${el.tagName}:${shortLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const id = shortLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);

    const options =
      el instanceof HTMLSelectElement
        ? Array.from(el.options)
            .map((opt) => (opt.textContent || "").trim())
            .filter((text) => text && !/^select/i.test(text))
            .slice(0, 40)
        : undefined;

    const required =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true" ||
      /\*/.test(shortLabel);

    fields.push({
      id: id || `field_${fields.length + 1}`,
      label: shortLabel.replace(/\*$/, "").trim(),
      input: guessInputType(el, shortLabel),
      required,
      keywords: [shortLabel],
      options,
      maxLength: el.maxLength > 0 ? el.maxLength : undefined,
    });
  }

  return {
    ok: true,
    url: location.href,
    platform: /poshmark/i.test(location.hostname)
      ? "poshmark"
      : /mercari/i.test(location.hostname)
        ? "mercari"
        : null,
    fields,
  };
}

function findPhotoFileInput() {
  const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(
    (el) => el instanceof HTMLInputElement && !el.disabled
  );

  if (!inputs.length) return null;

  const scored = inputs.map((input) => {
    let score = 0;
    if (input.multiple) score += 5;
    const accept = (input.getAttribute("accept") || "").toLowerCase();
    if (!accept || accept.includes("image") || accept.includes("*/*")) score += 4;
    if (accept && !accept.includes("image") && !accept.includes("*") && !accept.includes(".")) {
      score -= 3;
    }
    const nearby = input.closest(
      "[class*='photo'], [class*='Photo'], [class*='image'], [class*='Image'], [class*='upload'], [class*='Upload'], [data-testid*='photo'], [data-testid*='image']"
    );
    const label = normalizeText(
      `${labelTextFor(input)} ${metaTextFor(input)} ${nearby?.textContent || ""}`
    );
    if (/photo|image|picture|upload|gallery|media/.test(label)) score += 6;
    if (input.offsetParent !== null) score += 2;
    return { input, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.input ?? null;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function handleAttachPhotos(payload) {
  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  if (!photos.length) {
    return { ok: false, attached: 0, error: "No photos were provided." };
  }

  const input = findPhotoFileInput();
  if (!input) {
    return {
      ok: false,
      attached: 0,
      error:
        "Could not find a photo upload control on this page. Open the sell/create form photo step, then try again.",
    };
  }

  const dt = new DataTransfer();
  const maxFiles = input.multiple ? photos.length : 1;

  for (let i = 0; i < maxFiles; i += 1) {
    const photo = photos[i];
    if (!photo?.base64) continue;
    const type = photo.contentType || "image/jpeg";
    const bytes = base64ToUint8Array(photo.base64);
    const file = new File([bytes], photo.filename || `photo-${i + 1}.jpg`, {
      type,
    });
    dt.items.add(file);
  }

  if (!dt.files.length) {
    return { ok: false, attached: 0, error: "Could not decode photo files." };
  }

  input.files = dt.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  highlightElement(input);

  return {
    ok: true,
    attached: dt.files.length,
    multiple: Boolean(input.multiple),
    truncated: !input.multiple && photos.length > 1,
  };
}

function handleMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, filled: false, error: "Invalid message" };
  }

  switch (message.type) {
    case "fillField":
      return handleFillField(message);
    case "highlightNext":
      return handleHighlightNext(message);
    case "discoverForm":
      return discoverFormFields();
    case "attachPhotos":
      return handleAttachPhotos(message);
    default:
      return { ok: false, filled: false, error: `Unknown message type: ${message.type}` };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "attachPhotos") {
    void handleAttachPhotos(message)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          attached: 0,
          error: error instanceof Error ? error.message : "Attach failed",
        })
      );
    return true;
  }

  try {
    sendResponse(handleMessage(message));
  } catch (error) {
    sendResponse({
      ok: false,
      filled: false,
      error: error instanceof Error ? error.message : "Fill failed",
    });
  }
  return true;
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "reseller-assistant" || !data.type) return;

  void Promise.resolve(handleMessage(data)).then((result) => {
    window.postMessage(
      {
        source: "reseller-assistant-content",
        requestId: data.requestId,
        ...result,
      },
      "*"
    );
  });
});
