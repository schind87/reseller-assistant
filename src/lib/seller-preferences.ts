import { z } from "zod";
import { PLATFORM_LABELS } from "@/lib/platforms";
import type { Platform } from "@/lib/types";

export const sellingWebsiteSchema = z.enum(["mercari", "poshmark"]);

export const SUPPORTED_SELLING_WEBSITES = [
  "mercari",
  "poshmark",
] as const satisfies readonly Platform[];

export const listingPreferencesSchema = z
  .object({
    /** Default site for new listings. */
    sellingWebsite: sellingWebsiteSchema,
    /** Marketplaces this seller uses. */
    sellingWebsites: z.array(sellingWebsiteSchema).min(1).max(2),
    smokeFree: z.enum(["yes", "no", "outdoor_only"]),
    pets: z.enum(["none", "dogs", "cats", "dogs_and_cats", "other"]),
    petDetails: z.string().max(120).nullable().optional(),
    audience: z.enum(["womens", "mens", "kids", "mixed"]),
    closetName: z.string().max(80).nullable().optional(),
    shipsFrom: z.string().max(80).nullable().optional(),
    shipsQuickly: z.boolean(),
    acceptsOffers: z.boolean(),
    extraBuyerNotes: z.string().max(400).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sellingWebsites.includes(data.sellingWebsite)) {
      ctx.addIssue({
        code: "custom",
        path: ["sellingWebsite"],
        message: "Default store must be one of the stores you sell on",
      });
    }
  });

export type ListingPreferences = z.infer<typeof listingPreferencesSchema>;

export const defaultListingPreferences = (): ListingPreferences => ({
  sellingWebsite: "mercari",
  sellingWebsites: ["mercari"],
  smokeFree: "yes",
  pets: "none",
  petDetails: null,
  audience: "mixed",
  closetName: null,
  shipsFrom: null,
  shipsQuickly: true,
  acceptsOffers: true,
  extraBuyerNotes: null,
});

export function parseListingPreferences(raw: unknown): ListingPreferences {
  const base = defaultListingPreferences();
  const merged =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...base, ...(raw as Record<string, unknown>) }
      : base;

  // Backfill sellingWebsites from older profiles that only had sellingWebsite.
  if (
    (!Array.isArray(merged.sellingWebsites) ||
      merged.sellingWebsites.length === 0) &&
    typeof merged.sellingWebsite === "string"
  ) {
    merged.sellingWebsites = [merged.sellingWebsite];
  }

  if (
    Array.isArray(merged.sellingWebsites) &&
    merged.sellingWebsites.length > 0 &&
    (typeof merged.sellingWebsite !== "string" ||
      !merged.sellingWebsites.includes(merged.sellingWebsite))
  ) {
    merged.sellingWebsite = merged.sellingWebsites[0];
  }

  const parsed = listingPreferencesSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  return base;
}

export function isListingPreferencesComplete(raw: unknown): boolean {
  return listingPreferencesSchema.safeParse(
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? parseListingPreferences(raw)
      : raw
  ).success;
}

/** Short smoke/pet sentence for listing structured fields. */
export function composeSmokePetNotes(prefs: ListingPreferences): string {
  const smoke =
    prefs.smokeFree === "yes"
      ? "From a smoke-free home"
      : prefs.smokeFree === "outdoor_only"
        ? "From a home where smoking is outdoors only"
        : "Please note this home is not smoke-free";

  let pets: string;
  switch (prefs.pets) {
    case "none":
      pets = "No pets in the home";
      break;
    case "dogs":
      pets = "Dog-friendly home — please ask if you have pet allergies";
      break;
    case "cats":
      pets = "Cat-friendly home — please ask if you have pet allergies";
      break;
    case "dogs_and_cats":
      pets = "Dogs and cats in the home — please ask if you have pet allergies";
      break;
    case "other":
      pets = prefs.petDetails?.trim()
        ? `Pets in the home (${prefs.petDetails.trim()}) — please ask if you have allergies`
        : "Pets in the home — please ask if you have allergies";
      break;
    default: {
      const _exhaustive: never = prefs.pets;
      return _exhaustive;
    }
  }

  return `${smoke}. ${pets}.`;
}

export function sellingWebsiteLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}

/** Extra context injected into AI draft prompts. */
export function composeSellerContext(prefs: ListingPreferences): string {
  const stores = prefs.sellingWebsites
    .map((site) => sellingWebsiteLabel(site))
    .join(", ");
  const lines: string[] = [
    `Sells on: ${stores}`,
    `Primary / default selling website: ${sellingWebsiteLabel(prefs.sellingWebsite)}`,
    `Home notes: ${composeSmokePetNotes(prefs)}`,
    `Primary clothing focus: ${
      prefs.audience === "womens"
        ? "women's"
        : prefs.audience === "mens"
          ? "men's"
          : prefs.audience === "kids"
            ? "kids'"
            : "mixed / unisex and family"
    } apparel`,
  ];

  if (prefs.closetName?.trim()) {
    lines.push(`Seller / closet name: ${prefs.closetName.trim()}`);
  }
  if (prefs.shipsFrom?.trim()) {
    lines.push(`Ships from: ${prefs.shipsFrom.trim()}`);
  }
  lines.push(
    prefs.shipsQuickly
      ? "Usually ships quickly (same or next business day when possible)."
      : "Shipping timing may vary — do not promise same-day ship."
  );
  lines.push(
    prefs.acceptsOffers
      ? "Open to reasonable offers when it fits the platform."
      : "Prefers listed price; do not push offers hard."
  );
  if (prefs.extraBuyerNotes?.trim()) {
    lines.push(`Other buyer notes: ${prefs.extraBuyerNotes.trim()}`);
  }

  return lines.join("\n");
}
