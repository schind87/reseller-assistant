import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(
  path.join(root, "extension", "closet-sync.js"),
  "utf8"
);

const location = new URL("https://poshmark.com/closet/maracloset84");
const ctx = {
  location,
  document: { title: "Mara's Closet", querySelector() { return null; } },
  window: { setTimeout, location },
  URL,
  Set,
  Map,
  WeakSet,
  JSON,
  console,
};
ctx.globalThis = ctx;
ctx.window.URL = URL;
vm.runInNewContext(src, ctx);

const {
  raParseEmbeddedJson,
  raWalkJsonListings,
  raMarketplaceItemUrl,
  raParsePrice,
  raRecordListingUrl,
} = ctx;

function assert(name, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    throw new Error(
      `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

if (typeof raParseEmbeddedJson !== "function") {
  throw new Error("raParseEmbeddedJson is missing from closet-sync.js");
}

const embedded = raParseEmbeddedJson(
  `window.__INITIAL_STATE__={"$_closet":{"listingsPostData":{"data":[{"id":"abc123","title":"Nike tee","canonical_url":"https://poshmark.com/listing/Nike-tee-abc123","price_amount":{"val":"18.00"},"inventory":{"status":"available"},"cover_shot":{"url_small":"https://poshmark.com/img/small.jpg"}}]}}};(function(){var s;s=document.currentScript;})();`
);
if (!embedded?.$_closet) {
  throw new Error("failed to parse window.__INITIAL_STATE__ assignment");
}

const seen = new Set();
const listings = [];
raWalkJsonListings(embedded, seen, listings, 0);
assert("embedded listing count", listings.length, 1);
assert("embedded listing url", listings[0].url, "https://poshmark.com/listing/Nike-tee-abc123");
assert("embedded listing title", listings[0].title, "Nike tee");
assert("embedded listing price", listings[0].price, 18);
assert("embedded listing status", listings[0].status, "active");

const rawJson = raParseEmbeddedJson(
  JSON.stringify({
    listings: [
      {
        id: "m1",
        title: "Coat",
        url: "https://www.mercari.com/us/item/m1",
        price: 42,
        status: "active",
      },
    ],
  })
);
const mercariSeen = new Set();
const mercariListings = [];
raWalkJsonListings(rawJson, mercariSeen, mercariListings, 0);
assert("mercari listing count", mercariListings.length, 1);
assert(
  "mercari listing url",
  mercariListings[0].url,
  "https://www.mercari.com/us/item/m1"
);

assert(
  "poshmark listing url",
  raMarketplaceItemUrl("/listing/Foo-bar-99"),
  "https://poshmark.com/listing/Foo-bar-99"
);
assert(
  "ignore app-store listing query",
  raMarketplaceItemUrl(
    "https://apps.apple.com/app?link_location=%2Flisting%2FFoo"
  ),
  null
);
assert("price object string val", raParsePrice({ val: "29.00" }), 29);
assert("invalid json prefix", raParseEmbeddedJson("not json"), null);

const poshNoUrl = {
  id: "6aa5b133d78df104a9189ca2",
  title: "Tommy Bahama Men's Blue Tropical Print Shirt Size Large",
  price_amount: { val: "35.0" },
  inventory: { status: "available" },
  cover_shot: {
    url_small: "https://di2ponv0v5otw.cloudfront.net/posts/s.jpg",
  },
};
const synthesized = raRecordListingUrl(poshNoUrl);
assert(
  "synthesize poshmark listing url",
  synthesized,
  "https://poshmark.com/listing/Tommy-Bahama-Men-s-Blue-Tropical-Print-Shirt-Size-Large-6aa5b133d78df104a9189ca2"
);

const postDataSeen = new Set();
const postDataListings = [];
raWalkJsonListings(
  {
    $_closet: {
      listingsPostData: { data: [poshNoUrl] },
    },
  },
  postDataSeen,
  postDataListings,
  0
);
assert("listingsPostData without url", postDataListings.length, 1);
assert(
  "listingsPostData id",
  postDataListings[0].externalId,
  "6aa5b133d78df104a9189ca2"
);

const cyclic = { title: "skip me" };
cyclic.self = cyclic;
const cyclicListings = [];
raWalkJsonListings(cyclic, new Set(), cyclicListings, 0);
assert("cyclic json walk", cyclicListings.length, 0);

console.log(`ok closet-sync ${listings.length + mercariListings.length} listings`);
console.log("ok embedded INITIAL_STATE parse");
console.log("ok marketplace urls and prices");
