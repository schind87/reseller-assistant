/** Filename marker so older cleaned files are regenerated after pipeline fixes. */
export const BG_PIPELINE_TAG = "bgv4";

export function isCurrentBgPipeline(
  processedPath: string | null | undefined
): boolean {
  return Boolean(
    processedPath && processedPath.includes(`-${BG_PIPELINE_TAG}-`)
  );
}
