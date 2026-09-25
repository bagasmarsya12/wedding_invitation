import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken, credentialKey, DUMMY_CREDENTIAL, hashPassword, newSecret, parseCredential,
  readSessionToken, secretFromText, secretToText, verifyPassword,
} from "../lib/admin-auth.ts";

test("password hash: roundtrip, wrong password, unique salts", async () => {
  const credential = await hashPassword("correct horse battery staple");
  assert.equal(credential.iterations, 50_000);
  assert.equal(await verifyPassword("correct horse battery staple", credential), true);
  assert.equal(await verifyPassword("Correct horse battery staple", credential), false);
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(second.salt, credential.salt);
  assert.notEqual(second.hash, credential.hash);
});

test("password hash: custom iteration count, rejects bad counts", async () => {
  const credential = await hashPassword("another decent pass phrase", 25_000);
  assert.equal(credential.iterations, 25_000);
  assert.equal(await verifyPassword("another decent pass phrase", credential), true);
  await assert.rejects(() => hashPassword("x", 100));
});

test("dummy credential never authorizes a real password", async () => {
  assert.equal(await verifyPassword("anything at all", DUMMY_CREDENTIAL), false);
});

test("credential parsing: accepts valid, rejects garbage", () => {
  assert.deepEqual(parseCredential(JSON.stringify(DUMMY_CREDENTIAL)), DUMMY_CREDENTIAL);
  assert.equal(parseCredential(null), null);
  assert.equal(parseCredential("not json"), null);
  assert.equal(parseCredential("{}"), null);
  assert.equal(parseCredential(JSON.stringify({ salt: "short", hash: "x", iterations: 50_000 })), null);
  assert.equal(parseCredential(JSON.stringify({ ...DUMMY_CREDENTIAL, iterations: 5 })), null);
  assert.equal(parseCredential(JSON.stringify({ ...DUMMY_CREDENTIAL, iterations: 9_999_999 })), null);
});

test("session tokens: roundtrip, wrong secret, tampering, expiry", async () => {
  const secret = newSecret();
  const token = await createSessionToken("admin@example.com", secret);
  assert.equal(await readSessionToken(token, secret), "admin@example.com");
  assert.equal(await readSessionToken(token, newSecret()), null);
  const [payload, signature] = token.split(".");
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(await readSessionToken(`${payload}.${flipped}`, secret), null);
  assert.equal(await readSessionToken(`${payload}x.${signature}`, secret), null);
  const expired = await createSessionToken("admin@example.com", secret, Date.now() - 8 * 24 * 60 * 60 * 1000);
  assert.equal(await readSessionToken(expired, secret), null);
  assert.equal(await readSessionToken("garbage", secret), null);
});

test("secret text helpers enforce a sane shape", () => {
  const text = secretToText(newSecret());
  assert.equal(secretFromText(text)?.length, 32);
  assert.equal(secretFromText("short"), null);
  assert.equal(secretFromText("!!!not-base64!!!"), null);
});

test("credential keys are normalized", () => {
  assert.equal(credentialKey(" BagasMarsya13@Gmail.com "), "admin.credential.bagasmarsya13@gmail.com");
});
