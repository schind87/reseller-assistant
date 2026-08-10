import type { Platform } from "@/lib/types";
import { getMarketplaceCategoryOptions } from "@/lib/marketplace-categories";
import { POSHMARK_COLORS } from "@/lib/poshmark-formats";
import { POSHMARK_STYLE_TAGS } from "@/lib/poshmark-style-tags";

export type ListingFieldInput =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "tags";

/** Where a marketplace field maps in our listing model. */
export type ListingFieldSource =
  | "title"
  | "description"
  | "price"
  | `structured:${string}`;

export type ListingFieldDef = {
  id: string;
  /** Label as shown (or closely matched) on the marketplace sell form. */
  label: string;
  input: ListingFieldInput;
  required: boolean;
  source: ListingFieldSource;
  maxLength?: number;
  /** How the marketplace uses this field, constraints, and best practices. */
  hint?: string;
  placeholder?: string;
  options?: string[];
  /** Used for extension autofill keyword matching. */
  keywords: string[];
  /** Include in the post checklist / copy panel. */
  copyable: boolean;
};

export type PlatformListingSchema = {
  platform: Platform;
  version: number;
  sellPageUrl: string;
  source: "seed" | "extension";
  syncedAt: string | null;
  fields: ListingFieldDef[];
};

const MERCARI_CONDITION = [
  "New",
  "Like new",
  "Good",
  "Fair",
  "Poor",
];

/** Live Poshmark create-listing condition choices (Aug 2026). */
const POSHMARK_CONDITION = [
  "New With Tags",
  "Like New",
  "Good",
  "Fair",
];

