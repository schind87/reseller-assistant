function raIsLoginWall() {
  const path = (location.pathname || "").toLowerCase();
  if (/\/login(?:\/|$)/.test(path) || /\/signin(?:\/|$)/.test(path)) {
    return true;
  }
  const text = `${document.title || ""} ${
    document.body ? document.body.innerText.slice(0, 1200) : ""
  }`.toLowerCase();
  return (
    /log in to continue|sign in to continue|welcome back/.test(text) &&
    /log in|sign in|join poshmark/.test(text)
  );
}

function raHttpsUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value, location.href);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function raMarketplaceItemUrl(url) {
  const href = raHttpsUrl(url);
  if (!href) return null;
  try {
    const parsed = new URL(href);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    if (host === "mercari.com" || host.endsWith(".mercari.com")) {
      if (/\/item\//i.test(path) || /\/us\/item\//i.test(path)) return href;
      return null;
    }
    if (host === "poshmark.com" || host.endsWith(".poshmark.com")) {
      if (/\/listing\//i.test(path)) return href.split("?")[0];
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

function raClosetStatus(raw) {
  const value = String(raw || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!value) return "unknown";
  if (/\bsold\b/.test(value) || value === "sold_out") return "sold";
  if (/\breserved\b|\bpending\b/.test(value)) return "reserved";
  if (value.includes("not for sale") || value === "nfs" || value === "nsf") {
    return "not_for_sale";
  }
  if (
    /\bavailable\b|\bactive\b|\bfor sale\b|\bpublished\b|\blisted\b/.test(value)
  ) {
    return "active";
  }
  return "unknown";
}

function raParsePrice(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 10000 ? raw / 100 : raw;
  }
  if (typeof raw === "string") {
    const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    if (!match) return null;
    const amount = Number(match[1]);
    return Number.isFinite(amount) ? amount : null;
  }
  if (raw && typeof raw === "object") {
    if (typeof raw.val === "number") return raParsePrice(raw.val);
    if (typeof raw.amount === "number") return raParsePrice(raw.amount);
    if (typeof raw.cents === "number") return raParsePrice(raw.cents / 100);
  }
  return null;
}

function raExternalIdFromUrl(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

function raPushListing(seen, listings, item) {
  const url = raMarketplaceItemUrl(item.url);
  if (!url) return;
  const key = url.split("?")[0].toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  listings.push({
    externalId: String(item.externalId || raExternalIdFromUrl(url)).slice(0, 120),
    title: item.title ? String(item.title).slice(0, 200) : null,
    price: raParsePrice(item.price),
    status: raClosetStatus(item.status),
    url,
    thumbnailUrl: raHttpsUrl(item.thumbnailUrl),
  });
}

function raWalkJsonListings(value, seen, listings, depth) {
  if (depth > 8 || listings.length >= 200) return;
  if (!value || typeof value !== "object") return;

  const record = value;
  const url =
    record.url ||
    record.canonical_url ||
    record.listing_url ||
    record.itemUrl ||
    record.permalink ||
    null;

  const title = record.title || record.name || record.item_name || null;
  const id = record.id || record.listing_id || record.item_id || record.uuid;
  if (url && (title || id)) {
    raPushListing(seen, listings, {
      externalId: id,
      title,
      price:
        record.price ||
        record.price_amount ||
        record.original_price ||
        record.asking_price,
      status:
        record.status ||
        record.inventory?.status ||
        record.listing_status ||
        record.state,
      url,
      thumbnailUrl:
        record.cover_shot?.url_small ||
        record.cover_shot?.url ||
        record.thumbnail ||
        record.thumbnail_url ||
        record.image_url ||
        record.photos?.[0]?.url ||
        record.thumbnails?.[0],
    });
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      raWalkJsonListings(entry, seen, listings, depth + 1);
    }
    return;
  }

  for (const key of Object.keys(record)) {
    if (["props", "data", "listings", "items", "tiles", "results"].includes(key) || depth < 4) {
      raWalkJsonListings(record[key], seen, listings, depth + 1);
    }
  }
}

function raListingsFromScripts(seen, listings) {
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    if (listings.length >= 200) return;
    const id = script.id || "";
    const text = script.textContent || "";
    if (!text || text.length > 2_000_000) continue;
    if (
      id === "__NEXT_DATA__" ||
      /__NEXT_DATA__|__INITIAL_STATE__|closet_listings|listings/.test(
        text.slice(0, 400)
      )
    ) {
      try {
        const json = JSON.parse(text);
        raWalkJsonListings(json, seen, listings, 0);
      } catch {
        // Not standalone JSON.
      }
    }
  }
}

function raClosestCard(node) {
  return (
    node.closest("article") ||
    node.closest("[data-testid*='listing']") ||
    node.closest("[class*='tile']") ||
    node.closest("[class*='card']") ||
    node.closest("li") ||
    node.parentElement
  );
}

function raListingsFromDom(seen, listings) {
  const links = document.querySelectorAll('a[href]');
  for (const link of links) {
    if (listings.length >= 200) return;
    const href = link.getAttribute("href");
    const url = raMarketplaceItemUrl(href);
    if (!url) continue;
    const card = raClosestCard(link);
    const img = card ? card.querySelector("img") : link.querySelector("img");
    const text = (card ? card.innerText : link.textContent) || "";
    const priceMatch = text.match(/\$\s?(\d[\d,]*(?:\.\d{2})?)/);
    const statusMatch = text.match(
      /\b(sold|reserved|not for sale|available|active)\b/i
    );
    const title =
      (img && img.getAttribute("alt")) ||
      (link.getAttribute("title") || "").trim() ||
      text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !/^\$/.test(line) && line.length > 2) ||
      null;
    raPushListing(seen, listings, {
      externalId: raExternalIdFromUrl(url),
      title,
      price: priceMatch ? priceMatch[0] : null,
      status: statusMatch ? statusMatch[1] : "active",
      url,
      thumbnailUrl: img ? img.currentSrc || img.src : null,
    });
  }
}

async function raScrollClosetOnce() {
  const height = Math.max(
    document.body ? document.body.scrollHeight : 0,
    document.documentElement ? document.documentElement.scrollHeight : 0
  );
  window.scrollTo(0, Math.min(height, 1800));
  await new Promise((resolve) => window.setTimeout(resolve, 700));
}

async function raExtractClosetListings() {
  if (raIsLoginWall()) {
    return {
      ok: false,
      listings: [],
      loginRequired: true,
      error: "Sign in to this store in Chrome, then try Check listings again.",
    };
  }

  await raScrollClosetOnce();

  const seen = new Set();
  const listings = [];
  raListingsFromScripts(seen, listings);
  raListingsFromDom(seen, listings);

  return {
    ok: true,
    listings,
    loginRequired: false,
  };
}

const RA_USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
const RA_POSHMARK_CLOSET_SKIP = new Set([
  "all",
  "available",
  "brand",
  "following",
  "followers",
  "listings",
  "news",
  "party",
  "search",
  "share",
  "shows",
  "sold",
]);
const RA_RESERVED_HANDLES = new Set([
  "about",
  "help",
  "login",
  "mypage",
  "search",
  "sell",
  "settings",
  "signup",
  "user",
]);

function raNormalizeUsername(value) {
  if (!value || typeof value !== "string") return null;
  const handle = value.trim().replace(/^@/, "");
  if (!RA_USERNAME_RE.test(handle)) return null;
  if (RA_RESERVED_HANDLES.has(handle.toLowerCase())) return null;
  return handle;
}

function raUsernameFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, location.href);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "poshmark.com" || host.endsWith(".poshmark.com")) {
      if (parts[0]?.toLowerCase() !== "closet") return null;
      const handle = raNormalizeUsername(parts[1]);
      if (!handle || RA_POSHMARK_CLOSET_SKIP.has(handle.toLowerCase())) {
        return null;
      }
      return handle;
    }
    if (host === "mercari.com" || host.endsWith(".mercari.com")) {
      const index = parts.findIndex((part) => part.toLowerCase() === "u");
      if (index < 0) return null;
      return raNormalizeUsername(parts[index + 1]);
    }
  } catch {
    return null;
  }
  return null;
}

