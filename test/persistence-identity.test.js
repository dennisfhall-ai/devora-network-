import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { createPersistentRegistry } from "../src/persistent-registry.js";
import { verifyIdentityToken } from "../src/identity.js";

test("SQLite data survives reopening and enforces ownership and uniqueness", () => {
  const dir = mkdtempSync(join(tmpdir(), "devora-test-"));
  try {
    const path = join(dir, "registry.sqlite");
    const alice = { subject: "issuer|alice", verified: true };
    const bob = { subject: "issuer|bob", verified: true };
    const first = createPersistentRegistry(path);
    const p = first.submitProject({ title: "AI tool", description: "Evaluation system" }, alice);
    const a = first.applyForGrant({ projectId: p.id, statement: "Compute support" }, alice);
    assert.equal(a.status, "pending_review");
    assert.throws(() => first.applyForGrant({ projectId: p.id, statement: "Again" }, alice), /UNIQUE/);
    assert.throws(() => first.applyForGrant({ projectId: p.id, statement: "Impersonation" }, bob), /unavailable/);
    assert.equal(first.listOwnApplications(bob).length, 0);
    first.close();
    const reopened = createPersistentRegistry(path);
    assert.equal(reopened.listOwnProjects(alice).length, 1);
    assert.equal(reopened.listOwnApplications(alice).length, 1);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RS256 validator accepts signed token and rejects tampering", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "https://issuer.example", aud: "devora", sub: "developer", iat: 100, exp: 500 })).toString("base64url");
  const body = header + "." + payload;
  const signature = sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url");
  const token = body + "." + signature;
  const config = { publicKeyPem: publicKey.export({ type: "spki", format: "pem" }), issuer: "https://issuer.example", audience: "devora", now: 200 };
  assert.equal(verifyIdentityToken(token, config).verified, true);
  assert.throws(() => verifyIdentityToken(token, { ...config, audience: "different" }), /audience/);
  const modified = Buffer.from(JSON.stringify({ iss: config.issuer, aud: config.audience, sub: "attacker", iat: 100, exp: 500 })).toString("base64url");
  assert.throws(() => verifyIdentityToken(header + "." + modified + "." + signature, config), /signature/);
});
