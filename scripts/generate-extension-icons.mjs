import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "extension", "icons");

function iconSvg(size) {
  const r = Math.round(size * 0.22);
  const pad = Math.round(size * 0.22);
  const inner = size - pad * 2;
  const line = Math.max(2, Math.round(size * 0.08));
  const gap = Math.round(size * 0.1);
  const y1 = pad + Math.round(inner * 0.18);
  const y2 = y1 + line + gap;
  const y3 = y2 + line + gap;
  const wWide = inner;
  const wMid = Math.round(inner * 0.72);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#1f5c4a"/>
  <rect x="${pad}" y="${y1}" width="${wWide}" height="${line}" rx="${line / 2}" fill="#f7f4ef"/>
  <rect x="${pad}" y="${y2}" width="${wMid}" height="${line}" rx="${line / 2}" fill="#e4efe9"/>
  <rect x="${pad}" y="${y3}" width="${Math.round(inner * 0.5)}" height="${line}" rx="${line / 2}" fill="#e4efe9"/>
</svg>`;
}

await mkdir(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const dest = path.join(outDir, `icon-${size}.png`);
  await sharp(Buffer.from(iconSvg(size))).png().toFile(dest);
  console.log(`Wrote ${dest}`);
}
