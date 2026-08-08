import { generateObject } from "ai";
import { z } from "zod";
import {
  getAiModel,
  hasAiProvider,
  missingAiProviderMessage,
} from "@/lib/ai/provider";
import {
  emptyIdentifiedAttrs,
  type IdentifiedAttrs,
} from "@/lib/types";

const identifySchema = z.object({
  brand: z.string().nullable(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  category: z.string().nullable(),
  material: z.string().nullable(),
  condition: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
  needsConfirm: z.array(z.string()),
});

export async function identifyFromPhotos(
  imageUrls: string[]
): Promise<IdentifiedAttrs> {
  if (!hasAiProvider()) {
    return emptyIdentifiedAttrs(
      `${missingAiProviderMessage()} Please fill in brand, size, and other details yourself.`
    );
  }

  if (imageUrls.length === 0) {
    return emptyIdentifiedAttrs(
      "No photos available yet. Add tag or garment photos to identify this piece."
    );
  }

  try {
    const { object } = await generateObject({
      model: getAiModel("identify"),
      schema: identifySchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are helping a clothing reseller identify apparel from photos of garment tags and the piece itself.
Scope: clothing and wearable fashion only (tops, bottoms, dresses, outerwear, shoes, bags, accessories).
You may receive several tag photos — brand, care, size, style/SKU numbers, and other labels. Read all of them.
Prefer brand and care tags when present. Do not invent a brand or size if you cannot read them.
Category should be a clothing type (e.g. blouse, jeans, sneakers), not a generic "item".
Return structured attributes and a confidence from 0 to 1.
List any fields the seller should double-check in needsConfirm.
Be concise in notes.`,
            },
            ...imageUrls.slice(0, 6).map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
    });

    return {
      brand: object.brand,
      size: object.size,
      color: object.color,
      category: object.category,
      material: object.material,
      condition: object.condition,
      confidence: object.confidence,
      notes: object.notes,
      needsConfirm: object.needsConfirm,
    };
  } catch (err) {
    console.error("identifyFromPhotos failed:", err);
    return emptyIdentifiedAttrs(
      "AI identification failed. Please enter brand, size, and details manually."
    );
  }
}
