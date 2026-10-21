import { createServer } from "node:http";
import { createPublicKey } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPersistentRegistry } from "./persistent-registry.js";
import { verifyIdentityToken } from "./identity.js";

const MAX_BODY_BYTES = 8192;
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function send(res, status, payload) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(payload));
}

function readJson(req, limit) {
  if (!/^application\\/json(?:\\s*;|\\s*$)/i.test(String(req.headers["content-type"] || ""))) {
    return Promise.resolve({ status: 415, error: "JSON content type required" });
  }
  return new Promise((resolve) => {
    const parts = [];
    let bytes = 0;
    let settled = false;
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
      req.removeListener("aborted", onAborted);
    };
    const finish = (result, stopReading = false) => {
      if (settled) return;
      settled = true;
      if (stopReading) req.pause(); // Do not consume the remaining untrusted upload.
      cleanup();
      resolve(result);
    };
    const onData = (part) => {
      bytes += part.byteLength;
      if (bytes > limit) {
        return finish({ status: 413, error: "Payload too large" }, true);
      }
      parts.push(part);
    };
    const onEnd = () => {
      try {
        const data = JSON.parse(Buffer.concat(parts).toString("utf8"));
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("JSON object required");
        if (Object.hasOwn(data, "ownerId") || Object.hasOwn(data, "applicantId")) {
          return finish({ status: 400, error: "Caller-supplied identity is not accepted" });
        }
        finish({ data });
      } catch {
        finish({ status: 400, error: "Invalid JSON object" });
      }
    };
    const onError = () => finish({ status: 400, error: "Invalid request body" });
    const onAborted = () => finish({ status: 400, error: "Request aborted" });
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    req.once("aborted", onAborted);
  });
}

function authenticate(req, identity) {
  const header = String(req.headers.authorization || "");
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) return null;
  try { return verifyIdentityToken(match[1], identity); } catch { return null; }
}

/**
 * Prototype API: all project/application operations require a verified RS256 JWT,
 * and all records are stored in the local SQLite registry with owner scoping.
 *
 * Production deployment requires an external trusted identity provider, explicit
 * database persistence/backup configuration, and independent release assurance.
 */
export function createDevoraServer({ databasePath, identity, maxBodyBytes = MAX_BODY_BYTES } = {}) {
  if (!identity || !["publicKeyPem", "issuer", "audience"].every(key => typeof identity[key] === "string" && identity[key].length > 0)) {
    throw new TypeError("Trusted identity configuration required");
  }
  // Reject unsupported or unusable keys before the API reports healthy.
  let key;
  try { key = createPublicKey(identity.publicKeyPem); }
  catch { throw new TypeError("Valid RSA public key required"); }
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new TypeError("RSA public key of at least 2048 bits required");
  }
  if (typeof databasePath !== "string" || !databasePath.trim()) throw new TypeError("Database path required");
  // Reject in-memory SQLite database identifiers: an accidental transient store must never
  // masquerade as durable production storage.
  if (databasePath.trim() === ":memory:" || /^file:/i.test(databasePath.trim())) {
    throw new TypeError("A persistent database file path is required");
  }
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 256 || maxBodyBytes > 65536) throw new TypeError("Invalid body limit");
  const registry = createPersistentRegistry(databasePath);

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { status: "ok", environment: "prototype", mainnet: false });
    }
    const listProjects = req.method === "GET" && req.url === "/projects";
    const listApplications = req.method === "GET" && req.url === "/applications";
    const createProject = req.method === "POST" && req.url === "/projects";
    const createApplication = req.method === "POST" && req.url === "/applications";
    if (!(listProjects || listApplications || createProject || createApplication)) {
      return send(res, 404, { error: "Not found" });
    }

    const principal = authenticate(req, identity);
    if (!principal) return send(res, 401, { error: "Authentication required" });
    try {
      if (listProjects) return send(res, 200, registry.listOwnProjects(principal));
      if (listApplications) return send(res, 200, registry.listOwnApplications(principal));
      const body = await readJson(req, maxBodyBytes);
      if (body.status === 413) res.shouldKeepAlive = false;
      if (body.status) return send(res, body.status, { error: body.error });
      const result = createProject
        ? registry.submitProject(body.data, principal)
        : registry.applyForGrant(body.data, principal);
      return send(res, 201, result);
    } catch (error) {
      if (/UNIQUE constraint failed/.test(String(error?.message))) return send(res, 409, { error: "Application already exists" });
      if (error?.message === "Project unavailable to applicant") return send(res, 404, { error: "Project unavailable" });
      if (error instanceof TypeError) return send(res, 400, { error: "Invalid request" });
      return send(res, 500, { error: "Internal request failure" });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.once("close", () => registry.close());
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new TypeError("Invalid port");
    const server = createDevoraServer({
      databasePath: process.env.DEVORA_DB_PATH,
      identity: {
        publicKeyPem: String(process.env.DEVORA_IDENTITY_PUBLIC_KEY || "").replace(/\\n/g, "\n"),
        issuer: process.env.DEVORA_IDENTITY_ISSUER,
        audience: process.env.DEVORA_IDENTITY_AUDIENCE
      }
    });
    server.listen(port, "127.0.0.1", () => console.log("Devora authenticated prototype on localhost:" + port));
  } catch {
    console.error("Devora refused startup: trusted identity and persistent storage configuration are required.");
    process.exitCode = 1;
  }
}
