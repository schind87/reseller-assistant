import type { PhotoRole, Platform } from "@/lib/types";

export type PhotoStepDef = {
  role: PhotoRole;
  title: string;
  instruction: string;
  optional: boolean;
};

export type FieldLimits = {
  titleMax: number;
  descriptionMax: number;
  maxPhotos: number;
};

export type ChecklistStep = {
  id: string;
  label: string;
  hint: string;
};

const SHARED_PHOTO_STEPS: PhotoStepDef[] = [
  {
    role: "brand_tag",
    title: "Brand tag",
    instruction: "Photo the brand label inside the garment if you can find it.",
    optional: true,
  },
  {
    role: "care_tag",
    title: "Size & care tag",
    instruction: "Photo the size and fabric/care label. This helps get the size right.",
    optional: true,
  },
  {
    role: "cover",
    title: "Cover photo",
    instruction: "Full item, front-facing, well lit. This is the main photo shoppers see first.",
    optional: false,
  },
  {
    role: "front",
    title: "Front",
    instruction: "Clear front view of the whole item on a simple background.",
    optional: false,
  },
  {
    role: "back",
    title: "Back",
    instruction: "Show the back of the item so shoppers see the full piece.",
    optional: false,
  },
  {
    role: "detail",
    title: "Details",
    instruction: "Close-up of interesting details — texture, buttons, embroidery, or style features.",
    optional: false,
  },
  {
    role: "flaw",
    title: "Flaws",
    instruction: "Photo any stains, holes, or wear. Skip if there are no flaws.",
    optional: true,
  },
];

const MERCARI_PHOTO_STEPS: PhotoStepDef[] = SHARED_PHOTO_STEPS.map((step) => {
  if (step.role === "cover") {
    return {
      ...step,
      instruction:
        "Main photo — full item, bright light. Mercari allows up to 12 photos; start with a clean cover shot.",
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
        "Poshmark shoppers judge the cover first. Flat lay or hanging, full item, bright and uncluttered.",
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

export const POSTING_CHECKLIST: Record<Platform, ChecklistStep[]> = {
  mercari: [
    {
      id: "open",
      label: "Open Mercari Sell",
      hint: "Use the button below, then keep this checklist open.",
    },
    {
      id: "photos",
      label: "Add photos in order",
      hint: "Cover first, then front, back, details, and flaws.",
    },
    {
      id: "title",
      label: "Paste the title",
      hint: "Brand, type, size, and color up front (80 character limit).",
    },
    {
      id: "description",
      label: "Paste the description",
      hint: "Include measurements, fabric, flaws, and smoke/pet notes.",
    },
    {
      id: "fields",
      label: "Fill brand, category, size, color, condition",
      hint: "Match the review screen fields, or use the browser extension.",
    },
    {
      id: "price",
      label: "Set your price",
      hint: "Copy the price from the review screen.",
    },
    {
      id: "publish",
      label: "Review and list",
      hint: "Double-check everything before you tap List.",
    },
  ],
  poshmark: [
    {
      id: "open",
      label: "Open Poshmark Create Listing",
      hint: "Use the button below, then keep this checklist open.",
    },
    {
      id: "cover",
      label: "Upload the cover photo first",
      hint: "Poshmark puts the most weight on the cover shot.",
    },
    {
      id: "photos",
      label: "Add remaining photos",
      hint: "Front, back, details, then flaws if any.",
    },
    {
      id: "title",
      label: "Paste the brand-first title",
      hint: "Start with the brand name.",
    },
    {
      id: "description",
      label: "Paste the description",
      hint: "Include flat measurements and condition notes.",
    },
    {
      id: "fields",
      label: "Fill brand, category, size, color, condition",
      hint: "Also set original price and style tags if you have them.",
    },
    {
      id: "price",
      label: "Set your asking price",
      hint: "Copy the price from the review screen.",
    },
    {
      id: "publish",
      label: "Review and list",
      hint: "Confirm everything looks right before publishing.",
    },
  ],
};

export function getPhotoSteps(platform: Platform): PhotoStepDef[] {
  return PHOTO_STEPS[platform];
}

export function getRequiredPhotoRoles(platform: Platform): PhotoRole[] {
  return PHOTO_STEPS[platform].filter((s) => !s.optional).map((s) => s.role);
}
