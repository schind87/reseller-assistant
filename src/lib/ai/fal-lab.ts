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

export function falDashboardUrl(requestId?: string | null): string {
  if (requestId) {
    return `https://fal.ai/dashboard/requests?requestId=${encodeURIComponent(requestId)}`;
  }
  return "https://fal.ai/dashboard/usage";
}

/**
 * Submit via fal queue so we always get a request_id for billing lookup.
 */
export async function falQueueInfer(
  path: string,
  body: Record<string, unknown>
): Promise<{ requestId: string; data: unknown }> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY is not configured");

  const submit = await fetch(`https://queue.fal.run/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!submit.ok) {
    const text = await submit.text().catch(() => "");
    throw new Error(`fal queue submit ${path} ${submit.status}: ${text.slice(0, 400)}`);
  }

  const submitted = (await submit.json()) as { request_id?: string };
  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error(`fal queue submit missing request_id for ${path}`);
  }

  const started = Date.now();
  const timeoutMs = 90_000;

  while (Date.now() - started < timeoutMs) {
    const statusRes = await fetch(
      `https://queue.fal.run/${path}/requests/${requestId}/status`,
      {
        headers: { Authorization: `Key ${key}` },
      }
    );
    if (!statusRes.ok) {
      const text = await statusRes.text().catch(() => "");
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
        const resultRes = await fetch(
          `https://queue.fal.run/${path}/requests/${requestId}`,
          { headers: { Authorization: `Key ${key}` } }
        );
        if (!resultRes.ok) {
          const text = await resultRes.text().catch(() => "");
          throw new Error(
            `fal queue result ${path} ${resultRes.status}: ${text.slice(0, 400)}`
          );
        }
        return { requestId, data: await resultRes.json() };
      }
      case "FAILED":
      case "CANCELLED":
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

  // Billing events can lag a second or two after completion.
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(900);
    try {
      const url = new URL("https://api.fal.ai/v1/models/billing-events");
      url.searchParams.set("request_id", requestId);
      const res = await fetch(url, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        billing_events?: Array<{
          cost_total?: number | null;
          cost_subtotal?: number | null;
          cost_estimate_nano_usd?: number | null;
          unit_price?: number | null;
          output_units?: number | null;
          currency?: string;
        }>;
      };
      const event = data.billing_events?.[0];
      if (!event) continue;

      let costUsd: number | null =
        typeof event.cost_total === "number"
          ? event.cost_total
          : typeof event.cost_subtotal === "number"
            ? event.cost_subtotal
            : null;
      if (
        costUsd == null &&
        typeof event.cost_estimate_nano_usd === "number"
      ) {
        costUsd = event.cost_estimate_nano_usd / 1_000_000_000;
      }
      if (costUsd == null) continue;

      return {
        costUsd,
        unitPrice:
          typeof event.unit_price === "number" ? event.unit_price : null,
        units:
          typeof event.output_units === "number" ? event.output_units : null,
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
 */
export async function resolveFalCost(params: {
  requestId: string;
  endpointId: string;
}): Promise<FalBillingInfo> {
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
      dashboardUrl: falDashboardUrl(params.requestId),
    };
  }

  const estimate = await fetchPricingEstimate(params.endpointId);
  if (estimate) {
    return {
      requestId: params.requestId,
      endpointId: params.endpointId,
      costUsd: estimate.unitPrice,
      unitPrice: estimate.unitPrice,
      units: 1,
      currency: estimate.currency,
      source: "pricing_estimate",
      dashboardUrl: falDashboardUrl(params.requestId),
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
    dashboardUrl: falDashboardUrl(params.requestId),
  };
}
