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
        hint: "Lead with brand, type, size, and color. About 80 characters; skip filler like “cute.”",
        keywords: ["title", "item name", "listing title", "name your item"],
        copyable: true,
      },
      {
        id: "brand",
        label: "Brand",
        input: "text",
        required: false,
        source: "structured:brand",
        hint: "Use the label on the garment. Leave blank only when there is no brand.",
        keywords: ["brand", "designer", "make"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Women, Men, Kids, and so on — same tree as Mercari. Sets which sizes appear next.",
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
        hint: "Next level under the department (e.g. Tops & blouses). Clears if you change category.",
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
        hint: "Use the tag size (US when possible). Don’t guess from photos.",
        keywords: ["size"],
        copyable: true,
      },
      {
        id: "color",
        label: "Color",
        input: "text",
        required: false,
        source: "structured:color",
        hint: "Name the dominant color. Put prints or extra colors in the description.",
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
        hint: "New through Poor. Note flaws in the description too.",
        keywords: ["condition"],
        copyable: true,
      },
      {
        id: "price",
        label: "Price",
        input: "number",
        required: true,
        source: "price",
        hint: "Asking price in USD. Mercari takes fees from the sale.",
        keywords: ["price", "listing price", "set a price"],
        copyable: true,
      },
      {
        id: "packageWeight",
        label: "Package weight",
        input: "text",
        required: false,
        source: "structured:packageWeight",
        hint: "For Mercari shipping labels. Weigh the packed item — underweight labels can add fees.",
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
        hint: "Buyer-paid vs seller-paid. If you pay shipping, bake the cost into the price.",
        keywords: ["shipping", "who pays", "shipping fee", "payer"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Mercari has no fabric field — put composition in the description (e.g. 100% cotton).",
        keywords: ["fabric", "material", "composition"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat measurements (chest/bust, waist, length, inseam). Mercari expects these in the description.",
        keywords: ["measurement", "measurements", "bust", "waist", "inseam"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "No separate Mercari field — disclose smoke-free / pet-free (or not) in the description.",
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
        hint: "Include fit, measurements, fabric, flaws, and smoke/pet notes. About 1000 characters.",
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
        hint: "Lead with brand and type, then size or color. About 80 characters. Avoid ALL CAPS.",
        keywords: ["title", "listing title", "item title"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Women, Men, Kids, and so on — same as create-listing. Sets subcategory and size charts.",
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
        hint: "Optional subcategory under the department. Clears if category changes.",
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
        hint: "Required. Pick from Poshmark’s suggestions so the listing links to that brand.",
        keywords: ["brand", "designer"],
        copyable: true,
      },
      {
        id: "size",
        label: "Size",
        input: "text",
        required: true,
        source: "structured:size",
        hint: "Required. Use the size on the garment tag (US when possible).",
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
        hint: "Required. Pick from Poshmark’s color list — not free text.",
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
        hint: "Optional second color for two-tone or strong accents. Leave blank for solids.",
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
        hint: "New With Tags, Like New (also for NWOT), Good, or Fair.",
        keywords: ["condition", "nwt", "nwot", "like new"],
        copyable: true,
      },
      {
        id: "originalPrice",
        label: "Original price",
        input: "number",
        required: true,
        source: "structured:originalPrice",
        hint: "Required retail / MSRP in USD. Poshmark shows the discount vs listing price.",
        keywords: ["original price", "retail price", "original"],
        copyable: true,
      },
      {
        id: "price",
        label: "Listing price",
        input: "number",
        required: true,
        source: "price",
        hint: "Your asking price in USD. Seller shipping is typically built in.",
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
        hint: "Up to 3 tags from Poshmark’s list. Type to search.",
        keywords: ["style", "style tags", "tags"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Poshmark has no fabric field — put composition in the description.",
        keywords: ["fabric", "material"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat measurements (chest/bust, waist, length, inseam). Put them in the description.",
        keywords: ["measurement", "measurements"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "No separate Poshmark field — disclose smoke-free / pet-free (or not) in the description.",
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
        hint: "Include fit, measurements, fabric, flaws, and smoke/pet notes.",
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
