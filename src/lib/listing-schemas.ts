import type { Platform } from "@/lib/types";
import { getMarketplaceCategoryOptions } from "@/lib/marketplace-categories";

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

const POSHMARK_CONDITION = [
  "New With Tags",
  "New Without Tags",
  "Excellent",
  "Good",
  "Fair",
];

export const SEED_LISTING_SCHEMAS: Record<Platform, PlatformListingSchema> = {
  mercari: {
    platform: "mercari",
    version: 3,
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
        hint: "Mercari shows ~80 characters. Front-load brand, type, size, color.",
        keywords: ["title", "item name", "listing title", "name your item"],
        copyable: true,
      },
      {
        id: "brand",
        label: "Brand",
        input: "text",
        required: false,
        source: "structured:brand",
        keywords: ["brand", "designer", "make"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Mercari department (same choices as the sell form).",
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
        hint: "Pick the Mercari subcategory under the department you chose.",
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
        keywords: ["size"],
        copyable: true,
      },
      {
        id: "color",
        label: "Color",
        input: "text",
        required: false,
        source: "structured:color",
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
        keywords: ["condition"],
        copyable: true,
      },
      {
        id: "price",
        label: "Price",
        input: "number",
        required: true,
        source: "price",
        hint: "Listing price in USD.",
        keywords: ["price", "listing price", "set a price"],
        copyable: true,
      },
      {
        id: "packageWeight",
        label: "Package weight",
        input: "text",
        required: false,
        source: "structured:packageWeight",
        hint: "Mercari uses weight to suggest shipping labels.",
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
        keywords: ["shipping", "who pays", "shipping fee", "payer"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Usually goes in the description on Mercari; keep it handy to paste.",
        keywords: ["fabric", "material", "composition"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat measurements for clothing — paste into description.",
        keywords: ["measurement", "measurements", "bust", "waist", "inseam"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "Include in the description — Mercari has no separate field.",
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
        hint: "Last step — rewrite with AI after the fields above are correct. Include measurements, fabric, flaws, and smoke/pet notes.",
        keywords: ["description", "describe", "details", "item description"],
        copyable: true,
      },
    ],
  },
  poshmark: {
    platform: "poshmark",
    version: 3,
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
        hint: "Brand-first title. Mobile truncates early — put brand and type first.",
        keywords: ["title", "listing title", "item title"],
        copyable: true,
      },
      {
        id: "category",
        label: "Category",
        input: "select",
        required: true,
        source: "structured:category",
        hint: "Poshmark department (Women, Men, Kids, …) — same as the sell form.",
        options: getMarketplaceCategoryOptions("poshmark"),
        keywords: ["category"],
        copyable: true,
      },
      {
        id: "subcategory",
        label: "Subcategory",
        input: "select",
        required: true,
        source: "structured:subcategory",
        hint: "Poshmark category under that department (Tops, Dresses, Shoes, …).",
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
        keywords: ["brand"],
        copyable: true,
      },
      {
        id: "size",
        label: "Size",
        input: "text",
        required: true,
        source: "structured:size",
        hint: "Use the size on the garment tag.",
        keywords: ["size"],
        copyable: true,
      },
      {
        id: "color",
        label: "Primary color",
        input: "text",
        required: true,
        source: "structured:color",
        keywords: ["color", "colour", "primary color"],
        copyable: true,
      },
      {
        id: "colorSecondary",
        label: "Secondary color",
        input: "text",
        required: false,
        source: "structured:colorSecondary",
        hint: "Poshmark lets you mark up to two colors.",
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
        keywords: ["condition", "nwt", "nwot"],
        copyable: true,
      },
      {
        id: "originalPrice",
        label: "Original price",
        input: "number",
        required: false,
        source: "structured:originalPrice",
        hint: "Retail / original price when known.",
        keywords: ["original price", "retail price", "original"],
        copyable: true,
      },
      {
        id: "price",
        label: "Listing price",
        input: "number",
        required: true,
        source: "price",
        keywords: ["price", "listing price", "asking price"],
        copyable: true,
      },
      {
        id: "styleTags",
        label: "Style tags",
        input: "tags",
        required: false,
        source: "structured:styleTags",
        hint: "Comma-separated style tags (e.g. Bohemian, Casual).",
        keywords: ["style", "style tags", "tags"],
        copyable: true,
      },
      {
        id: "fabric",
        label: "Fabric / material",
        input: "text",
        required: false,
        source: "structured:fabric",
        hint: "Paste into description — Poshmark has no separate fabric field.",
        keywords: ["fabric", "material"],
        copyable: true,
      },
      {
        id: "measurements",
        label: "Measurements",
        input: "text",
        required: false,
        source: "structured:measurements",
        hint: "Flat measurements — include in description.",
        keywords: ["measurement", "measurements"],
        copyable: true,
      },
      {
        id: "smokePetNotes",
        label: "Smoke / pet notes",
        input: "text",
        required: false,
        source: "structured:smokePetNotes",
        hint: "Include in the description.",
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
        hint: "Last step — rewrite with AI after the fields above are correct. Include measurements, fabric, condition, and smoke/pet notes.",
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
