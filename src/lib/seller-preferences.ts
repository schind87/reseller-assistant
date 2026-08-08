import { z } from "zod";

export const listingPreferencesSchema = z.object({
  smokeFree: z.enum(["yes", "no", "outdoor_only"]),
  pets: z.enum(["none", "dogs", "cats", "dogs_and_cats", "other"]),
  petDetails: z.string().max(120).nullable().optional(),
  audience: z.enum(["womens", "mens", "kids", "mixed"]),
  closetName: z.string().max(80).nullable().optional(),
  shipsFrom: z.string().max(80).nullable().optional(),
  shipsQuickly: z.boolean(),
  acceptsOffers: z.boolean(),
  extraBuyerNotes: z.string().max(400).nullable().optional(),
});

export type ListingPreferences = z.infer<typeof listingPreferencesSchema>;

export const defaultListingPreferences = (): ListingPreferences => ({
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
  const parsed = listingPreferencesSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return defaultListingPreferences();
}

export function isListingPreferencesComplete(raw: unknown): boolean {
  return listingPreferencesSchema.safeParse(raw).success;
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

/** Extra context injected into AI draft prompts. */
export function composeSellerContext(prefs: ListingPreferences): string {
  const lines: string[] = [
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
