# Devora verification evidence bridge — NONPRODUCTION

**Scope:** isolated PR under work claim #7, following Founder instruction to continue Devora and SLRA integration. This is a read-only GitHub Actions verifier, **not** the SLRA repair host, and not a credentialed Founder passkey mission.

## What this candidate does

The `.github/workflows/devora-slra-verification.yml` manual-dispatch workflow is limited to repository `dennisfhall-ai/devora-network-`. An authorized GitHub Actions operator supplies `expected_main_sha`: the exact 40-character commit currently at `main`. The workflow checks out `main` without storing credentials, rejects nonmatching SHAs, uses Node.js 22 to run the existing `npm test` command, and creates an audit artifact containing the source commit, requested SHA, GitHub run ID, outcome, exit code (when the suite ran), and sanitized output. The artifact explicitly sets trusted SLRA worker authorization, independent security approval, and production release to **false**.

The workflow requires `contents: read` only. It never modifies a repository, secrets, a database, a deployment, or any protected artifact. It cannot accept a user-supplied shell command, arbitrary repository, branch, or mutable external source.

## Known limitations

- The workflow is **manual** (`workflow_dispatch`) and will not run through the workflow-dispatch UI until the workflow is independently approved and merged to the default branch.
- The artifact is a **GitHub Actions verification record**, not a signed `dfh.slra.sandbox-test.v1` receipt, ZFG verdict, human review, or evidence of live SLRA mission dispatch.
- No repair branch, candidate changes, or deployment is produced.
- The separate Railway `slra-repair-host` is restricted to private allowlisted repositories, valid founder-authored `slra-mission` requests, accepted work claims and a failing baseline. Devora is public and its baseline passed. Do not loosen that repair admission system to force Devora into it.
- The test suite remains a prototype-level assurance control; passing tests cannot establish enterprise security or release readiness.

## Review gates

1. Independent reviewer examines workflow event triggers, immutable checkout/SHA binding, repository identity check, limited permissions, trusted `npm test` command, secret hygiene, artifact content and failure behavior.
2. Confirm normal PR CI for the exact workflow-implementation SHA before any merge proposal.
3. Obtain separate founder/governance permission for merge and confirm there is no collision with PR #5, which modifies different files and still requires independent human security review.
4. Only after a permitted merge, a real authorized operator can manually dispatch against the exact current `main` SHA. Record the GitHub Actions run and verify the artifact and test result.
5. To achieve the original SLRA mission, build and independently review a distinct, authenticated **verification** intake for the repair host or managed runtime, with founder proof, exact target, source pin, a signed worker receipt and explicit banking exclusion. Do not conflate this nonprivileged check with that service.

No banking, payments, token issuance, mainnet, production service activation, or new spending is included.
