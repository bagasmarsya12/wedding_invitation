import test from "node:test";
import assert from "node:assert/strict";
import { gardenWindow } from "../lib/garden-window.ts";

test("nearby gardens prepare; far-off rooms do not allocate at the hero", () => {
  assert.deepEqual(gardenWindow(0, 1000, 0, 1000), {prepare:true,retain:true});
  assert.deepEqual(gardenWindow(2000, 1000, 0, 1000), {prepare:true,retain:true});
  assert.deepEqual(gardenWindow(2500, 1000, 0, 1000), {prepare:false,retain:true});
  assert.deepEqual(gardenWindow(5000, 1000, 0, 1000), {prepare:false,retain:false});
});
test("fast jumps and reverse scroll prepare the visible room, without requiring history", () => {
  for (const viewport of [740,844,1000]) {
    for (const scroll of [0,10000,20000,5000,0]) {
      assert.equal(gardenWindow(scroll, 1200, scroll, viewport).prepare, true);
      assert.equal(gardenWindow(scroll-500, 1200, scroll, viewport).retain, true);
    }
  }
});
