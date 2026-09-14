import assert from "node:assert/strict";
import test from "node:test";
import { formatChromeStoreChip } from "../src/lib/chrome-store-chip.ts";

const empty = {
  fetchedAt: "2026-09-14T00:00:00.000Z",
  takenDown: false,
  publishedVersion: null,
  publishedState: null,
  submittedVersion: null,
  submittedState: null,
};

test("omits the chip when there is nothing true to say", () => {
  assert.equal(formatChromeStoreChip(empty), null);
  assert.equal(
    formatChromeStoreChip({ ...empty, submittedState: "PENDING_REVIEW" }),
    null
  );
  assert.equal(
    formatChromeStoreChip({
      ...empty,
      submittedState: "NOT_A_REAL_STATE",
      submittedVersion: "1.0",
    }),
    null
  );
});

test("names the live version and an in-review version", () => {
  assert.deepEqual(
    formatChromeStoreChip({
      ...empty,
      publishedVersion: "0.7.0.3",
      publishedState: "PUBLISHED",
      submittedVersion: "0.7.0.8",
      submittedState: "PENDING_REVIEW",
    }),
    { label: "Chrome has 0.7.0.3 · 0.7.0.8 in review", tone: "accent" }
  );
});

test("says in review when that is all we know", () => {
  assert.deepEqual(
    formatChromeStoreChip({
      ...empty,
      submittedVersion: "0.7.0.8",
      submittedState: "PENDING_REVIEW",
    }),
    { label: "0.7.0.8 in review", tone: "accent" }
  );
});

test("says Chrome has the published version", () => {
  assert.deepEqual(
    formatChromeStoreChip({
      ...empty,
      publishedVersion: "0.7.0.3",
      publishedState: "PUBLISHED",
    }),
    { label: "Chrome has 0.7.0.3", tone: "accent" }
  );
});

test("uses danger copy for rejected or taken down", () => {
  assert.deepEqual(
    formatChromeStoreChip({ ...empty, takenDown: true, publishedVersion: "0.7.0.3" }),
    { label: "Taken down on the Store", tone: "danger" }
  );
  assert.deepEqual(
    formatChromeStoreChip({
      ...empty,
      publishedVersion: "0.7.0.3",
      submittedVersion: "0.7.0.8",
      submittedState: "REJECTED",
    }),
    { label: "0.7.0.8 rejected · Chrome has 0.7.0.3", tone: "danger" }
  );
});
