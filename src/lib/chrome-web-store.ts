/** Chrome Web Store item id, set after the first listing is created. */
export const CHROME_WEB_STORE_ID =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_ID?.trim() ?? "";

export function chromeWebStoreUrl(id = CHROME_WEB_STORE_ID): string | null {
  if (!id) return null;
  return `https://chromewebstore.google.com/detail/${id}`;
}
