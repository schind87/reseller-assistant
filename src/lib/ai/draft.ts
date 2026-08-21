import { generateObject } from "ai";
import { z } from "zod";
import {
  getAiModel,
  hasAiProvider,
  missingAiProviderMessage,
} from "@/lib/ai/provider";
import { FIELD_LIMITS, PLATFORM_LABELS } from "@/lib/platforms";
import { normalizePoshmarkStructuredFields } from "@/lib/poshmark-formats";
import {
  emptyStructuredFields,
  type IdentifiedAttrs,
  type Platform,
  type StructuredFields,
} from "@/lib/types";

const draftSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  structured_fields: z.object({
    brand: z.string().nullable(),
    category: z.string().nullable(),
    subcategory: z.string().nullable(),
    size: z.string().nullable(),
    color: z.string().nullable(),
    colorSecondary: z.string().nullable(),
    condition: z.string().nullable(),
    originalPrice: z.number().nullable(),
    styleTags: z.array(z.string()),
    measurements: z.string().nullable(),
    fabric: z.string().nullable(),
    smokePetNotes: z.string().nullable(),
    packageWeight: z.string().nullable(),
    shippingPayer: z.string().nullable(),
  }),
});

export type DraftResult = {
  title: string;
  description: string;
  price: number | null;
  structured_fields: StructuredFields;
  degraded: boolean;
  message?: string;
};

function fallbackDraft(
  platform: Platform,
  identified: IdentifiedAttrs | null,
  smokePetNotes?: string | null
): DraftResult {
  const brand = identified?.brand ?? "Brand";
  const category = identified?.category ?? "clothing";
  const size = identified?.size ? ` Size ${identified.size}` : "";
  const color = identified?.color ? ` ${identified.color}` : "";
  const limits = FIELD_LIMITS[platform];
  let title = `${brand}${color} ${category}${size}`.replace(/\s+/g, " ").trim();
  if (title.length > limits.titleMax) {
    title = title.slice(0, limits.titleMax - 1).trimEnd() + "…";
  }

  const fields = emptyStructuredFields();
  fields.brand = identified?.brand ?? null;
  fields.category = identified?.category ?? null;
  fields.size = identified?.size ?? null;
  fields.color = identified?.color ?? null;
  fields.condition = identified?.condition ?? null;
  fields.fabric = identified?.material ?? null;
  fields.smokePetNotes =
    smokePetNotes ??
    "From a smoke-free home. Please ask if you have pet allergies.";

  const description = [
    `Selling this ${category.toLowerCase()} garment.`,
    identified?.notes ? identified.notes : "",
    fields.smokePetNotes,
    "Please review all clothing details before listing.",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, limits.descriptionMax);

  return {
    title,
    description,
    price: null,
    structured_fields:
      platform === "poshmark"
        ? normalizePoshmarkStructuredFields(fields)
        : fields,
    degraded: true,
    message: hasAiProvider()
      ? "Couldn’t fill fields — used a simple template. Edit before posting."
      : `${missingAiProviderMessage()} Edit the template before posting.`,
  };
}

