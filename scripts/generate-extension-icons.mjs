import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "extension", "icons");
const storeDir = path.join(root, "extension", "store-assets");

const FOREST = "#1f5c4a";
const PAPER = "#f7f4ef";
const PAPER_MID = "#e4efe9";

function bars({ x, y, size, line, gap, fillWide, fillRest }) {
  const pad = Math.round(size * 0.22);
  const inner = size - pad * 2;
  const y1 = y + pad + Math.round(inner * 0.18);
  const y2 = y1 + line + gap;
  const y3 = y2 + line + gap;
  const rx = line / 2;
  return `
    <rect x="${x + pad}" y="${y1}" width="${inner}" height="${line}" rx="${rx}" fill="${fillWide}"/>
    <rect x="${x + pad}" y="${y2}" width="${Math.round(inner * 0.72)}" height="${line}" rx="${rx}" fill="${fillRest}"/>
    <rect x="${x + pad}" y="${y3}" width="${Math.round(inner * 0.5)}" height="${line}" rx="${rx}" fill="${fillRest}"/>`;
}

/** Toolbar icons fill the canvas so 16×16 stays readable. */
function toolbarIconSvg(size) {
  const r = Math.round(size * 0.22);
  const line = Math.max(2, Math.round(size * 0.08));
  const gap = Math.max(1, Math.round(size * 0.1));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${FOREST}"/>
  ${bars({ x: 0, y: 0, size, line, gap, fillWide: PAPER, fillRest: PAPER_MID })}
</svg>`;
}

/**
 * Chrome Web Store 128×128: 96×96 square artwork + 16px transparent padding.
 * Subtle white ring so the dark mark still reads on a dark store background.
 */
function storeIconSvg() {
  const canvas = 128;
  const art = 96;
  const origin = 16;
  const r = Math.round(art * 0.22);
  const line = Math.round(art * 0.08);
  const gap = Math.round(art * 0.1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <rect x="${origin - 1}" y="${origin - 1}" width="${art + 2}" height="${art + 2}" rx="${r + 1}" fill="#ffffff" opacity="0.35"/>
  <rect x="${origin}" y="${origin}" width="${art}" height="${art}" rx="${r}" fill="${FOREST}"/>
  ${bars({ x: origin, y: origin, size: art, line, gap, fillWide: PAPER, fillRest: PAPER_MID })}
</svg>`;
}

function promoSvg() {
  const w = 440;
  const h = 280;
  const art = 132;
  const x = Math.round((w - art) / 2);
  const y = Math.round((h - art) / 2);
  const r = Math.round(art * 0.22);
  const line = Math.round(art * 0.08);
  const gap = Math.round(art * 0.1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${FOREST}"/>
  <rect x="${x}" y="${y}" width="${art}" height="${art}" rx="${r}" fill="#174536"/>
  ${bars({ x, y, size: art, line, gap, fillWide: PAPER, fillRest: PAPER_MID })}
</svg>`;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function captureScreenshot(htmlPath, pngPath) {
  const chrome = await firstExisting([
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ]);
  if (!chrome) {
    throw new Error("Chrome or Edge not found for the 1280×800 screenshot");
  }
  const fileUrl = `file:///${htmlPath.replaceAll("\\", "/")}`;
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1280,800",
    `--screenshot=${pngPath}`,
    "--virtual-time-budget=2000",
    fileUrl,
  ]);
  const image = sharp(pngPath);
  const meta = await image.metadata();
  if (meta.width !== 1280 || meta.height !== 800) {
    await image
      .resize(1280, 800, { fit: "cover", position: "left top" })
      .png()
      .toFile(pngPath);
  }
}

await mkdir(iconsDir, { recursive: true });
await mkdir(storeDir, { recursive: true });

for (const size of [16, 32, 48]) {
  const dest = path.join(iconsDir, `icon-${size}.png`);
  await sharp(Buffer.from(toolbarIconSvg(size))).png().toFile(dest);
  console.log(`Wrote ${dest}`);
}

const storeIcon = storeIconSvg();
const icon128 = path.join(iconsDir, "icon-128.png");
const storeIconOut = path.join(storeDir, "store-icon-128.png");
await sharp(Buffer.from(storeIcon)).png().toFile(icon128);
await sharp(Buffer.from(storeIcon)).png().toFile(storeIconOut);
console.log(`Wrote ${icon128}`);
console.log(`Wrote ${storeIconOut}`);

const promoOut = path.join(storeDir, "promo-440x280.png");
await sharp(Buffer.from(promoSvg())).png().toFile(promoOut);
console.log(`Wrote ${promoOut}`);

const screenshotHtml = path.join(storeDir, "screenshot.html");
const screenshotOut = path.join(storeDir, "screenshot-1280x800.png");
await captureScreenshot(screenshotHtml, screenshotOut);
const shotMeta = await sharp(screenshotOut).metadata();
console.log(`Wrote ${screenshotOut} (${shotMeta.width}×${shotMeta.height})`);
