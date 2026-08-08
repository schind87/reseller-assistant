import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "extension");
const liveDir = path.join(root, "extension-live");

const SKIP = new Set([".DS_Store", "Thumbs.db"]);

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "README.md") continue;
    const full = path.join(dir, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      copyRecursive(path.join(from, entry.name), path.join(to, entry.name));
    }
    return;
  }
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing source folder: ${sourceDir}`);
  process.exit(1);
}

emptyDir(liveDir);
copyRecursive(sourceDir, liveDir);

const readme = `# Live unpacked extension

This folder is the Chrome **Load unpacked** target for local development.

Refresh it from \`extension/\` anytime:

\`\`\`bash
npm run extension:live
\`\`\`

\`npm run dev\` also runs that sync before starting Next.js.

## Chrome setup

1. \`chrome://extensions\` → Developer mode on
2. **Load unpacked** → select this \`extension-live\` folder
3. After code changes: \`npm run extension:live\`, then **Reload extension** at the bottom of the side panel

Source of truth remains [\`extension/\`](../extension/). Do not edit files here by hand — they are overwritten by the sync script.
`;

fs.writeFileSync(path.join(liveDir, "README.md"), readme, "utf8");
console.log(`Synced extension → extension-live\nLoad unpacked: ${liveDir}`);
