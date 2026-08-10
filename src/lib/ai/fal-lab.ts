/**
 * fal.ai helpers for AI Photo Lab:
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

/**
 * Billing/usage Platform APIs require an ADMIN-scoped fal key.
 * Inference works with a normal API key; Recent History in the dashboard
 * uses the logged-in session — so costs can appear there while our lab
 * still shows "Cost pending" if only an API-scoped key is configured.
 */
function falBillingKey(): string | null {
  return (
    process.env.FAL_ADMIN_KEY?.trim() ||
    process.env.FAL_KEY?.trim() ||
    null
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Parse lab catalog strings like "~$0.016" into a USD estimate. */
export function parseApproxCostUsd(approxCost: string): number | null {
  const match = approxCost.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Display USD as cents with one decimal (e.g. $0.016 → 1.6¢). */
export function formatCostUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  const cents = value * 100;
  const rounded = Math.round(cents * 10) / 10;
  const body = Math.abs(rounded).toFixed(1);
  return `${rounded < 0 ? "-" : ""}${body}¢`;
}

/** Catalog approxCost strings normalized to cents (or "unpriced"). */
export function formatApproxCostCents(approxCost: string): string {
  const usd = parseApproxCostUsd(approxCost);
  return formatCostUsd(usd) ?? "unpriced";
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
        unit_price?: number | string | null;
        unit?: string;
        currency?: string;
      }>;
    };
    const price =
      data.prices?.find((p) => p.endpoint_id === endpointId) ??
      data.prices?.[0];
    const unitPrice = asFiniteNumber(price?.unit_price);
    if (unitPrice == null || unitPrice <= 0) return null;
    return {
      unitPrice,
      unit: price?.unit ?? "image",
      currency: price?.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

async function fetchBillingEvent(
  requestId: string,
  endpointId?: string | null
): Promise<{
  costUsd: number;
  unitPrice: number | null;
  units: number | null;
  currency: string;
} | null> {
  const key = falBillingKey();
  if (!key) return null;
  if (requestId.startsWith("sync-")) return null;

  // Billing events can lag several seconds after completion.
  // Auth failures won't recover with retries — fail fast.
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await sleep(900 + attempt * 300);
    try {
      const url = new URL("https://api.fal.ai/v1/models/billing-events");
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("limit", "10");
      // Widen past the default 24h window when filtering by id.
      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      url.searchParams.set("start", start.toISOString());
      if (endpointId?.trim()) {
        url.searchParams.set("endpoint_id", endpointId.trim());
      }
      const res = await fetch(url, {
        headers: { Authorization: `Key ${key}` },
      });
      if (res.status === 401 || res.status === 403) {
        console.warn(
          "fal billing-events denied — use an ADMIN-scoped key (FAL_ADMIN_KEY or ADMIN FAL_KEY) to read actual costs",
          res.status,
        );
        return null;
      }
      if (!res.ok) continue;
      const data = (await res.json()) as {
        billing_events?: Array<Record<string, unknown>>;
      };
      const event =
        data.billing_events?.find((e) => e.request_id === requestId) ??
        data.billing_events?.[0];
      if (!event) continue;

      const unitPrice = asFiniteNumber(event.unit_price);
      const units = asFiniteNumber(event.output_units);

      let costUsd =
        asFiniteNumber(event.cost_total) ??
        (() => {
          const sub = asFiniteNumber(event.cost_subtotal);
          if (sub == null) return null;
          const discount = asFiniteNumber(event.cost_discount) ?? 0;
          return sub - discount;
        })();

      if (costUsd == null) {
        const nano = asFiniteNumber(event.cost_estimate_nano_usd);
        if (nano != null) costUsd = nano / 1_000_000_000;
      }

      if (costUsd == null && unitPrice != null && units != null) {
        costUsd = unitPrice * units;
        const pct = asFiniteNumber(event.percent_discount);
        if (pct != null && pct > 0) {
          costUsd *= 1 - pct / 100;
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
  /** Optional lab catalog hint like "~$0.016" when fal pricing has no row. */
  approxCostHint?: string | null;
}): Promise<FalBillingInfo> {
  if (params.settleMs && params.settleMs > 0) {
    await sleep(params.settleMs);
  }

  const billed = await fetchBillingEvent(params.requestId, params.endpointId);
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

  const catalog = params.approxCostHint
    ? parseApproxCostUsd(params.approxCostHint)
    : null;
  if (catalog != null) {
    return {
      requestId: params.requestId,
      endpointId: params.endpointId,
      costUsd: catalog,
      unitPrice: catalog,
      units: 1,
      currency: "USD",
      source: "pricing_estimate",
      dashboardUrl: falDashboardUrl(params.requestId, params.endpointId),
    };
  }

  return {
    requestId: params.requestId,
    endpointId: params.endpointId,
    costUsd: null,
    unitPrice: null,
    units: null,
    currency: "USD",
    source: null,
    dashboardUrl: falDashboardUrl(params.requestId, params.endpointId),
  };
}
