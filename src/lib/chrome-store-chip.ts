export type ChromeStoreItemState =
  | "ITEM_STATE_UNSPECIFIED"
  | "PENDING_REVIEW"
  | "STAGED"
  | "PUBLISHED"
  | "PUBLISHED_TO_TESTERS"
  | "REJECTED"
  | "CANCELLED";

export type ChromeStoreStatusSnapshot = {
  fetchedAt: string;
  takenDown: boolean;
  publishedVersion: string | null;
  publishedState: string | null;
  submittedVersion: string | null;
  submittedState: string | null;
};

export type ChromeHelperStoreChip = {
  label: string;
  tone: "accent" | "danger";
};

export type ChromeStoreRevisionStatus = {
  state?: string;
  distributionChannels?: { crxVersion?: string; deployPercentage?: number }[];
};

export type ChromeStoreFetchStatusResponse = {
  crxVersion?: string;
  takenDown?: boolean;
  publishedItemRevisionStatus?: ChromeStoreRevisionStatus;
  submittedItemRevisionStatus?: ChromeStoreRevisionStatus;
};

export function revisionVersion(
  revision: ChromeStoreRevisionStatus | undefined,
  fallback?: string
): string | null {
  const fromChannel = revision?.distributionChannels?.find((channel) =>
    Boolean(channel.crxVersion?.trim())
  )?.crxVersion;
  const version = fromChannel?.trim() || fallback?.trim();
  return version || null;
}

export function isItemState(value: string | null): value is ChromeStoreItemState {
  switch (value) {
    case "ITEM_STATE_UNSPECIFIED":
    case "PENDING_REVIEW":
    case "STAGED":
    case "PUBLISHED":
    case "PUBLISHED_TO_TESTERS":
    case "REJECTED":
    case "CANCELLED":
      return true;
    default:
      return false;
  }
}

export function snapshotFromFetchStatus(
  body: ChromeStoreFetchStatusResponse,
  fetchedAt = new Date().toISOString()
): ChromeStoreStatusSnapshot {
  const published = body.publishedItemRevisionStatus;
  const submitted = body.submittedItemRevisionStatus;
  return {
    fetchedAt,
    takenDown: Boolean(body.takenDown),
    publishedVersion: revisionVersion(published, body.crxVersion),
    publishedState: published?.state?.trim() || null,
    submittedVersion: revisionVersion(submitted),
    submittedState: submitted?.state?.trim() || null,
  };
}

function chipForState(
  state: ChromeStoreItemState,
  version: string,
  otherLiveVersion: string | null
): ChromeHelperStoreChip | null {
  switch (state) {
    case "PENDING_REVIEW":
      if (otherLiveVersion && otherLiveVersion !== version) {
        return {
          label: `Chrome has ${otherLiveVersion} · ${version} in review`,
          tone: "accent",
        };
      }
      return { label: `${version} in review`, tone: "accent" };
    case "STAGED":
      if (otherLiveVersion && otherLiveVersion !== version) {
        return {
          label: `Chrome has ${otherLiveVersion} · ${version} approved`,
          tone: "accent",
        };
      }
      return { label: `${version} approved, not live yet`, tone: "accent" };
    case "PUBLISHED":
      return { label: `Chrome has ${version}`, tone: "accent" };
    case "PUBLISHED_TO_TESTERS":
      return { label: `${version} on testers only`, tone: "accent" };
    case "REJECTED":
      if (otherLiveVersion) {
        return {
          label: `${version} rejected · Chrome has ${otherLiveVersion}`,
          tone: "danger",
        };
      }
      return { label: `${version} rejected`, tone: "danger" };
    case "CANCELLED":
      return null;
    case "ITEM_STATE_UNSPECIFIED":
      return null;
    default: {
      const _never: never = state;
      void _never;
      return null;
    }
  }
}

/**
 * Plain-language Store chip. Returns null when the payload is not enough to
 * say something true (missing versions, unknown state, no observation).
 */
export function formatChromeStoreChip(
  snapshot: ChromeStoreStatusSnapshot
): ChromeHelperStoreChip | null {
  if (snapshot.takenDown) {
    return { label: "Taken down on the Store", tone: "danger" };
  }

  const published = snapshot.publishedVersion;
  const submitted = snapshot.submittedVersion;
  const submittedState = isItemState(snapshot.submittedState)
    ? snapshot.submittedState
    : null;
  const publishedState = isItemState(snapshot.publishedState)
    ? snapshot.publishedState
    : null;

  if (submittedState && submitted) {
    const fromSubmitted = chipForState(submittedState, submitted, published);
    if (fromSubmitted) return fromSubmitted;
  }

  if (publishedState && published) {
    const fromPublished = chipForState(publishedState, published, null);
    if (fromPublished) return fromPublished;
  }

  if (published) {
    return { label: `Chrome has ${published}`, tone: "accent" };
  }

  return null;
}
