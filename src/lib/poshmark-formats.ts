import type { StructuredFields } from "@/lib/types";
import { normalizePoshmarkStyleTag } from "@/lib/poshmark-style-tags";

/** Live Poshmark create-listing color swatches (up to 2). */
export const POSHMARK_COLORS = [
  "Red",
  "Pink",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Gold",
  "Silver",
  "Black",
  "Gray",
  "White",
  "Cream",
  "Brown",
  "Tan",
] as const;

const POSHMARK_CONDITION_VALUES = [
  "New With Tags",
  "Like New",
  "Good",
  "Fair",
] as const;

type PoshmarkCondition = (typeof POSHMARK_CONDITION_VALUES)[number];
type PoshmarkColor = (typeof POSHMARK_COLORS)[number];

const COLOR_SET = new Set<string>(POSHMARK_COLORS);

/** Map free-text / legacy condition labels onto live Poshmark choices. */
export function normalizePoshmarkCondition(
  raw: string | null | undefined
): PoshmarkCondition | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().toLowerCase();

  if (
    value.includes("new with tags") ||
    value === "nwt" ||
    /\bnwt\b/.test(value)
  ) {
    return "New With Tags";
  }
  if (
    value.includes("new without tags") ||
    value === "nwot" ||
    /\bnwot\b/.test(value) ||
    value.includes("like new") ||
    value.includes("excellent") ||
    value === "euc" ||
    value.includes("never worn")
  ) {
    return "Like New";
  }
  if (value.includes("fair") || value.includes("poor")) {
    return "Fair";
  }
  if (value.includes("good") || value.includes("gently") || value === "guc") {
    return "Good";
  }

  return null;
}

/** Map free-text color onto a Poshmark swatch when possible. */
export function normalizePoshmarkColor(
  raw: string | null | undefined
): PoshmarkColor | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().toLowerCase();

  const direct = POSHMARK_COLORS.find((color) => color.toLowerCase() === value);
  if (direct) return direct;

  const aliases: Array<[RegExp, PoshmarkColor]> = [
    [/\bnavy\b|\bindigo\b|\bteal\b|\baqua\b|\bturquoise\b/, "Blue"],
    [/\bgrey\b|\bcharcoal\b|\bslate\b/, "Gray"],
    [/\bbeige\b|\bkhaki\b|\bcamel\b|\btaupe\b/, "Tan"],
    [/\bivory\b|\boff[-\s]?white\b|\begg?shell\b/, "Cream"],
    [/\bmaroon\b|\bburgundy\b|\bwine\b|\bcrimson\b/, "Red"],
    [/\bmagenta\b|\bfuchsia\b|\brose\b|\bcoral\b/, "Pink"],
    [/\bolive\b|\bsage\b|\bmint\b|\bforest\b/, "Green"],
    [/\blavender\b|\bliac\b|\bviolet\b/, "Purple"],
    [/\bmustard\b|\bgold(en)?\b/, "Gold"],
    [/\bbronze\b|\bcopper\b/, "Brown"],
  ];

  for (const [pattern, color] of aliases) {
    if (pattern.test(value)) return color;
  }

  for (const color of POSHMARK_COLORS) {
    if (value.includes(color.toLowerCase())) return color;
  }

  return null;
}

export function normalizePoshmarkStyleTags(
  tags: string[] | null | undefined
): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of tags) {
    const canonical = normalizePoshmarkStyleTag(raw) ?? raw.trim();
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(canonical);
    if (normalized.length >= 3) break;
  }
  return normalized;
}

/** Coerce draft/identify structured fields into Poshmark-accepted formats. */
export function normalizePoshmarkStructuredFields(
  fields: StructuredFields
): StructuredFields {
  const color = normalizePoshmarkColor(fields.color);
  let colorSecondary = normalizePoshmarkColor(fields.colorSecondary);
  if (color && colorSecondary && colorSecondary === color) {
    colorSecondary = null;
  }

  return {
    ...fields,
    condition: normalizePoshmarkCondition(fields.condition) ?? fields.condition,
    color: color ?? fields.color,
    colorSecondary: colorSecondary ?? fields.colorSecondary,
    styleTags: normalizePoshmarkStyleTags(fields.styleTags),
  };
}

export function isPoshmarkColor(value: string | null | undefined): boolean {
  return Boolean(value && COLOR_SET.has(value));
}
