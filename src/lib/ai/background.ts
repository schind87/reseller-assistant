/**
 * Background removal via fal.ai BiRefNet.
 * Returns a remote image URL, or null if FAL_KEY is missing / the call fails.
 */
export async function removeBackground(
  imageUrl: string
): Promise<string | null> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return null;
  }

  try {
    const response = await fetch("https://fal.run/fal-ai/birefnet", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("fal birefnet error:", response.status, text);
      return null;
    }

    const data = (await response.json()) as {
      image?: { url?: string };
      images?: Array<{ url?: string }>;
    };

    const url = data.image?.url ?? data.images?.[0]?.url ?? null;
    return url;
  } catch (err) {
    console.error("removeBackground failed:", err);
    return null;
  }
}

/**
 * Download a processed image URL and return bytes for storage upload.
 */
export async function fetchImageBytes(
  url: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const bytes = await res.arrayBuffer();
    return { bytes, contentType };
  } catch (err) {
    console.error("fetchImageBytes failed:", err);
    return null;
  }
}
