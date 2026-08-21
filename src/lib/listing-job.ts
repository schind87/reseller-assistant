import { PLATFORM_LABELS } from "@/lib/platforms";
import type { ListingStatus, Platform } from "@/lib/types";

/** The seller's next job on a listing — not a raw status slug. */
export type ListingJobStep =
  | "add_photos"
  | "finish_with_ai"
  | "open_marketplace"
  | "mark_posted"
  | "posted";

export function listingJobStep(input: {
  status: ListingStatus;
  title: string | null | undefined;
  hasListingPhoto: boolean;
}): ListingJobStep {
  if (input.status === "posted") return "posted";
  if (input.status === "posting") return "mark_posted";
  if (!input.hasListingPhoto) return "add_photos";
  if (!input.title?.trim()) return "finish_with_ai";
  return "open_marketplace";
}

export function listingJobStepLabel(step: ListingJobStep): string {
  switch (step) {
    case "add_photos":
      return "Needs photos";
    case "finish_with_ai":
      return "Review draft";
    case "open_marketplace":
      return "Ready to post";
    case "mark_posted":
      return "Mark as posted";
    case "posted":
      return "Posted";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function listingJobActionLabel(
  step: ListingJobStep,
  platform: Platform
): string {
  switch (step) {
    case "add_photos":
      return platform === "poshmark" ? "Add a cover shot" : "Add a cover photo";
    case "finish_with_ai":
      return "Finish with AI";
    case "open_marketplace":
      return `Open ${PLATFORM_LABELS[platform]}`;
    case "mark_posted":
      return "Mark as posted";
    case "posted":
      return "Posted";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function listingListSubtitle(
  platform: Platform,
  step: ListingJobStep
): string {
  return `${PLATFORM_LABELS[platform]} · ${listingJobStepLabel(step)}`;
}

export function listingJobBusyLabel(
  step: ListingJobStep,
  flags: {
    uploading: boolean;
    processing: boolean;
    openingSell: boolean;
    markingPosted: boolean;
  }
): string | null {
  switch (step) {
    case "add_photos":
      return flags.uploading ? "Uploading…" : null;
    case "finish_with_ai":
      return flags.processing ? "Working…" : null;
    case "open_marketplace":
      return flags.openingSell ? "Opening…" : null;
    case "mark_posted":
      return flags.markingPosted ? "Saving…" : null;
    case "posted":
      return null;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
