import type { PhotoRole, Platform } from "@/lib/types";

export type PhotoStepPurpose = "identify" | "inventory" | "listing";

export type PhotoStepDef = {
  role: PhotoRole;
  title: string;
  instruction: string;
  optional: boolean;
  purpose: PhotoStepPurpose;
  /** Keep the coach on this step so the seller can add more shots. */
  allowMultiple: boolean;
};

export type FieldLimits = {
  titleMax: number;
  descriptionMax: number;
  maxPhotos: number;
};

/** Ideal capture frame shown in the in-app camera for listing photos. */
export type PhotoAspectGuide = {
  width: number;
  height: number;
  label: string;
};

export const PLATFORM_PHOTO_ASPECT: Record<Platform, PhotoAspectGuide> = {
  mercari: { width: 1, height: 1, label: "1:1 square" },
  // Poshmark listing photos work best as 4×3 portrait (3 wide × 4 tall).
  poshmark: { width: 3, height: 4, label: "4×3 portrait" },
};

const SHARED_PHOTO_STEPS: PhotoStepDef[] = [
  {
    role: "id_tag",
    title: "Identification tags",
    instruction:
      "Photo every tag on the garment — brand, size, care, style or SKU numbers, and any other labels. Take as many as you need. These are for identification by default; you can also add any of them to the listing later.",
    optional: true,
    purpose: "identify",
    allowMultiple: true,
  },
  {
    role: "inventory",
    title: "Stocking photo",
    instruction:
      "Optional: photo how this piece looks where you stock it (closet, bin, rack) so you can find it later. Add as many angles as help you find it. Private by default — you can also use any shot in the listing if you want.",
    optional: true,
    purpose: "inventory",
    allowMultiple: true,
  },
  {
    role: "cover",
    title: "Cover photo",
    instruction:
      "Full garment, front-facing, well lit. This is the main photo shoppers see first. You can add more than one cover-style shot if you want options.",
    optional: false,
    purpose: "listing",
    allowMultiple: true,
  },
  {
    role: "front",
    title: "Front",
    instruction:
      "Clear front view of the whole garment on a simple background. Add as many front angles as you need.",
    optional: false,
    purpose: "listing",
    allowMultiple: true,
  },
  {
    role: "back",
    title: "Back",
    instruction:
      "Show the back of the garment so shoppers see the full piece. Add more back shots if helpful.",
    optional: false,
    purpose: "listing",
    allowMultiple: true,
  },
  {
    role: "detail",
    title: "Details",
    instruction:
      "Close-ups of fabric texture, buttons, zippers, embroidery, or style features. Take as many detail shots as you need.",
    optional: false,
    purpose: "listing",
    allowMultiple: true,
  },
  {
    role: "flaw",
    title: "Flaws",
    instruction:
      "Photo any stains, holes, pilling, or wear. Take one shot per issue, or skip if the piece is clean.",
    optional: true,
    purpose: "listing",
    allowMultiple: true,
  },
];

const MERCARI_PHOTO_STEPS: PhotoStepDef[] = SHARED_PHOTO_STEPS.map((step) => {
  if (step.role === "cover") {
    return {
      ...step,
      instruction:
        "Main listing photo — full garment, bright light, fill the square frame. Mercari allows up to 12 photos total; you can add more than one cover-style shot.",
    };
  }
  return step;
});

const POSHMARK_PHOTO_STEPS: PhotoStepDef[] = SHARED_PHOTO_STEPS.map((step) => {
  if (step.role === "cover") {
    return {
      ...step,
      title: "Cover shot",
      instruction:
        "Poshmark shoppers judge the cover first. Flat lay or on a hanger, fill the 4×3 portrait frame, bright and uncluttered. Add more cover-style shots if you want options.",
    };
  }
  if (step.purpose === "listing") {
    return {
      ...step,
      instruction: `${step.instruction} Use a 4×3 portrait frame for Poshmark.`,
    };
  }
  return step;
});

export const PHOTO_STEPS: Record<Platform, PhotoStepDef[]> = {
  mercari: MERCARI_PHOTO_STEPS,
  poshmark: POSHMARK_PHOTO_STEPS,
};

export const FIELD_LIMITS: Record<Platform, FieldLimits> = {
  mercari: {
    titleMax: 80,
    descriptionMax: 1000,
    maxPhotos: 12,
  },
  poshmark: {
    titleMax: 80,
    descriptionMax: 5000,
    maxPhotos: 16,
  },
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  mercari: "Mercari",
  poshmark: "Poshmark",
};

export const SELL_PAGE_URLS: Record<Platform, string> = {
  mercari: "https://www.mercari.com/sell/",
  poshmark: "https://poshmark.com/create-listing",
};

export function getPhotoSteps(platform: Platform): PhotoStepDef[] {
  return PHOTO_STEPS[platform];
}

export function getRequiredPhotoRoles(platform: Platform): PhotoRole[] {
  return PHOTO_STEPS[platform].filter((s) => !s.optional).map((s) => s.role);
}

export function photoRoleLabel(role: PhotoRole): string {
  switch (role) {
    case "brand_tag":
    case "care_tag":
    case "id_tag":
      return "Brand/care tag";
    case "inventory":
      return "Stocking";
    case "cover":
      return "Cover";
    case "front":
      return "Front";
    case "back":
      return "Back";
    case "detail":
      return "Detail";
    case "flaw":
      return "Flaw";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
