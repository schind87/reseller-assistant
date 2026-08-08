import { z } from "zod";
import {
  getSeedListingSchema,
  type ListingFieldDef,
  type PlatformListingSchema,
} from "@/lib/listing-schemas";
import {
  getStoredListingSchema,
  upsertListingSchema,
} from "@/lib/supabase/queries";
import type { Platform } from "@/lib/types";

const discoveredFieldSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  input: z.enum(["text", "textarea", "number", "select", "tags"]),
  required: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  maxLength: z.number().int().positive().optional(),
  hint: z.string().optional(),
});

export const discoverSchemaBody = z.object({
  platform: z.enum(["mercari", "poshmark"]),
  sellPageUrl: z.string().url().optional(),
  fields: z.array(discoveredFieldSchema).min(1),
});

export async function resolveListingSchema(
  platform: Platform
): Promise<PlatformListingSchema> {
  const stored = await getStoredListingSchema(platform).catch(() => null);
  if (stored && Array.isArray(stored.fields) && stored.fields.length > 0) {
    return stored;
  }
  return getSeedListingSchema(platform);
}

function slugifyFieldId(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || `field_${index + 1}`;
}

function guessSource(id: string, label: string): ListingFieldDef["source"] {
  const hay = `${id} ${label}`.toLowerCase();
  if (/\btitle\b/.test(hay)) return "title";
  if (/\bdescription\b|\bdetails\b/.test(hay)) return "description";
  if (/\b(listing )?price\b|\basking\b/.test(hay) && !/original|retail/.test(hay)) {
    return "price";
  }
  if (/original|retail/.test(hay)) return "structured:originalPrice";
  if (/\bbrand\b/.test(hay)) return "structured:brand";
  if (/subcategory|sub category/.test(hay)) return "structured:subcategory";
  if (/\bcategory\b/.test(hay)) return "structured:category";
  if (/\bsize\b/.test(hay)) return "structured:size";
  if (/secondary.*color|color.*2/.test(hay)) return "structured:colorSecondary";
  if (/\bcolou?r\b/.test(hay)) return "structured:color";
  if (/\bcondition\b/.test(hay)) return "structured:condition";
  if (/style.?tag|tags/.test(hay)) return "structured:styleTags";
  if (/weight/.test(hay)) return "structured:packageWeight";
  if (/shipping|who pays/.test(hay)) return "structured:shippingPayer";
  if (/fabric|material/.test(hay)) return "structured:fabric";
  if (/measure/.test(hay)) return "structured:measurements";
  return `structured:${slugifyFieldId(label, 0)}`;
}

function guessInput(
  input: ListingFieldDef["input"] | undefined,
  label: string
): ListingFieldDef["input"] {
  if (input) return input;
  const hay = label.toLowerCase();
  if (/description|details|notes/.test(hay)) return "textarea";
  if (/price|weight/.test(hay)) return "number";
  if (/condition|who pays|shipping payer/.test(hay)) return "select";
  if (/style.?tag|tags/.test(hay)) return "tags";
  return "text";
}

/** Merge extension discoveries onto the seed schema so core fields stay stable. */
export function mergeDiscoveredSchema(params: {
  platform: Platform;
  sellPageUrl?: string;
  discovered: z.infer<typeof discoveredFieldSchema>[];
}): PlatformListingSchema {
  const seed = getSeedListingSchema(params.platform);
  const byId = new Map(seed.fields.map((f) => [f.id, { ...f }]));

  params.discovered.forEach((raw, index) => {
    const id = raw.id || slugifyFieldId(raw.label, index);
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, {
        ...existing,
        label: raw.label || existing.label,
        input: guessInput(raw.input, raw.label),
        required: raw.required ?? existing.required,
        options: raw.options?.length ? raw.options : existing.options,
        maxLength: raw.maxLength ?? existing.maxLength,
        hint: raw.hint ?? existing.hint,
        keywords: Array.from(
          new Set([...(existing.keywords ?? []), ...(raw.keywords ?? []), raw.label])
        ),
      });
      return;
    }

    // Try match by label against seed fields
    const labelNorm = raw.label.toLowerCase().trim();
    const seedMatch = seed.fields.find(
      (f) => f.label.toLowerCase() === labelNorm || f.keywords.some((k) => labelNorm.includes(k))
    );
    if (seedMatch) {
      byId.set(seedMatch.id, {
        ...seedMatch,
        label: raw.label,
        input: guessInput(raw.input, raw.label),
        options: raw.options?.length ? raw.options : seedMatch.options,
        keywords: Array.from(
          new Set([
            ...seedMatch.keywords,
            ...(raw.keywords ?? []),
            raw.label.toLowerCase(),
          ])
        ),
      });
      return;
    }

    byId.set(id, {
      id,
      label: raw.label,
      input: guessInput(raw.input, raw.label),
      required: raw.required ?? false,
      source: guessSource(id, raw.label),
      maxLength: raw.maxLength,
      hint: raw.hint ?? "Discovered from the live sell page.",
      options: raw.options,
      keywords: Array.from(
        new Set([...(raw.keywords ?? []), raw.label.toLowerCase()])
      ),
      copyable: true,
    });
  });

  // Preserve seed order, then append new fields
  const ordered: ListingFieldDef[] = [];
  const seen = new Set<string>();
  for (const field of seed.fields) {
    const next = byId.get(field.id);
    if (next) {
      ordered.push(next);
      seen.add(field.id);
    }
  }
  for (const [id, field] of byId) {
    if (!seen.has(id)) ordered.push(field);
  }

  return {
    platform: params.platform,
    version: seed.version + 1,
    sellPageUrl: params.sellPageUrl || seed.sellPageUrl,
    source: "extension",
    syncedAt: new Date().toISOString(),
    fields: ordered,
  };
}

export async function saveDiscoveredSchema(params: {
  platform: Platform;
  sellPageUrl?: string;
  discovered: z.infer<typeof discoveredFieldSchema>[];
}): Promise<PlatformListingSchema> {
  const merged = mergeDiscoveredSchema(params);
  return upsertListingSchema(merged);
}
