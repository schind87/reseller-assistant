export type Platform = "mercari" | "poshmark";

export type ListingStatus =
  | "drafting_photos"
  | "processing"
  | "ready"
  | "posting"
  | "posted";

export type PhotoRole =
  | "brand_tag"
  | "care_tag"
  | "id_tag"
  | "inventory"
  | "cover"
  | "front"
  | "back"
  | "detail"
  | "tag"
  | "flaw";

/** Photos for AI/ID or stocking — private by default (not auto-posted). */
export const NON_POSTING_PHOTO_ROLES: readonly PhotoRole[] = [
  "brand_tag",
  "care_tag",
  "id_tag",
  "inventory",
] as const;

export const IDENTIFY_PHOTO_ROLES: readonly PhotoRole[] = [
  "brand_tag",
  "care_tag",
  "id_tag",
] as const;

export function isIdentifyPhotoRole(role: PhotoRole): boolean {
  return (IDENTIFY_PHOTO_ROLES as readonly string[]).includes(role);
}

export function isNonPostingPhotoRole(role: PhotoRole): boolean {
  return (NON_POSTING_PHOTO_ROLES as readonly string[]).includes(role);
}

export function isPostingPhotoRole(role: PhotoRole): boolean {
  return !isNonPostingPhotoRole(role);
}

export type IdentifiedAttrs = {
  brand: string | null;
  size: string | null;
  color: string | null;
  category: string | null;
  material: string | null;
  condition: string | null;
  confidence: number;
  notes: string;
  needsConfirm: string[];
};

export type StructuredFields = {
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  color: string | null;
  colorSecondary: string | null;
  condition: string | null;
  originalPrice: number | null;
  styleTags: string[];
  measurements: string | null;
  fabric: string | null;
  smokePetNotes: string | null;
  packageWeight: string | null;
  shippingPayer: string | null;
};

export type Listing = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  platform: Platform;
  status: ListingStatus;
  join_code: string;
  photo_step: number;
  title: string | null;
  description: string | null;
  price: number | null;
  structured_fields: StructuredFields;
  identified_attrs: IdentifiedAttrs | null;
  cover_processed_path: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
};

export type ListingPhoto = {
  id: string;
  listing_id: string;
  role: PhotoRole;
  storage_path: string;
  processed_path: string | null;
  /** When true, Write listing with AI / clean-bg action replaces the backdrop. */
  replace_background: boolean;
  sort_order: number;
  created_at: string;
};

export type ListingPhotoWithUrl = ListingPhoto & {
  signedUrl: string | null;
  processedSignedUrl: string | null;
  /** Grid/list display; falls back to signedUrl when omitted. */
  signedThumbUrl?: string | null;
  processedSignedThumbUrl?: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  default_smoke_pet_notes: string | null;
  created_at: string;
};

export type JoinTokenPurpose = "phone" | "extension";

export type ListingJoinToken = {
  id: string;
  listing_id: string;
  token: string;
  purpose: JoinTokenPurpose;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export function emptyIdentifiedAttrs(
  notes = "AI identification unavailable."
): IdentifiedAttrs {
  return {
    brand: null,
    size: null,
    color: null,
    category: null,
    material: null,
    condition: null,
    confidence: 0,
    notes,
    needsConfirm: ["brand", "size", "color", "category", "condition"],
  };
}

export function emptyStructuredFields(): StructuredFields {
  return {
    brand: null,
    category: null,
    subcategory: null,
    size: null,
    color: null,
    colorSecondary: null,
    condition: null,
    originalPrice: null,
    styleTags: [],
    measurements: null,
    fabric: null,
    smokePetNotes: null,
    packageWeight: null,
    shippingPayer: null,
  };
}
