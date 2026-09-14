#!/usr/bin/env node
/**
 * Exit 0 if this git range does not need a What's new update, or already has one.
 * Exit 2 if seller-facing files changed without updating the notes.
 *
 * Usage:
 *   node scripts/check-whats-new.mjs
 *   node scripts/check-whats-new.mjs --base HEAD~1 --head HEAD
 *   node scripts/check-whats-new.mjs --base <sha> --head <sha>
 */
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const NOTES_PREFIXES = [
  "src/content/whats-new.ts",
  "src/app/whats-new/",
  "src/components/WhatsNewView.tsx",
  "public/whats-new/",
  ".agents/skills/whats-new/",
  "scripts/check-whats-new.mjs",
  ".github/workflows/whats-new.yml",
  ".cursor/rules/whats-new.mdc",
];

const USER_FACING_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/lib/",
  "src/content/",
  "extension/",
  "public/",
];

const USER_FACING_IGNORE_PREFIXES = [
  "extension/README.md",
  "extension/STORE.md",
  "extension/store-assets/",
];

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
  },
});

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isZeroSha(sha) {
  return !sha || /^0+$/.test(sha);
}

function resolveRange() {
  const head = values.head || process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
  let base = values.base || process.env.WHATS_NEW_BASE || "";
  if (!base && process.env.GITHUB_EVENT_BEFORE && !isZeroSha(process.env.GITHUB_EVENT_BEFORE)) {
    base = process.env.GITHUB_EVENT_BEFORE;
  }
  if (!base) {
    try {
      base = git(["rev-parse", "HEAD^"]);
    } catch {
      console.log("What's new check skipped — no parent commit to diff.");
      process.exit(0);
    }
  }
  return { base, head };
}

function matchesPrefix(file, prefixes) {
  return prefixes.some(
    (prefix) => file === prefix || file.startsWith(prefix)
  );
}

function isNotesFile(file) {
  return matchesPrefix(file, NOTES_PREFIXES);
}

function isUserFacingFile(file) {
  if (matchesPrefix(file, USER_FACING_IGNORE_PREFIXES)) return false;
  if (isNotesFile(file)) return false;
  return matchesPrefix(file, USER_FACING_PREFIXES);
}

const { base, head } = resolveRange();
let files = [];
try {
  const diff = git(["diff", "--name-only", `${base}...${head}`]);
  files = diff ? diff.split("\n").filter(Boolean) : [];
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`What's new check could not diff ${base}...${head}: ${message}`);
  process.exit(1);
}

const userFacing = files.filter(isUserFacingFile);
const notes = files.filter(isNotesFile);

if (userFacing.length === 0) {
  console.log(
    `What's new check skipped — no seller-facing files in ${base.slice(0, 7)}...${head.slice(0, 7)}.`
  );
  process.exit(0);
}

if (notes.length > 0) {
  console.log(
    `What's new check ok — seller-facing files changed and notes files also changed.\n` +
      userFacing.map((file) => `  facing  ${file}`).join("\n") +
      "\n" +
      notes.map((file) => `  notes   ${file}`).join("\n")
  );
  process.exit(0);
}

console.error(
  [
    "What's new notes are missing for this ship.",
    "Seller-facing files changed, but src/content/whats-new.ts (and friends) did not.",
    "Add a short item in src/content/whats-new.ts. Follow .agents/skills/whats-new/SKILL.md.",
    "Screenshots go in public/whats-new/ and open in the page lightbox — do not link raw image URLs.",
    "",
    "Changed files:",
    ...userFacing.map((file) => `  ${file}`),
    "",
    "To auto-write notes from GitHub Actions, set repo secret CURSOR_API_KEY.",
    "Or create the Cursor automation (Push to main) using .agents/skills/whats-new/automation-prompt.md.",
  ].join("\n")
);
process.exit(2);
