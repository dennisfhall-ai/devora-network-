# Devora nonproduction API — operator and security-review guide

**Scope:** PR #5, claim #6. This is a candidate guide and does not authorize a merge, production deployment, banking activity, or token issuance.

## Purpose and current limitations
Devora's HTTP prototype now requires a verified RS256 bearer token for all project/application operations and uses a durable SQLite registry. It binds to `127.0.0.1` only. `GET /health` remains public locally and reports `environment: prototype, mainnet: false`; project/application operations are authenticated and subject-scoped. The API does not implement identity-provider discovery, trusted key rotation, token revocation, distributed deployments, financial operations, public internet ingress, or backup/restore automation.

## Required configuration
Never commit an identity provider's signing key, service credentials, bearer tokens, or customer records.

| Environment variable | Purpose |
| --- | --- |
| `DEVORA_DB_PATH` | Path to a writable, persistent SQLite database file on approved storage. The server rejects `:memory:` and `file:` URI forms. |
| `DEVORA_IDENTITY_PUBLIC_KEY` | Trusted issuer's PEM RSA public key (at least 2048 bits). Only the **public** key belongs in configuration. |
| `DEVORA_IDENTITY_ISSUER` | Exact trusted `iss` claim. |
| `DEVORA_IDENTITY_AUDIENCE` | Exact trusted `aud` claim for this API. |
| `PORT` | Local listening port (optional, defaults to 3000). |

The startup path fails closed if the database path, issuer, audience or RSA key is missing or invalid. It does not provision credentials automatically.

## Verification steps

1. Pin the exact candidate head SHA from PR #5; the commit changes whenever source or documentation changes.
2. On an isolated local runner with Node.js 22+, run `npm test`. The suite covers authenticated endpoints, forged or expired JWTs, wrong issuer and audience, owner-scope isolation, concurrent duplicate grant requests, restart persistence, invalid identity keys, volatile storage rejection, and early HTTP 413 during an unfinished upload.
3. Check the GitHub Actions run for that **same** head SHA. A prior commit's success cannot justify merging a changed candidate.
4. Confirm no unauthenticated project/application listing is reachable, and no caller-provided `ownerId` or `applicantId` can change the authenticated subject.
5. Record independent human security review of the exact diff, including issuer/key provisioning and rotation requirements, subject isolation, API boundary handling, data backups, and release controls. Copilot's report of no open findings is not a human approval.
6. Obtain founder-authorized merge after independent assurance; rerun validation on merged `main`. Production use requires a separate deployment and operational review.

## SLRA dispatch boundaries

SLRA's existing Railway repair host polls specifically labelled `slra-mission` GitHub issues on allowlisted **private** repositories, with an active `agent-claim` and a failing test baseline. Devora's passing, public GitHub repository is not eligible for that repair path. A real Devora verification run can already be evidenced through GitHub Actions, but that is **not** the same as an authenticated SLRA worker receipt. Add a dedicated independently reviewed read-only SLRA verification intake or explicitly authorized repository onboarding; do not weaken host admission rules or assert that a GitHub issue comment started a worker.

## Release exclusions

No public deployment, banking or payments, grant disbursements, token issuance, spending, identity-provider change, security-key provisioning, or mainnet integration is approved as part of PR #5.
