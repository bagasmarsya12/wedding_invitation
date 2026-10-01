import assert from "node:assert/strict";
import test from "node:test";
import { GIFT_COLLECTIONS, giftCollection } from "../lib/gift-collections.ts";

test("gift collection links accept only the three stored categories", () => {
  assert.deepEqual(GIFT_COLLECTIONS.map(({key}) => key), ["bagas", "iga", "home"]);
  for (const {key} of GIFT_COLLECTIONS) assert.equal(giftCollection(key), key);
  for (const value of [undefined, null, "unknown", "<script>", ["home"], {}, "HOME"]) {
    assert.equal(giftCollection(value), "bagas");
  }
});
