/**
 * Catalog of fal.ai (and optional PhotoRoom) background models for the
 * admin background model lab. Each entry knows how to build a fal.run body and
 * extract the result image URL.
 */

export type FalBgModelId =
  | "pixelcut-product-photo"
  | "pixelcut-background-removal"
  | "bria-rmbg-2"
  | "ideogram-remove-background"
  | "birefnet-v2-heavy"
  | "birefnet-v2-light"
  | "birefnet-v2-matting"
  | "imageutils-rembg"
  | "photoroom-segment";

export type FalBgModelDef = {
  id: FalBgModelId;
  label: string;
  provider: "fal" | "photoroom";
  /** fal.run path, or null for PhotoRoom */
  falPath: string | null;
  description: string;
  approxCost: string;
  /** Output is already on a solid studio color (not transparent). */
  solidBackground: boolean;
  defaultSelected?: boolean;
};

export const FAL_BG_MODELS: readonly FalBgModelDef[] = [
  {
    id: "pixelcut-product-photo",
    label: "Pixelcut Product Photo",
    provider: "fal",
    falPath: "pixelcut/product-photo",
    description: "E-commerce cutout + white canvas (current production primary on fal).",
    approxCost: "~$0.024",
    solidBackground: true,
    defaultSelected: true,
  },
  {
    id: "pixelcut-background-removal",
    label: "Pixelcut Background Removal",
    provider: "fal",
    falPath: "pixelcut/background-removal",
    description: "Transparent product cutout only.",
    approxCost: "~$0.016",
    solidBackground: false,
    defaultSelected: true,
  },
  {
    id: "bria-rmbg-2",
    label: "Bria RMBG 2.0",
    provider: "fal",
    falPath: "fal-ai/bria/background/remove",
    description: "Commercial cutout trained on licensed data.",
    approxCost: "~$0.018",
    solidBackground: false,
    defaultSelected: true,
  },
  {
    id: "ideogram-remove-background",
    label: "Ideogram Remove Background",
    provider: "fal",
    falPath: "fal-ai/ideogram/remove-background",
    description: "Precision transparent PNG cutout.",
    approxCost: "~$0.01",
    solidBackground: false,
    defaultSelected: true,
  },
  {
    id: "birefnet-v2-heavy",
    label: "BiRefNet v2 Heavy",
    provider: "fal",
    falPath: "fal-ai/birefnet/v2",
    description: "High-res dichotomous segmentation (previous default).",
    approxCost: "compute",
    solidBackground: false,
  },
  {
    id: "birefnet-v2-light",
    label: "BiRefNet v2 Light",
    provider: "fal",
    falPath: "fal-ai/birefnet/v2",
    description: "Faster BiRefNet variant.",
    approxCost: "compute",
    solidBackground: false,
  },
  {
    id: "birefnet-v2-matting",
    label: "BiRefNet v2 Matting",
    provider: "fal",
    falPath: "fal-ai/birefnet/v2",
    description: "Softer alpha for semi-transparent edges.",
    approxCost: "compute",
    solidBackground: false,
  },
  {
    id: "imageutils-rembg",
    label: "fal imageutils rembg",
    provider: "fal",
    falPath: "fal-ai/imageutils/rembg",
    description: "Cheap baseline rembg.",
    approxCost: "compute",
    solidBackground: false,
  },
  {
    id: "photoroom-segment",
    label: "PhotoRoom Segment",
    provider: "photoroom",
    falPath: null,
    description: "PhotoRoom proprietary remover (needs PHOTOROOM_API_KEY).",
    approxCost: "~$0.02",
    solidBackground: true,
  },
] as const;

export function getFalBgModel(id: string): FalBgModelDef | undefined {
  return FAL_BG_MODELS.find((m) => m.id === id);
}

export function buildFalInput(
  model: FalBgModelDef,
  imageUrl: string,
  width: number,
  height: number
): Record<string, unknown> {
  switch (model.id) {
    case "pixelcut-product-photo":
      return {
        image_url: imageUrl,
        image_size: { width, height },
        background: {
          mode: "Color",
          color: { r: 255, g: 255, b: 255 },
        },
        margin: { all: "0%" },
        output_format: "png",
        sync_mode: false,
      };
    case "pixelcut-background-removal":
      return {
        image_url: imageUrl,
        output_format: "rgba",
        sync_mode: false,
      };
    case "bria-rmbg-2":
    case "ideogram-remove-background":
    case "imageutils-rembg":
      return { image_url: imageUrl };
    case "birefnet-v2-heavy":
      return {
        image_url: imageUrl,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048",
        refine_foreground: true,
        output_format: "png",
      };
    case "birefnet-v2-light":
      return {
        image_url: imageUrl,
        model: "General Use (Light)",
        operating_resolution: "2048x2048",
        refine_foreground: true,
        output_format: "png",
      };
    case "birefnet-v2-matting":
      return {
        image_url: imageUrl,
        model: "Matting",
        operating_resolution: "2048x2048",
        refine_foreground: true,
        output_format: "png",
      };
    case "photoroom-segment":
      return {};
    default: {
      const _exhaustive: never = model.id;
      return _exhaustive;
    }
  }
}

export function extractFalImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as {
    image?: { url?: string };
    images?: Array<{ url?: string }>;
  };
  return obj.image?.url ?? obj.images?.[0]?.url ?? null;
}
