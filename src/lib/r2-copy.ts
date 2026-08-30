export const R2_COPY_BATCH_SIZE = 6;

export type R2CopyIssue = {
  path: string;
  reason: string;
};

export type R2CopyTotals = {
  copied: number;
  skipped: number;
  thumbs: number;
  failed: number;
  missing: number;
  failedPaths: string[];
  missingPaths: string[];
  issues: R2CopyIssue[];
};

export function emptyR2CopyTotals(): R2CopyTotals {
  return {
    copied: 0,
    skipped: 0,
    thumbs: 0,
    failed: 0,
    missing: 0,
    failedPaths: [],
    missingPaths: [],
    issues: [],
  };
}

export function addR2CopyTotals(a: R2CopyTotals, b: R2CopyTotals): R2CopyTotals {
  return {
    copied: a.copied + b.copied,
    skipped: a.skipped + b.skipped,
    thumbs: a.thumbs + b.thumbs,
    failed: a.failed + b.failed,
    missing: (a.missing ?? 0) + (b.missing ?? 0),
    failedPaths: [...(a.failedPaths ?? []), ...(b.failedPaths ?? [])].slice(
      0,
      20
    ),
    missingPaths: [...(a.missingPaths ?? []), ...(b.missingPaths ?? [])].slice(
      0,
      20
    ),
    issues: [...(a.issues ?? []), ...(b.issues ?? [])].slice(0, 20),
  };
}

export function isSafePhotoStoragePath(path: string): boolean {
  if (!path || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    return false;
  }
  return true;
}
