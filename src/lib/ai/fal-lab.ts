/**
 * fal.ai helpers for the background model lab:
 * queue inference (to get request_id) + pricing/billing lookup.
 */

export type FalBillingInfo = {
  requestId: string;
  endpointId: string;
  costUsd: number | null;
  unitPrice: number | null;
  units: number | null;
  currency: string;
  /** billing_event = exact charged amount; pricing_estimate = catalog unit price */
  source: "billing_event" | "pricing_estimate" | null;
  dashboardUrl: string;
};

function falKey(): string | null {
  return process.env.FAL_KEY?.trim() || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function falModelPageUrl(endpointId: string): string {
  return `https://fal.ai/models/${endpointId.replace(/^\/+/, "")}`;
}

/** True when the id is a real fal queue request (not a sync fallback placeholder). */
export function isRealFalRequestId(requestId?: string | null): boolean {
  if (!requestId?.trim()) return false;
  return !requestId.startsWith("sync-");
}

/**
 * Deep-link into fal's Recent History for a Model API request
 * (shows billed cost when fal has recorded it).
 * Example:
 * https://fal.ai/dashboard/recent-history?s_requestId=…&s_endpointId=fal-ai%2Fimageutils%2Frembg
 */
export function falDashboardUrl(
  requestId?: string | null,
  endpointId?: string | null
): string {
  const id = requestId?.trim() || null;
  const endpoint = endpointId?.trim() || null;

  if (id && isRealFalRequestId(id) && endpoint) {
    const params = new URLSearchParams({
      s_requestId: id,
      s_endpointId: endpoint,
    });
    return `https://fal.ai/dashboard/recent-history?${params.toString()}`;
  }
  if (id && isRealFalRequestId(id)) {
    const params = new URLSearchParams({ s_requestId: id });
    return `https://fal.ai/dashboard/recent-history?${params.toString()}`;
  }
  if (endpoint) return falModelPageUrl(endpoint);
  return "https://fal.ai/dashboard/recent-history";
}

/**
 * fal queue status/result URLs are rooted at owner/alias (first two segments),
 * even when the submit path is deeper (e.g. fal-ai/birefnet/v2).
 */
function queueAppRoot(endpointId: string): string {
  const parts = endpointId.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return endpointId;
}

type QueueSubmitResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  // Older responses sometimes omit the trailing /response
  // and only expose request_id for us to build URLs.
};

/**
 * Submit via fal queue so we always get a request_id for billing lookup.
 * Uses status_url / response_url from the submit payload when present.
 */
