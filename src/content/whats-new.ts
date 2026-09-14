export type WhatsNewScreenshot = {
  src: string;
  alt: string;
  label: string;
};

export type WhatsNewItem = {
  id: string;
  date: string;
  title: string;
  body: string;
  bullets?: string[];
  helper?: boolean;
  screenshots?: WhatsNewScreenshot[];
};

/**
 * Newest first. The What's new page renders this list.
 * Agents: follow `.agents/skills/whats-new/SKILL.md` when you ship.
 */
export const WHATS_NEW: WhatsNewItem[] = [
  {
    id: "whats-new-scan",
    date: "2026-09-14",
    title: "What’s new is a list of changes",
    body: "Each change is its own row. Screenshots are photos you tap. Chrome’s Store status sits on the newest helper note, not guessed.",
  },
  {
    id: "helper-store-status",
    date: "2026-09-14",
    title: "Helper notes show what Chrome has",
    helper: true,
    body: "Next to Chrome helper notes we show what the Chrome Web Store actually has: the live version, or that a newer one is in review.",
  },
  {
    id: "helper-0-7-0-8",
    date: "2026-09-13",
    title: "Chrome helper 0.7.0.8 is at the Store",
    helper: true,
    body: "We sent helper 0.7.0.8 to the Chrome Web Store.",
  },
  {
    id: "admin-users-shop-links",
    date: "2026-09-13",
    title: "Users can open a seller’s shop",
    helper: true,
    body: "On Users, admins can link a seller’s Mercari or Poshmark closet and run Check listings. Check listings still uses the Chrome helper.",
    screenshots: [
      {
        src: "/whats-new/admin-users.webp",
        alt: "Users page with linked shop names and no R2 copy control",
        label: "See Users",
      },
      {
        src: "/whats-new/admin-check-listings.webp",
        alt: "Check listings on a linked Poshmark closet from Users",
        label: "See Check listings",
      },
    ],
  },
  {
    id: "poshmark-fill",
    date: "2026-09-13",
    title: "Poshmark fill: price, category, and style tags",
    helper: true,
    body: "Open Poshmark from a listing and the helper fills the sell form from what you already saved.",
    bullets: [
      "Price goes in the listing price field as a whole dollar.",
      "Category is picked from Poshmark’s own list, including the last step (like Tees).",
      "Style tags are tapped from Poshmark’s suggestions, not typed in and left hanging.",
    ],
    screenshots: [
      {
        src: "/whats-new/price-filled.png",
        alt: "Poshmark listing price filled with 18",
        label: "See price",
      },
      {
        src: "/whats-new/category-before.png",
        alt: "Poshmark category still set to Select Category",
        label: "See category before",
      },
      {
        src: "/whats-new/category-after.png",
        alt: "Poshmark category set to Women Tops and Tees Short Sleeve",
        label: "See category after",
      },
      {
        src: "/whats-new/style-tags.png",
        alt: "Poshmark style tags Casual and Athletic confirmed as chips",
        label: "See style tags",
      },
    ],
  },
  {
    id: "more-to-delete",
    date: "2026-09-12",
    title: "More becomes Delete",
    body: "On All listings, More turns into a red Delete on that same button. Tap again to delete the listing. Photos go too. There is no undo.",
    screenshots: [
      {
        src: "/whats-new/more-idle.webp",
        alt: "Listing row with a More button on the right",
        label: "See More",
      },
      {
        src: "/whats-new/more-delete.webp",
        alt: "Same listing row with More changed to a red Delete button",
        label: "See Delete",
      },
    ],
  },
  {
    id: "closet-linking",
    date: "2026-09-04",
    title: "Link your Mercari or Poshmark closet",
    helper: true,
    body: "On Profile, under Linked closets, you can attach your shop and Check listings. Find my closet uses the Chrome helper while you are signed into that store in Chrome.",
    screenshots: [
      {
        src: "/whats-new/closet-linked.webp",
        alt: "Profile showing a Poshmark closet linked as maracloset84",
        label: "See linked closet",
      },
    ],
  },
];
