import { generateObject } from "ai";
import { z } from "zod";
import {
  getAiModel,
  hasAiProvider,
  missingAiProviderMessage,
} from "@/lib/ai/provider";
import { FIELD_LIMITS, PLATFORM_LABELS } from "@/lib/platforms";
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
    structured_fields: fields,
    degraded: true,
    message: hasAiProvider()
      ? "Draft generation failed — using a simple template. Edit before posting."
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
      : `Poshmark: brand-first title (max ${limits.titleMax}). Description should include flat measurements, condition, and style tags. Include original price if known.`;

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

    return {
      title,
      description,
      price: object.price,
      structured_fields: {
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
      },
      degraded: false,
    };
  } catch (err) {
    console.error("draftListing failed:", err);
    return fallbackDraft(platform, identified, smokePetNotes);
  }
}
