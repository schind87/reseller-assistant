/**
 * Browser prefs for which fal bg models appear in selectors, and the default
 * listing-page clean-bg model. Shared by the admin lab and ListingHub.
 */

import {
  FAL_BG_MODELS,
  type FalBgModelDef,
  type FalBgModelId,
} from "@/lib/ai/fal-bg-models";

export const BG_MODEL_CATALOG_PREFS_KEY = "ra-bg-model-catalog-v1";
const CHANGE_EVENT = "ra-bg-model-catalog";

export type BgModelCatalogPrefs = {
  /** Model ids hidden from lab + listing selectors. */
  descopedModelIds?: string[];
  /**
   * Default clean-bg model on listing pages.
   * Empty / missing = production hanger-safe pipeline.
   */
  defaultListingModelId?: string;
};

export function readBgModelCatalogPrefs(): BgModelCatalogPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BG_MODEL_CATALOG_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BgModelCatalogPrefs;
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    // One-time migrate from the older listing-only key.
    const legacy = window.localStorage.getItem("ra-listing-clean-bg-model-v1");
    if (legacy && isFalBgModelId(legacy)) {
      const migrated: BgModelCatalogPrefs = {
        defaultListingModelId: legacy,
      };
      window.localStorage.setItem(
        BG_MODEL_CATALOG_PREFS_KEY,
        JSON.stringify(migrated)
      );
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

export function writeBgModelCatalogPrefs(patch: BgModelCatalogPrefs) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readBgModelCatalogPrefs(), ...patch };
    window.localStorage.setItem(
      BG_MODEL_CATALOG_PREFS_KEY,
      JSON.stringify(next)
    );
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeBgModelCatalogPrefs(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function isFalBgModelId(
  value: string,
  models: readonly FalBgModelDef[] = FAL_BG_MODELS
): value is FalBgModelId {
  return models.some((m) => m.id === value);
}

export function descopedModelIdSet(
  prefs: BgModelCatalogPrefs
): Set<FalBgModelId> {
  const out = new Set<FalBgModelId>();
  for (const id of prefs.descopedModelIds ?? []) {
    if (isFalBgModelId(id)) out.add(id);
  }
  return out;
}

/** Models that appear in lab run checkboxes and listing clean-bg selector. */
export function scopedBgModels(
  models: readonly FalBgModelDef[],
  prefs: BgModelCatalogPrefs
): FalBgModelDef[] {
  const descoped = descopedModelIdSet(prefs);
  return models.filter((m) => !descoped.has(m.id));
}

export function resolveDefaultListingModelId(
  prefs: BgModelCatalogPrefs,
  models: readonly FalBgModelDef[] = FAL_BG_MODELS
): FalBgModelId | "" {
  const raw = prefs.defaultListingModelId?.trim() ?? "";
  if (!raw) return "";
  if (!isFalBgModelId(raw, models)) return "";
  if (descopedModelIdSet(prefs).has(raw)) return "";
  return raw;
}