function raUsernameFromNav() {
  const counts = new Map();
  const links = document.querySelectorAll("a[href]");
  for (const link of links) {
    const handle = raUsernameFromHref(link.getAttribute("href"));
    if (!handle) continue;
    const boost = link.closest("header, nav, [role='navigation']") ? 5 : 1;
    counts.set(handle, (counts.get(handle) || 0) + boost);
  }
  let best = null;
  let bestScore = 0;
  for (const [handle, score] of counts) {
    if (score > bestScore) {
      best = handle;
      bestScore = score;
    }
  }
  return best;
}

function raWalkJsonUsername(value, depth) {
  if (depth > 6 || !value || typeof value !== "object") return null;
  const record = value;
  const likelyUser =
    record.current_user ||
    record.currentUser ||
    record.viewer ||
    record.session_user ||
    record.sessionUser ||
    (record.is_current_user || record.isMe || record.is_me ? record : null);
  const fromLikely = likelyUser
    ? raNormalizeUsername(
        likelyUser.username ||
          likelyUser.closet_username ||
          likelyUser.unique_name ||
          likelyUser.handle ||
          likelyUser.screen_name
      )
    : null;
  if (fromLikely) return fromLikely;

  const direct = raNormalizeUsername(
    record.username ||
      record.closet_username ||
      record.unique_name ||
      record.handle
  );
  if (direct && (record.is_current_user || record.isMe || record.email)) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = raWalkJsonUsername(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  for (const key of Object.keys(record)) {
    if (
      /user|session|viewer|profile|closet/i.test(key) ||
      depth < 3
    ) {
      const found = raWalkJsonUsername(record[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function raUsernameFromScripts() {
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text || text.length > 1_500_000) continue;
    if (script.id === "__NEXT_DATA__" || /current_user|username|closet/.test(text.slice(0, 800))) {
      try {
        const json = JSON.parse(text);
        const found = raWalkJsonUsername(json, 0);
        if (found) return found;
      } catch {
        // Not standalone JSON.
      }
    }
  }
  return null;
}

async function raExtractSignedInUsername() {
  if (raIsLoginWall()) {
    return {
      ok: false,
      loginRequired: true,
      error: "Sign in to this store in Chrome, then try Find my closet.",
    };
  }

  await new Promise((resolve) => window.setTimeout(resolve, 400));

  const username =
    raUsernameFromHref(location.href) ||
    raUsernameFromScripts() ||
    raUsernameFromNav();

  if (!username) {
    return {
      ok: false,
      error: "Could not find your closet name on this page.",
    };
  }

  return { ok: true, username };
}

globalThis.raExtractClosetListings = raExtractClosetListings;
globalThis.raExtractSignedInUsername = raExtractSignedInUsername;
