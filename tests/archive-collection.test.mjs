import test from "node:test";
import assert from "node:assert/strict";
import { archiveMaterial, parseArchivePosition } from "../lib/archive-collection.ts";

test("archive material reflects the stored type, never a fabricated memory", () => {
  for (const type of ["photograph", "photo", "place"]) assert.equal(archiveMaterial(type),"photo");
  assert.equal(archiveMaterial("mark"),"mark");
  assert.equal(archiveMaterial("object"),"object");
  assert.equal(archiveMaterial("audio"),"audio");
  for (const type of ["conversation", "note", "other", "unrecognized"]) assert.equal(archiveMaterial(type),"paper");
});
test("archive return state accepts only recent public browsing coordinates", () => {
  const now=1_000_000;
  const state={filter:"all",selected:"the-mark",scroll:300,savedAt:now};
  const read=value=>parseArchivePosition(JSON.stringify(value),["all","mark"],["the-mark"],now);
  assert.deepEqual(read({...state,privateStory:"must not survive"}),state);
  for (const change of [{filter:"private"},{selected:"unknown"},{scroll:-1},{scroll:"300"},{scroll:1e9},{savedAt:now-1_800_001},{savedAt:now+60_001}]) assert.equal(read({...state,...change}),null);
  assert.equal(parseArchivePosition("not JSON",[],[],now),null);
  assert.equal(parseArchivePosition(null,[],[],now),null);
});
