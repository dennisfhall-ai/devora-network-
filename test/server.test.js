import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { once } from "node:events";
import { createDevoraServer } from "../src/server.js";

const keypair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const identity = {
  publicKeyPem: keypair.publicKey.export({ type: "spki", format: "pem" }),
  issuer: "https://id.devora.test",
  audience: "devora-api"
};
function token(subject) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({
    iss: identity.issuer, aud: identity.audience, sub: subject, iat: now, exp: now + 3600
  })).toString("base64url");
  const body = h + "." + p;
  return body + "." + sign("RSA-SHA256", Buffer.from(body), keypair.privateKey).toString("base64url");
}
async function listening(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}
async function stop(server) {
  if (!server.listening) return;
  const closed = once(server, "close");
  server.close();
  await closed;
}
async function request(base, path, { principal, method = "GET", body, contentType = "application/json" } = {}) {
  const headers = { ...(principal ? { authorization: "Bearer " + token(principal) } : {}) };
  if (body !== undefined) headers["content-type"] = contentType;
  const response = await fetch(base + path, {
    method, headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

test("API fails closed without trusted identity and persistent database path", () => {
  assert.throws(() => createDevoraServer({ databasePath: ":memory:" }), /identity/);
  assert.throws(() => createDevoraServer({ identity }), /Database path/);
  assert.throws(() => createDevoraServer({ identity, databasePath: ":memory:" }), /persistent database/);
  assert.throws(() => createDevoraServer({ identity, databasePath: "file::memory:?cache=shared" }), /persistent database/);
});
test("API verifies bearer tokens, enforces private ownership, and persists records", async () => {
  const dir = mkdtempSync(join(tmpdir(), "devora-server-"));
  const filename = join(dir, "devora.sqlite");
  let server;
  try {
    server = createDevoraServer({ databasePath: filename, identity });
    let base = await listening(server);
    assert.deepEqual((await request(base, "/health")).json, { status: "ok", environment: "prototype", mainnet: false });
    assert.equal((await request(base, "/projects")).status, 401);
    assert.equal((await request(base, "/applications")).status, 401);
    assert.equal((await request(base, "/audit", { principal: "alice" })).status, 404);
    let result = await request(base, "/projects", { method: "POST", principal: "alice", body: { title: "AI model", description: "Research", ownerId: "bob" } });
    assert.equal(result.status, 400);
    result = await request(base, "/projects", { method: "POST", principal: "alice", body: { title: "AI model", description: "Research" } });
    assert.equal(result.status, 201);
    assert.equal(result.json.ownerId, identity.issuer + "|alice");
    const projectId = result.json.id;
    assert.equal((await request(base, "/projects", { principal: "bob" })).json.length, 0);
    assert.equal((await request(base, "/projects", { principal: "alice" })).json.length, 1);
    assert.equal((await request(base, "/applications", { method: "POST", principal: "bob", body: { projectId, statement: "Steal" } })).status, 404);
    result = await request(base, "/applications", { method: "POST", principal: "alice", body: { projectId, statement: "Request compute" } });
    assert.equal(result.status, 201);
    assert.equal((await request(base, "/applications", { method: "POST", principal: "alice", body: { projectId, statement: "Repeat" } })).status, 409);
    assert.equal((await request(base, "/applications", { principal: "bob" })).json.length, 0);
    assert.equal((await request(base, "/applications", { principal: "alice" })).json.length, 1);
    assert.equal((await request(base, "/projects", { method: "POST", principal: "alice", body: "not-json" })).status, 400);
    assert.equal((await request(base, "/projects", { method: "POST", principal: "alice", body: "x".repeat(9000) })).status, 413);
    assert.equal((await request(base, "/projects", { method: "POST", principal: "alice", contentType: "text/plain", body: "{}" })).status, 415);
    await stop(server);
    server = createDevoraServer({ databasePath: filename, identity });
    base = await listening(server);
    assert.equal((await request(base, "/projects", { principal: "alice" })).json[0].id, projectId);
    assert.equal((await request(base, "/applications", { principal: "alice" })).json.length, 1);
  } finally {
    if (server) await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("startup rejects malformed or non-RSA identity keys before opening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "devora-keys-"));
  try {
    const path = join(dir, "store.sqlite");
    assert.throws(() => createDevoraServer({ databasePath: path, identity: { ...identity, publicKeyPem: "not-a-public-key" } }), /RSA public key/);
    const { publicKey: ecPublicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    assert.throws(() => createDevoraServer({ databasePath: path, identity: { ...identity, publicKeyPem: ecPublicKey.export({ type: "spki", format: "pem" }) } }), /RSA public key/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an oversized streaming request receives 413 before the client finishes uploading", async () => {
  const { request: httpRequest } = await import("node:http");
  const dir = mkdtempSync(join(tmpdir(), "devora-stream-"));
  const server = createDevoraServer({ databasePath: join(dir, "store.sqlite"), identity, maxBodyBytes: 512 });
  try {
    const base = await listening(server);
    const { hostname, port } = new URL(base);
    const status = await new Promise((resolve, reject) => {
      const req = httpRequest({ hostname, port, method: "POST", path: "/projects", headers: {
        authorization: "Bearer " + token("alice"),
        "content-type": "application/json",
        "transfer-encoding": "chunked"
      } }, response => {
        resolve(response.statusCode);
        response.resume();
      });
      req.on("error", reject);
      req.write("x".repeat(1024)); // Leave the upload open; server must not await EOF.
    });
    assert.equal(status, 413);
  } finally {
    // Connections can be half-open after early rejection. Force-close test connections.
    server.closeAllConnections();
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
