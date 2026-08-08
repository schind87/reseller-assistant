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
  | "cover"
  | "front"
  | "back"
  | "detail"
  | "flaw";

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
  size: string | null;
  color: string | null;
  condition: string | null;
  originalPrice: number | null;
  styleTags: string[];
  measurements: string | null;
  fabric: string | null;
  smokePetNotes: string | null;
};

export type Listing = {
  id: string;
  workspace_id: string;
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
  sort_order: number;
  created_at: string;
};

export type ListingPhotoWithUrl = ListingPhoto & {
  signedUrl: string | null;
  processedSignedUrl: string | null;
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
    size: null,
    color: null,
    condition: null,
    originalPrice: null,
    styleTags: [],
    measurements: null,
    fabric: null,
    smokePetNotes: null,
  };
}
