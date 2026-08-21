import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shared = fs.readFileSync(
  path.join(root, "extension", "coach-shared.js"),
  "utf8"
);
const ctx = {};
vm.runInNewContext(shared, ctx);

const { raListingCacheForId } = ctx;
if (typeof raListingCacheForId !== "function") {
  throw new Error("raListingCacheForId is missing from coach-shared.js");
}

const currentId = "listing-b";
const stale = { id: "listing-a", title: "Old coat" };
const fresh = { id: "listing-b", title: "New dress" };

const cases = [
  ["matching cache", raListingCacheForId(fresh, currentId), fresh],
  ["stale last-used listing", raListingCacheForId(stale, currentId), null],
  ["empty cache", raListingCacheForId(null, currentId), null],
  ["missing id", raListingCacheForId(fresh, ""), null],
  ["numeric id match", raListingCacheForId({ id: 12, title: "x" }, "12"), {
    id: 12,
    title: "x",
  }],
];

for (const [name, actual, expected] of cases) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    throw new Error(
      `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

console.log(`ok ${cases.length} pairing cache cases`);
