/** Shared coach steps + listing field helpers for background/sidepanel/content. */

var RA_COACH_STEPS = [
  {
    key: "photos",
    label: "Photos",
    help: "Add your listing photos to this page.",
    actionLabel: "Add my photos",
  },
  {
    key: "title",
    label: "Title",
    help: "Fill the title shoppers see first.",
    actionLabel: "Fill title",
  },
  {
    key: "description",
    label: "Description",
    help: "Fill the longer description.",
    actionLabel: "Fill description",
  },
  {
    key: "details",
    label: "Other details",
    help: "Fill brand, size, color, condition, prices, and tags.",
    actionLabel: "Fill the rest",
  },
  {
    key: "review",
    label: "Review & list",
    help: "Check everything looks right. You press List / Publish yourself.",
    actionLabel: "I’m ready to review",
  },
];

var RA_DETAIL_FIELDS = [
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

function raIsMarketplaceUrl(url) {
  try {
    var host = new URL(url).hostname.toLowerCase();
    return (
      host === "mercari.com" ||
      host.endsWith(".mercari.com") ||
      host === "poshmark.com" ||
      host.endsWith(".poshmark.com")
    );
  } catch (e) {
    return false;
  }
}

function raPlatformFromUrl(url) {
  if (!url) return null;
  if (/poshmark/i.test(url)) return "poshmark";
  if (/mercari/i.test(url)) return "mercari";
  return null;
}

function raFieldValueFromListing(listing, fieldKey) {
  if (!listing) return "";
  var structured = listing.structured_fields || listing.structuredFields || {};
  var map = {
    title: listing.title || listing.name,
    description: listing.description,
    brand: listing.brand || structured.brand,
    category: structured.category,
    subcategory: structured.subcategory,
    size: listing.size || structured.size,
    color: listing.color || structured.color,
    colorSecondary: structured.colorSecondary,
    condition: listing.condition || structured.condition,
    price: listing.price != null ? listing.price : listing.listPrice,
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
  var value = map[fieldKey];
  return value == null ? "" : String(value);
}

function raListingPhotoMeta(listing) {
  var photos = (listing && (listing.photos || listing.images || listing.photoUrls)) || [];
  if (!Array.isArray(photos) || !photos.length) return [];

  var roleOrder = ["cover", "front", "back", "detail", "flaw"];
  var normalized = photos
    .map(function (item, index) {
      if (typeof item === "string") {
        return { url: item, role: "detail", sortOrder: index };
      }
      if (item && typeof item === "object") {
        return {
          url:
            item.url ||
            item.src ||
            item.downloadUrl ||
            item.processedUrl ||
            "",
          role: item.role || "detail",
          sortOrder:
            typeof item.sortOrder === "number"
              ? item.sortOrder
              : typeof item.sort_order === "number"
                ? item.sort_order
                : index,
        };
      }
      return null;
    })
    .filter(function (item) {
      return item && item.url;
    });

  normalized.sort(function (a, b) {
    var ai = roleOrder.indexOf(a.role);
    var bi = roleOrder.indexOf(b.role);
    var aRank = ai === -1 ? 99 : ai;
    var bRank = bi === -1 ? 99 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.sortOrder - b.sortOrder;
  });

  return normalized;
}

function raPreviewForStep(listing, stepKey) {
  if (stepKey === "photos") {
    var count = raListingPhotoMeta(listing).length;
    return count
      ? count + " listing photo" + (count === 1 ? "" : "s") + " ready"
      : "No listing photos yet — add them in the web app first";
  }
  if (stepKey === "title") return raFieldValueFromListing(listing, "title") || "(no title)";
  if (stepKey === "description") {
    var d = raFieldValueFromListing(listing, "description");
    return d ? d.slice(0, 120) + (d.length > 120 ? "…" : "") : "(no description)";
  }
  if (stepKey === "details") {
    var parts = ["brand", "size", "color", "condition", "price"]
      .map(function (key) {
        var v = raFieldValueFromListing(listing, key);
        return v ? key + ": " + v : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : "(no extra details yet)";
  }
  if (stepKey === "review") {
    return "Look over the form, then press List / Publish on the site.";
  }
  return "";
}
