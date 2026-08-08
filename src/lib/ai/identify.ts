import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
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
  if (!process.env.OPENAI_API_KEY) {
    return emptyIdentifiedAttrs(
      "AI identification skipped — OPENAI_API_KEY is not set. Please fill in brand, size, and other details yourself."
    );
  }

  if (imageUrls.length === 0) {
    return emptyIdentifiedAttrs(
      "No photos available yet. Add tag or item photos to identify this piece."
    );
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: identifySchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are helping a clothing reseller identify a garment from photos.
Prefer brand and care tags when present. Do not invent a brand or size if you cannot read them.
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
