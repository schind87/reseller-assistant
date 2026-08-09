import type { Platform } from "@/lib/types";

/**
 * Marketplace category trees used on sell forms.
 * Sourced from live Mercari / Poshmark category browse pages (clothing-focused).
 * Category = department; subcategory = next level under that department.
 */
export type MarketplaceCategoryTree = Record<string, string[]>;

export const MERCARI_CATEGORIES: MarketplaceCategoryTree = {
  Women: [
    "Athletic apparel",
    "Coats & jackets",
    "Dresses",
    "Jeans",
    "Jewelry",
    "Kimono / Yukata",
    "Maternity",
    "Pants",
    "School Uniform",
    "Shoes",
    "Shorts",
    "Skirts",
    "Sleepwear & robes",
    "Suits & blazers",
    "Sweaters",
    "Swimwear",
    "Tops & blouses",
    "Underwear",
    "Women's accessories",
    "Women's handbags",
    "Other",
  ],
  Men: [
    "Athletic apparel",
    "Coats & jackets",
    "Jeans",
    "Men's accessories",
    "Pants",
    "Shoes",
    "Shorts",
    "Sleepwear & robes",
    "Suits & blazers",
    "Sweaters",
    "Swimwear",
    "Tops",
    "Underwear",
    "Other",
  ],
  Kids: [
    "Boys' clothing",
    "Girls' clothing",
    "Baby boys' clothing",
    "Baby girls' clothing",
    "Kids' shoes",
    "Kids' accessories",
    "Other",
  ],
  Handbags: [
    "Shoulder bags",
    "Crossbody bags",
    "Totes",
    "Clutches & wristlets",
    "Backpacks",
    "Wallets",
    "Other",
  ],
  Beauty: [
    "Makeup",
    "Skincare",
    "Hair care",
    "Fragrance",
    "Bath & body",
    "Tools & accessories",
    "Other",
  ],
  Home: [
    "Home décor",
    "Kitchen & dining",
    "Bedding",
    "Bath",
    "Storage & organization",
    "Other",
  ],
  Electronics: [
    "Phones & accessories",
    "Computers & tablets",
    "Audio",
    "Cameras",
    "Video games & consoles",
    "Other",
  ],
  Vintage: ["Clothing", "Accessories", "Home", "Other"],
  Other: ["Other"],
};

export const POSHMARK_CATEGORIES: MarketplaceCategoryTree = {
  Women: [
    "Accessories",
    "Bags",
    "Dresses",
    "Intimates & Sleepwear",
    "Jackets & Coats",
    "Jeans",
    "Jewelry",
    "Makeup",
    "Pants & Jumpsuits",
    "Shoes",
    "Shorts",
    "Skirts",
    "Sweaters",
    "Swim",
    "Tops",
    "Skincare",
    "Hair",
    "Bath & Body",
    "Global & Traditional Wear",
  ],
  Men: [
    "Accessories",
    "Bags",
    "Jackets & Coats",
    "Jeans",
    "Pants",
    "Shirts",
    "Shoes",
    "Shorts",
    "Suits & Blazers",
    "Sweaters",
    "Swim",
    "Underwear & Socks",
    "Grooming",
    "Global & Traditional Wear",
  ],
  Kids: [
    "Accessories",
    "Bottoms",
    "Dresses",
    "Jackets & Coats",
    "Matching Sets",
    "One Pieces",
    "Pajamas",
    "Shirts & Tops",
    "Shoes",
    "Swim",
    "Costumes",
    "Toys",
  ],
  Home: [
    "Accents",
    "Bath",
    "Bedding",
    "Dining",
    "Holiday",
    "Kitchen & Dining",
    "Office",
    "Party Supplies",
    "Storage & Organization",
    "Wall Art",
    "Other",
  ],
  Pets: ["Dogs", "Cats", "Other"],
  Electronics: [
    "Cameras & Photography",
    "Cell Phones & Accessories",
    "Computers & Tablets",
    "Headphones",
    "Home Audio & Theater",
    "Other",
  ],
};

const TREES: Record<Platform, MarketplaceCategoryTree> = {
  mercari: MERCARI_CATEGORIES,
  poshmark: POSHMARK_CATEGORIES,
};

export function getMarketplaceCategoryTree(
  platform: Platform
): MarketplaceCategoryTree {
  return TREES[platform];
}

export function getMarketplaceCategoryOptions(platform: Platform): string[] {
  return Object.keys(getMarketplaceCategoryTree(platform));
}

export function getMarketplaceSubcategoryOptions(
  platform: Platform,
  category: string | null | undefined
): string[] {
  if (!category) return [];
  const tree = getMarketplaceCategoryTree(platform);
  return tree[category] ?? [];
}