export async function draftListing(params: {
  platform: Platform;
  identified: IdentifiedAttrs | null;
  imageUrls?: string[];
  smokePetNotes?: string | null;
  sellerContext?: string | null;
}): Promise<DraftResult> {
  const {
    platform,
    identified,
    imageUrls = [],
    smokePetNotes,
    sellerContext,
  } = params;
  const limits = FIELD_LIMITS[platform];

  if (!hasAiProvider()) {
    return fallbackDraft(platform, identified, smokePetNotes);
  }

  const platformTips =
    platform === "mercari"
      ? `Mercari: title max ${limits.titleMax} chars — front-load brand, type, size, color, condition. Description should include measurements, fabric, flaws, and smoke/pet notes.`
      : `Poshmark: brand-first title (max ${limits.titleMax}).
Condition MUST be exactly one of: "New With Tags", "Like New", "Good", "Fair".
  (Use "Like New" for NWOT / never worn without tags / excellent used.)
Primary/secondary color MUST be from: Red, Pink, Orange, Yellow, Green, Blue, Purple, Gold, Silver, Black, Gray, White, Cream, Brown, Tan.
Style tags: at most 3, chosen from Poshmark’s official style-tag list (examples: Casual, Bohemian, Vintage, Athleisure, Preppy, Streetwear, Y2K, Cottagecore, Business Casual, Athletic). Use exact canonical names.
Original price is required on Poshmark when known — estimate retail if needed.
Description should include flat measurements, fabric, and smoke/pet notes.`;

  try {
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    > = [
      {
        type: "text",
        text: `Write a high-quality ${PLATFORM_LABELS[platform]} clothing listing draft.
This app lists apparel only (tops, bottoms, dresses, outerwear, shoes, bags, accessories).
Use clothing categories and garment language — not generic merchandise wording.

${platformTips}

Seller / household preferences (honor these in description and tone):
${sellerContext ?? "None provided."}

Known attributes (may be incomplete — do not invent brand/size when confidence is low):
${JSON.stringify(identified ?? {}, null, 2)}

Default smoke/pet note to use if none better is known: ${
          smokePetNotes ??
          "From a smoke-free home. Please ask if you have pet allergies."
        }
Put that smoke/pet note into structured_fields.smokePetNotes and weave it naturally into the description.

Return title, description, suggested price (null if unsure), and structured_fields.
Prefer flat measurements (bust/chest, waist, length, inseam) when relevant.
Keep title within ${limits.titleMax} characters and description within ${limits.descriptionMax}.`,
      },
      ...imageUrls.slice(0, 4).map((url) => ({
        type: "image" as const,
        image: new URL(url),
      })),
    ];

    const { object } = await generateObject({
      model: getAiModel("draft"),
      schema: draftSchema,
      messages: [{ role: "user", content }],
    });

    let title = object.title.trim();
    if (title.length > limits.titleMax) {
      title = title.slice(0, limits.titleMax - 1).trimEnd() + "…";
    }

    let description = object.description.trim();
    if (description.length > limits.descriptionMax) {
      description = description.slice(0, limits.descriptionMax - 1).trimEnd() + "…";
    }

    const structured =
      platform === "poshmark"
        ? normalizePoshmarkStructuredFields({
            brand: object.structured_fields.brand,
            category: object.structured_fields.category,
            subcategory: object.structured_fields.subcategory,
            size: object.structured_fields.size,
            color: object.structured_fields.color,
            colorSecondary: object.structured_fields.colorSecondary,
            condition: object.structured_fields.condition,
            originalPrice: object.structured_fields.originalPrice,
            styleTags: object.structured_fields.styleTags ?? [],
            measurements: object.structured_fields.measurements,
            fabric: object.structured_fields.fabric,
            smokePetNotes:
              object.structured_fields.smokePetNotes ?? smokePetNotes ?? null,
            packageWeight: object.structured_fields.packageWeight,
            shippingPayer: object.structured_fields.shippingPayer,
          })
        : {
            brand: object.structured_fields.brand,
            category: object.structured_fields.category,
            subcategory: object.structured_fields.subcategory,
            size: object.structured_fields.size,
            color: object.structured_fields.color,
            colorSecondary: object.structured_fields.colorSecondary,
            condition: object.structured_fields.condition,
            originalPrice: object.structured_fields.originalPrice,
            styleTags: object.structured_fields.styleTags ?? [],
            measurements: object.structured_fields.measurements,
            fabric: object.structured_fields.fabric,
            smokePetNotes:
              object.structured_fields.smokePetNotes ?? smokePetNotes ?? null,
            packageWeight: object.structured_fields.packageWeight,
            shippingPayer: object.structured_fields.shippingPayer,
          };

    return {
      title,
      description,
      price: object.price,
      structured_fields: structured,
      degraded: false,
    };
  } catch (err) {
    console.error("draftListing failed:", err);
    return fallbackDraft(platform, identified, smokePetNotes);
  }
}

const rewriteDescriptionSchema = z.object({
  description: z.string(),
});

function formatFieldValue(value: unknown): string {
  if (value == null) return "(empty)";
  if (Array.isArray(value)) {
    return value.length === 0 ? "(empty)" : value.join(", ");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? "(empty)" : trimmed;
  }
  return String(value);
}

/** Human-readable deltas between two structured-field snapshots. */
export function summarizeStructuredFieldChanges(
  previous: StructuredFields | null | undefined,
  next: StructuredFields
): string[] {
  if (!previous) return [];
  const keys = Object.keys(next) as (keyof StructuredFields)[];
  const changes: string[] = [];
  for (const key of keys) {
    const before = previous[key];
    const after = next[key];
    const beforeText = formatFieldValue(before);
    const afterText = formatFieldValue(after);
    if (beforeText === afterText) continue;
    changes.push(`${String(key)}: ${beforeText} → ${afterText}`);
  }
  return changes;
}

