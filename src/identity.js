import { createPublicKey, verify } from "node:crypto";

const decode = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid token encoding");
  return Buffer.from(value, "base64url");
};
const json = (value) => JSON.parse(decode(value).toString("utf8"));

/**
 * Validate a provider-issued RS256 JWT using a pinned public key.
 * Public key, issuer and audience must come from trusted server configuration.
 * Does not implement discovery, key rotation, replay prevention or OIDC login.
 */
export function verifyIdentityToken(token, { publicKeyPem, issuer, audience, now = Math.floor(Date.now() / 1000) }) {
  if (typeof token !== "string" || token.length > 16384) throw new Error("Invalid token");
  if (![publicKeyPem, issuer, audience].every(x => typeof x === "string" && x.length > 0)) throw new Error("Identity configuration required");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [head, payload, signature] = parts;
  const header = json(head);
  if (header.alg !== "RS256" || header.typ !== "JWT" || header.crit !== undefined) throw new Error("Unsupported token header");
  const validSignature = verify("RSA-SHA256", Buffer.from(head + "." + payload), createPublicKey(publicKeyPem), decode(signature));
  if (!validSignature) throw new Error("Invalid token signature");
  const claims = json(payload);
  if (claims.iss !== issuer || !(claims.aud === audience || (Array.isArray(claims.aud) && claims.aud.includes(audience) && claims.azp === audience))) throw new Error("Invalid token audience or issuer");
  if (!Number.isInteger(claims.exp) || claims.exp <= now || !Number.isInteger(claims.iat) || claims.iat > now + 60 || (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now))) throw new Error("Token expired or not yet valid");
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 128) throw new Error("Invalid subject");
  return Object.freeze({ subject: issuer + "|" + claims.sub, verified: true });
}