export async function falQueueInfer(
  path: string,
  body: Record<string, unknown>
): Promise<{ requestId: string; data: unknown }> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY is not configured");

  const authHeaders = {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };

  const submit = await fetch(`https://queue.fal.run/${path}`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  if (!submit.ok) {
    const text = await submit.text().catch(() => "");
    // Fall back to sync fal.run when queue submit is unavailable for the model.
    if (submit.status === 404 || submit.status === 405) {
      return falSyncInfer(path, body);
    }
    throw new Error(
      `fal queue submit ${path} ${submit.status}: ${text.slice(0, 400)}`
    );
  }

  const submitted = (await submit.json()) as QueueSubmitResponse;
  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error(`fal queue submit missing request_id for ${path}`);
  }

  const appRoot = queueAppRoot(path);
  const statusCandidates = [
    submitted.status_url?.trim(),
    `https://queue.fal.run/${appRoot}/requests/${requestId}/status`,
    // Full endpoint path — works for 2-segment apps; nested apps often 405 here.
    `https://queue.fal.run/${path}/requests/${requestId}/status`,
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  const responseCandidates = [
    submitted.response_url?.trim(),
    `https://queue.fal.run/${appRoot}/requests/${requestId}`,
    `https://queue.fal.run/${appRoot}/requests/${requestId}/response`,
    `https://queue.fal.run/${path}/requests/${requestId}`,
    `https://queue.fal.run/${path}/requests/${requestId}/response`,
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  let statusUrl = statusCandidates[0]!;
  const started = Date.now();
  const timeoutMs = 120_000;
  let statusUrlIndex = 0;

  while (Date.now() - started < timeoutMs) {
    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${key}` },
    });

    if (!statusRes.ok) {
      const text = await statusRes.text().catch(() => "");
      if (
        (statusRes.status === 404 || statusRes.status === 405) &&
        statusUrlIndex < statusCandidates.length - 1
      ) {
        statusUrlIndex += 1;
        statusUrl = statusCandidates[statusUrlIndex]!;
        continue;
      }
      throw new Error(
        `fal queue status ${path} ${statusRes.status}: ${text.slice(0, 400)}`
      );
    }

    const status = (await statusRes.json()) as {
      status?: string;
      error?: string;
    };

    switch (status.status) {
      case "COMPLETED": {
        let lastError = "No response URL worked";
        for (const responseUrl of responseCandidates) {
          const resultRes = await fetch(responseUrl, {
            method: "GET",
            headers: { Authorization: `Key ${key}` },
          });
          if (resultRes.ok) {
            return { requestId, data: await resultRes.json() };
          }
          const text = await resultRes.text().catch(() => "");
          lastError = `fal queue result ${path} ${resultRes.status}: ${text.slice(0, 400)}`;
          if (resultRes.status !== 404 && resultRes.status !== 405) {
            throw new Error(lastError);
          }
        }
        throw new Error(lastError);
      }
      case "FAILED":
      case "CANCELLED":
      case "CANCELED":
        throw new Error(
          status.error || `fal queue ${status.status?.toLowerCase()} for ${path}`
        );
      case "IN_QUEUE":
      case "IN_PROGRESS":
      default:
        await sleep(700);
        break;
    }
  }

  throw new Error(`fal queue timed out for ${path} (${requestId})`);
}

/**
 * Sync fal.run fallback. Still returns request_id from response headers when
 * available so billing lookup can work.
 */
async function falSyncInfer(
  path: string,
  body: Record<string, unknown>
): Promise<{ requestId: string; data: unknown }> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY is not configured");

  const response = await fetch(`https://fal.run/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`fal.run ${path} ${response.status}: ${text.slice(0, 400)}`);
  }

  const requestId =
    response.headers.get("x-fal-request-id") ||
    response.headers.get("X-Fal-Request-Id") ||
    `sync-${path}-${Date.now()}`;

  return { requestId, data: await response.json() };
}

async function fetchPricingEstimate(
  endpointId: string
): Promise<{ unitPrice: number; unit: string; currency: string } | null> {
  const key = falKey();
  if (!key) return null;
  try {
    const url = new URL("https://api.fal.ai/v1/models/pricing");
    url.searchParams.set("endpoint_id", endpointId);
    const res = await fetch(url, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      prices?: Array<{
        endpoint_id?: string;
        unit_price?: number;
        unit?: string;
        currency?: string;
      }>;
    };
    const price = data.prices?.[0];
    if (price?.unit_price == null) return null;
    return {
      unitPrice: price.unit_price,
      unit: price.unit ?? "image",
      currency: price.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

async function fetchBillingEvent(
  requestId: string
): Promise<{
  costUsd: number;
  unitPrice: number | null;
  units: number | null;
  currency: string;
} | null> {
  const key = falKey();
  if (!key) return null;
  if (requestId.startsWith("sync-")) return null;

  // Billing events can lag several seconds after completion.
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await sleep(1000 + attempt * 250);
    try {
      const url = new URL("https://api.fal.ai/v1/models/billing-events");
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("limit", "10");
      const res = await fetch(url, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        billing_events?: Array<{
          request_id?: string;
          cost_total?: number | null;
          cost_subtotal?: number | null;
          cost_discount?: number | null;
          cost_estimate_nano_usd?: number | null;
          unit_price?: number | null;
          output_units?: number | null;
          percent_discount?: number | null;
          currency?: string;
        }>;
      };
      const event =
        data.billing_events?.find((e) => e.request_id === requestId) ??
        data.billing_events?.[0];
      if (!event) continue;

      const unitPrice =
        typeof event.unit_price === "number" ? event.unit_price : null;
      const units =
        typeof event.output_units === "number" ? event.output_units : null;

      let costUsd: number | null =
        typeof event.cost_total === "number"
          ? event.cost_total
          : typeof event.cost_subtotal === "number"
            ? event.cost_subtotal -
              (typeof event.cost_discount === "number"
                ? event.cost_discount
                : 0)
            : null;

      if (
        costUsd == null &&
        typeof event.cost_estimate_nano_usd === "number"
      ) {
        costUsd = event.cost_estimate_nano_usd / 1_000_000_000;
      }

      if (costUsd == null && unitPrice != null && units != null) {
        costUsd = unitPrice * units;
        if (
          typeof event.percent_discount === "number" &&
          event.percent_discount > 0
        ) {
          costUsd *= 1 - event.percent_discount / 100;
        }
      }

      if (costUsd == null) continue;

      return {
        costUsd,
        unitPrice,
        units,
        currency: "USD",
      };
    } catch {
      /* retry */
    }
  }
  return null;
}

/**
 * Resolve charged (or estimated) cost for a completed fal request.
 * Prefer billing_event (actual) over catalog pricing_estimate.
 */
export async function resolveFalCost(params: {
  requestId: string;
  endpointId: string;
  /** Extra wait before first billing poll — useful right after inference. */
  settleMs?: number;
}): Promise<FalBillingInfo> {
  if (params.settleMs && params.settleMs > 0) {
    await sleep(params.settleMs);
  }

  const billed = await fetchBillingEvent(params.requestId);
  if (billed) {
    return {
      requestId: params.requestId,
      endpointId: params.endpointId,
      costUsd: billed.costUsd,
      unitPrice: billed.unitPrice,
      units: billed.units,
      currency: billed.currency,
      source: "billing_event",
      dashboardUrl: falDashboardUrl(params.requestId, params.endpointId),
    };
  }

  const estimate = await fetchPricingEstimate(params.endpointId);
  if (estimate && estimate.unitPrice > 0) {
    return {
      requestId: params.requestId,
      endpointId: params.endpointId,
      costUsd: estimate.unitPrice,
      unitPrice: estimate.unitPrice,
      units: 1,
      currency: estimate.currency,
      source: "pricing_estimate",
      dashboardUrl: falDashboardUrl(params.requestId, params.endpointId),
    };
  }

  return {
    requestId: params.requestId,
    endpointId: params.endpointId,
    costUsd: null,
    unitPrice: estimate?.unitPrice ?? null,
    units: null,
    currency: "USD",
    source: null,
    dashboardUrl: falDashboardUrl(params.requestId, params.endpointId),
  };
}
