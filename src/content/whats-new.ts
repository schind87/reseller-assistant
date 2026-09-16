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
    id: "check-listings-title-posted",
    date: "2026-09-16",
    title: "Check listings marks matching drafts Posted",
    helper: true,
    body:
      "After Check listings on Profile or Users, a clothing listing whose title is on Mercari or Poshmark shows as Posted. Price is only used when two pieces share a title. Untitled drafts stay unconfirmed.",
  },
  {
    id: "posted-from-store",
    date: "2026-09-15",
    title: "Check listings confirms Posted",
    helper: true,
    body:
      "After Check listings, drafts that match a Mercari or Poshmark closet card show as Posted on All listings. Mark as posted is only if you have not checked that store yet.",
  },
  {
    id: "listing-status-jobs-vs-closet",
    date: "2026-09-15",
    title: "Posted drafts are not closet Active or Sold",
    body:
      "All listings now keeps Posted drafts under their own heading. Linked closets still show live Active, Sold, and other closet statuses from Check listings. Open Mercari or Poshmark waits until the draft is ready to post.",
  },
  {
    id: "seller-no-more",
    date: "2026-09-15",
    title: "More is only for admins",
    body:
      "Sellers no longer see More on a listing. Delete a listing from All listings. Admins still have More for Photo Lab and related tools.",
  },
  {
    id: "admin-check-listings-helper-rpc",
    date: "2026-09-15",
    title: "Check listings from Users keeps talking to the helper",
    helper: true,
    body:
      "Check listings from Users could stop if the Chrome helper lost its connection mid-check. The helper now answers even when that happens, and closet cards still save on that seller.",
  },
  {
    id: "admin-check-listings-seller",
    date: "2026-09-15",
    title: "Check listings on Users saves that seller’s closet",
    helper: true,
    body:
      "Check listings from Users now reads Poshmark closet cards and saves them on that seller, not the signed-in admin.",
  },
  {
    id: "check-listings-wait",
    date: "2026-09-14",
    title: "Check listings waits for the closet to load",
    helper: true,
    body:
      "Check listings was stopping too soon on slow Mercari and Poshmark pages. The Chrome helper now waits for closet cards, and the website gives it more time.",
  },
  {
    id: "helper-store-status",
    date: "2026-09-14",
    title: "Chrome may still have an older helper",
    helper: true,
    body:
      "If a newer helper is in review, Chrome keeps the live version until Google approves it.",
  },
  {
    id: "helper-0-7-0-8",
    date: "2026-09-13",
    title: "Chrome helper 0.7.0.8 sent to the Store",
    helper: true,
    body: "We uploaded 0.7.0.8 for Google to review.",
  },
  {
    id: "admin-users-shop-links",
    date: "2026-09-13",
    title: "Users can Check listings for a seller",
    helper: true,
    body: "On Users, admins can link a seller’s Mercari or Poshmark closet and run Check listings. Check listings still uses the Chrome helper.",
    screenshots: [
      {
        src: "/whats-new/admin-users.webp",
        alt: "Users page with linked closet names.",
        label: "Users",
      },
      {
        src: "/whats-new/admin-check-listings.webp",
        alt: "Check listings on a linked Poshmark closet from Users.",
        label: "Check listings",
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
      "Price (dollars only).",
      "Category — last step (like Tees), not the first match.",
      "Style tags — tap a suggestion instead of leaving extra text.",
    ],
    screenshots: [
      {
        src: "/whats-new/price-filled.png",
        alt: "Poshmark listing price filled with 18.",
        label: "Price",
      },
      {
        src: "/whats-new/category-before.png",
        alt: "Poshmark category still set to Select Category.",
        label: "Category before",
      },
      {
        src: "/whats-new/category-after.png",
        alt: "Poshmark category set to Women Tops and Tees Short Sleeve.",
        label: "Category after",
      },
      {
        src: "/whats-new/style-tags.png",
        alt: "Poshmark style tags Casual and Athletic confirmed as chips.",
        label: "Style tags",
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
        alt: "Listing row with More at the right end of the action row.",
        label: "More",
      },
      {
        src: "/whats-new/more-delete.webp",
        alt: "Same listing row with More changed to a red Delete.",
        label: "Delete",
      },
    ],
  },
  {
    id: "closet-linking",
    date: "2026-09-04",
    title: "Link your Mercari or Poshmark closet",
    helper: true,
    body: "On Profile, under Linked closets, you can link your closet and Check listings. Find my closet uses the Chrome helper while you are signed into that store in Chrome.",
    screenshots: [
      {
        src: "/whats-new/closet-linked.webp",
        alt: "Profile showing a Poshmark closet linked as maracloset84.",
        label: "Linked closet",
      },
    ],
  },
];