export function buildRewriteDescriptionPrompt(params: {
  platform: Platform;
  title: string;
  price: number | null;
  fields: StructuredFields;
  currentDescription: string;
  previousFields?: StructuredFields | null;
  sellerContext?: string | null;
  descriptionMax: number;
}): string {
  const {
    platform,
    title,
    price,
    fields,
    currentDescription,
    previousFields,
    sellerContext,
    descriptionMax,
  } = params;
  const platformLabel = PLATFORM_LABELS[platform];
  const sharedFacts = `Seller preferences:
${sellerContext ?? "None provided."}

Title: ${title || "(none)"}
Price: ${price == null ? "(none)" : price}
Structured fields (authoritative facts — do not invent missing brand, size, measurements, or flaws):
${JSON.stringify(fields, null, 2)}`;

  if (!currentDescription) {
    return `Write a new ${platformLabel} listing description from the listing fields below.
Use ONLY the provided facts. Keep it buyer-friendly, clothing-focused, and within ${descriptionMax} characters.
Honor seller preferences in tone and required disclosures (including smoke/pet notes from the fields).

${sharedFacts}

Return only the description text.`;
  }

  const fieldChanges = summarizeStructuredFieldChanges(previousFields, fields);
  const changeSection =
    fieldChanges.length > 0
      ? `Known field changes since the description was last written with AI (prefer updating only these):
${fieldChanges.map((line) => `- ${line}`).join("\n")}`
      : `No structured-field snapshot of the last AI write is available. Still only patch facts in the description that conflict with the authoritative fields above, or add clearly missing required disclosures from those fields.`;

  return `Revise the EXISTING ${platformLabel} listing description in place. Do NOT rewrite it from scratch.
The description below is the seller's current draft — it may include their own edits. Preserve their wording, structure, paragraph breaks, tone, and custom phrasing wherever possible.
Only update sentences/phrases whose facts conflict with the authoritative title/price/structured fields, or insert missing required facts from those fields (e.g. smoke/pet notes) when they are truly absent.
Do not restyle, reorder, expand, or "improve" prose that is already accurate.
Use ONLY provided facts. Keep the result within ${descriptionMax} characters.
Honor seller preferences for tone and required disclosures.

${sharedFacts}

${changeSection}

Current description (base text — iterate on this; preserve user edits):
${currentDescription}

Return only the revised description text.`;
}

export async function rewriteListingDescription(params: {
  platform: Platform;
  title: string;
  price: number | null;
  fields: StructuredFields;
  currentDescription?: string | null;
  /** Structured fields from when the description was last AI-written, if known. */
  previousFields?: StructuredFields | null;
  sellerContext?: string | null;
}): Promise<{ description: string; degraded: boolean; message?: string }> {
  const {
    platform,
    title,
    price,
    fields,
    currentDescription,
    previousFields,
    sellerContext,
  } = params;
  const limits = FIELD_LIMITS[platform];
  const trimmedCurrent = currentDescription?.trim() ?? "";

  const fallback = () => {
    // When iterating, keep the seller's draft if AI is unavailable rather than
    // replacing it with a template — only fall back when there is nothing to keep.
    if (trimmedCurrent) {
      return {
        description: trimmedCurrent.slice(0, limits.descriptionMax),
        degraded: true as const,
        message: hasAiProvider()
          ? "Couldn’t update with AI — left your draft unchanged."
          : `${missingAiProviderMessage()} Left your current draft unchanged.`,
      };
    }
    const parts = [
      title ? `Selling: ${title}.` : null,
      fields.brand ? `Brand: ${fields.brand}.` : null,
      fields.size ? `Size: ${fields.size}.` : null,
      fields.color ? `Color: ${fields.color}.` : null,
      fields.condition ? `Condition: ${fields.condition}.` : null,
      fields.fabric ? `Fabric: ${fields.fabric}.` : null,
      fields.measurements ? `Measurements: ${fields.measurements}.` : null,
      fields.smokePetNotes,
      "Please review all details before listing.",
    ].filter(Boolean);
    return {
      description: parts.join("\n\n").slice(0, limits.descriptionMax),
      degraded: true as const,
      message: hasAiProvider()
        ? "Couldn’t write a description — filled a simple template from your fields."
        : `${missingAiProviderMessage()} Filled a simple template from your fields.`,
    };
  };

  if (!hasAiProvider()) {
    return fallback();
  }

  try {
    const { object } = await generateObject({
      model: getAiModel("draft"),
      schema: rewriteDescriptionSchema,
      messages: [
        {
          role: "user",
          content: buildRewriteDescriptionPrompt({
            platform,
            title,
            price,
            fields,
            currentDescription: trimmedCurrent,
            previousFields,
            sellerContext,
            descriptionMax: limits.descriptionMax,
          }),
        },
      ],
    });

    let description = object.description.trim();
    if (description.length > limits.descriptionMax) {
      description =
        description.slice(0, limits.descriptionMax - 1).trimEnd() + "…";
    }

    return { description, degraded: false };
  } catch (err) {
    console.error("rewriteListingDescription failed:", err);
    return fallback();
  }
}
