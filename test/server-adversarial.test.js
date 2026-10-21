import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { createDevoraServer } from "../src/server.js";

const trusted = generateKeyPairSync("rsa", { modulusLength: 2048 });
const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer = "https://identity.devora.test";
const audience = "devora-api";
const identity = { publicKeyPem: trusted.publicKey.export({ type: "spki", format: "pem" }), issuer, audience };

function jwt({ key = trusted.privateKey, sub = "alice", iss = issuer, aud = audience, exp } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ iss, aud, sub, iat: now - 1, exp: exp ?? now + 60 })).toString("base64url");
  const body = h + "." + p;
  return body + "." + sign("RSA-SHA256", Buffer.from(body), key).toString("base64url");
}

async function runServer(callback) {
  const directory = mkdtempSync(join(tmpdir(), "devora-boundary-"));
  const server = createDevoraServer({ databasePath: join(directory, "db.sqlite"), identity });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
}

async function call(base, path, bearer, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: { ...(bearer ? { authorization: "Bearer " + bearer } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: r.status, json: await r.json() };
}

test("rejects forged, expired, wrong-issuer and wrong-audience bearer tokens", async () => {
  await runServer(async base => {
    for (const bearer of [
      jwt({ key: attacker.privateKey }),
      jwt({ exp: Math.floor(Date.now() / 1000) - 5 }),
      jwt({ iss: "https://attacker.invalid" }),
      jwt({ aud: "other-service" }),
      jwt().slice(0, -8) + "modified"
    ]) {
      assert.equal((await call(base, "/projects", bearer)).status, 401);
      assert.equal((await call(base, "/applications", bearer)).status, 401);
    }
    assert.equal((await call(base, "/projects", jwt())).status, 200);
  });
});

test("concurrent grant applications preserve one-row uniqueness and owner privacy", async () => {
  await runServer(async base => {
    const alice = jwt({ sub: "alice" }), bob = jwt({ sub: "bob" });
    const created = await call(base, "/projects", alice, "POST", { title: "Reusable robotics library", description: "Open documentation" });
    assert.equal(created.status, 201);
    const attempts = await Promise.all(Array.from({ length: 12 }, () =>
      call(base, "/applications", alice, "POST", { projectId: created.json.id, statement: "Compute grant" })
    ));
    assert.equal(attempts.filter(x => x.status === 201).length, 1);
    assert.equal(attempts.filter(x => x.status === 409).length, 11);
    assert.equal((await call(base, "/applications", bob)).json.length, 0);
    assert.equal((await call(base, "/projects", bob)).json.length, 0);
    assert.equal((await call(base, "/applications", bob, "POST", { projectId: created.json.id, statement: "Claim" })).status, 404);
    assert.equal((await call(base, "/applications", alice, "POST", { projectId: created.json.id, applicantId: "bob", statement: "Claim" })).status, 400);
    assert.equal((await call(base, "/applications", alice)).json.length, 1);
  });
});