export const SEED_LISTING_SCHEMAS: Record<Platform, PlatformListingSchema> = {
  mercari: {
    platform: "mercari",
    version: 4,
    sellPageUrl: "https://www.mercari.com/sell/",
    source: "seed",
    syncedAt: null,
    fields: [
      {
        id: "title",
        label: "Title",
        input: "text",
        required: true,
        source: "title",
        maxLength: 80,
        hint: "Mercari’s listing title (~80 chars). Search and mobile cards truncate early—lead with brand, item type, size, and color. Skip filler like “cute” or “must see.”",
        keywords: ["title", "item name", "listing title", "name your item"],
        copyable: true,
      },
      {
        id: "brand",
        label: "Brand",
        input: "text",
        required: false,
        source: "structured:brand",
        hint: "Optional Mercari brand field. Prefer the label on the garment; use “Unbranded” / leave blank only when there truly is no brand. Matching a known brand helps filters.",
        keywords: ["brand", "designer", "make"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Required Mercari department (Women, Men, Kids, …). Same tree as the sell form—drives browse filters and which size options appear next.",
        options: getMarketplaceCategoryOptions("mercari"),
        keywords: ["category", "item category", "select a category"],
        copyable: true,
      },
      {
        id: "subcategory",
        label: "Subcategory",
        input: "select",
        required: false,
        source: "structured:subcategory",
        hint: "Mercari’s next level under the department (e.g. Tops & blouses). Pick the closest match so shoppers find you in category browse; clears if you change category.",
        options: [],
        keywords: ["subcategory", "sub category", "sub-category"],
        copyable: true,
      },
      {
        id: "size",
        label: "Size",
        input: "text",
        required: false,
        source: "structured:size",
        hint: "Mercari size for this category. Use the tag size (US when possible). Accurate size is a top filter—don’t guess from photos alone.",
        keywords: ["size"],
        copyable: true,
      },
      {
        id: "color",
        label: "Color",
        input: "text",
        required: false,
        source: "structured:color",
        hint: "Primary color shoppers filter on. Name the dominant color; put prints or secondary colors in the description if needed.",
        keywords: ["color", "colour"],
        copyable: true,
      },
      {
        id: "condition",
        label: "Condition",
        input: "select",
        required: true,
        source: "structured:condition",
        options: MERCARI_CONDITION,
        hint: "Required Mercari grade: New → Poor. Be honest—mismatched condition causes returns and bad reviews. Note flaws in the description too.",
        keywords: ["condition"],
        copyable: true,
      },
      {
        id: "price",
        label: "Price",
        input: "number",
        required: true,
        source: "price",
        hint: "Asking price in USD. Mercari takes fees from the sale; price so you still net what you want after fees and shipping if you pay shipping.",
        keywords: ["price", "listing price", "set a price"],
        copyable: true,
      },
      {
        id: "packageWeight",
        label: "Package weight",
        input: "text",
        required: false,
        source: "structured:packageWeight",
        hint: "Used when buying Mercari shipping labels. Weigh the packed item (or estimate closely)—underweight labels can cause carrier fees.",
        keywords: ["weight", "package weight", "shipping weight", "item weight"],
        copyable: true,
      },
      {
        id: "shippingPayer",
        label: "Who pays shipping",
        input: "select",
        required: false,
        source: "structured:shippingPayer",
        options: ["Buyer", "Seller"],
        hint: "Buyer-paid vs seller-paid shipping on Mercari. Seller-paid can boost conversion; bake the cost into price if you choose it.",
        keywords: ["shipping", "who pays", "shipping fee", "payer"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Mercari has no dedicated fabric field—capture composition here to paste into the description (e.g. 100% cotton). Helps search and returns.",
        keywords: ["fabric", "material", "composition"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat garment measurements (chest/bust, waist, length, inseam). Mercari expects these in the description—critical for clothing fit.",
        keywords: ["measurement", "measurements", "bust", "waist", "inseam"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "No separate Mercari field—state smoke-free / pet-free (or disclose otherwise) in the description. Buyers expect this disclosure.",
        keywords: ["smoke", "pet", "pets"],
        copyable: true,
      },
      {
        id: "description",
        label: "Description",
        input: "textarea",
        required: true,
        source: "description",
        maxLength: 1000,
        hint: "Mercari details (max ~1000 chars). Include fit, measurements, fabric, flaws, and smoke/pet notes. Rewrite with AI after the structured fields above are correct.",
        keywords: ["description", "describe", "details", "item description"],
        copyable: true,
      },
    ],
  },
  poshmark: {
    platform: "poshmark",
    version: 6,
    sellPageUrl: "https://poshmark.com/create-listing",
    source: "seed",
    syncedAt: null,
    fields: [
      {
        id: "title",
        label: "Title",
        input: "text",
        required: true,
        source: "title",
        maxLength: 80,
        hint: "Poshmark listing title (~80 chars). Mobile truncates early—brand and item type first, then size/color. Avoid ALL CAPS and keyword stuffing.",
        keywords: ["title", "listing title", "item title"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Required Poshmark department (Women, Men, Kids, …). Same as create-listing; unlocks the right subcategory and size charts.",
        options: getMarketplaceCategoryOptions("poshmark"),
        keywords: ["category"],
        copyable: true,
      },
      {
        id: "subcategory",
        label: "Subcategory",
        input: "select",
        required: false,
        source: "structured:subcategory",
        hint: "Optional Poshmark subcategory under the department. Choose the closest match for Party / browse discovery; clears if category changes.",
        options: [],
        keywords: ["subcategory", "sub category"],
        copyable: true,
      },
      {
        id: "brand",
        label: "Brand",
        input: "text",
        required: true,
        source: "structured:brand",
        hint: "Required. Prefer a brand from Poshmark’s autocomplete so the listing links to that brand page. Type carefully—custom free-text brands get less browse traffic.",
        keywords: ["brand", "designer"],
        copyable: true,
      },
      {
        id: "size",
        label: "Size",
        input: "text",
        required: true,
        source: "structured:size",
        hint: "Required. Use the size on the garment tag (US when possible). Poshmark size is a major filter—don’t invent sizes from photos.",
        keywords: ["size"],
        copyable: true,
      },
      {
        id: "color",
        label: "Primary color",
        input: "select",
        required: true,
        source: "structured:color",
        options: [...POSHMARK_COLORS],
        hint: "Required. Must be one of Poshmark’s fixed color swatches (not free text). Pick the dominant color; add a second swatch if needed.",
        keywords: ["color", "colour", "primary color"],
        copyable: true,
      },
      {
        id: "colorSecondary",
        label: "Secondary color",
        input: "select",
        required: false,
        source: "structured:colorSecondary",
        options: [...POSHMARK_COLORS],
        hint: "Optional second swatch from the same Poshmark color list. Use for two-tone or strong accents; leave blank for solids.",
        keywords: ["secondary color", "second color", "color 2"],
        copyable: true,
      },
      {
        id: "condition",
        label: "Condition",
        input: "select",
        required: true,
        source: "structured:condition",
        options: POSHMARK_CONDITION,
        hint: "Required: New With Tags, Like New (use for NWOT / never worn), Good, or Fair. Be accurate—Poshmark buyers rely on this badge.",
        keywords: ["condition", "nwt", "nwot", "like new"],
        copyable: true,
      },
      {
        id: "originalPrice",
        label: "Original price",
        input: "number",
        required: true,
        source: "structured:originalPrice",
        hint: "Required retail / MSRP in USD. Poshmark shows the discount vs listing price. Estimate fairly if unknown—wildly inflated retail looks spammy.",
        keywords: ["original price", "retail price", "original"],
        copyable: true,
      },
      {
        id: "price",
        label: "Listing price",
        input: "number",
        required: true,
        source: "price",
        hint: "Your asking price in USD (seller shipping is typically built into Poshmark). Price under original retail when possible so the % off looks appealing.",
        keywords: ["price", "listing price", "asking price"],
        copyable: true,
      },
      {
        id: "styleTags",
        label: "Style tags",
        input: "tags",
        required: false,
        source: "structured:styleTags",
        options: [...POSHMARK_STYLE_TAGS],
        hint: "Up to 3 tags from Poshmark’s official suggestions (type to search). Prefer their list over custom tags for search and marketing features.",
        keywords: ["style", "style tags", "tags"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Poshmark has no fabric field—store composition here to include in the description (helps search and buyer confidence).",
        keywords: ["fabric", "material"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat measurements for clothing (chest/bust, waist, length, inseam). Put them in the description—Poshmark has no dedicated measurements field.",
        keywords: ["measurement", "measurements"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "No separate Poshmark field—disclose smoke-free / pet-free (or not) in the description. Buyers look for this.",
        keywords: ["smoke", "pet", "pets"],
        copyable: true,
      },
      {
        id: "description",
        label: "Description",
        input: "textarea",
        required: true,
        source: "description",
        maxLength: 5000,
        hint: "Poshmark details (up to ~5000 chars). Cover fit, flat measurements, fabric, flaws, and smoke/pet notes. Rewrite with AI after structured fields are set.",
        keywords: ["description", "describe your item", "details"],
        copyable: true,
      },
    ],
  },
};

export function getSeedListingSchema(platform: Platform): PlatformListingSchema {
  return SEED_LISTING_SCHEMAS[platform];
}

export function structuredKey(source: ListingFieldSource): string | null {
  if (source.startsWith("structured:")) {
    return source.slice("structured:".length);
  }
  return null;
}
