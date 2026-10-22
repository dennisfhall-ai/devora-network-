# Devora verification evidence bridge — NONPRODUCTION

**Scope:** isolated PR under work claim #7, following Founder instruction to continue Devora and SLRA integration. This is a read-only GitHub Actions verifier, **not** the SLRA repair host, and not a credentialed Founder passkey mission.

## What this candidate does

The `.github/workflows/devora-slra-verification.yml` manual-dispatch workflow is limited to repository `dennisfhall-ai/devora-network-`. An authorized GitHub Actions operator supplies `expected_main_sha`: the exact 40-character commit currently at `main`. The workflow checks out `main` without storing credentials, requires the workflow dispatch ref to be `refs/heads/main`, and rejects runs unless the selected workflow-definition SHA, the expected-main SHA and the checked-out source SHA all match. It uses Node.js 22 to run the existing `npm test` command and creates a restricted audit artifact containing the source commit, workflow-definition SHA, requested SHA, GitHub run ID, outcome and exit code (when the suite ran). **No test output is stored in the uploaded artifact.** The artifact explicitly sets trusted SLRA worker authorization, independent security approval, and production release to **false**.

The workflow uses immutable full-commit GitHub Action references, including the artifact uploader, and requires `contents: read` only. It never modifies a repository, secrets, a database, a deployment, or any protected artifact. It cannot accept a user-supplied shell command, arbitrary repository, branch, or mutable external source.

## Known limitations

- The workflow is **manual** (`workflow_dispatch`). Only a dispatch selecting `main` with a matching pinned workflow-definition/source SHA can pass admission. Dispatching a feature branch or stale SHA fails before tests. This corrective workflow will not govern manual dispatches until the separate corrective pull request is reviewed and merged.
- Admission failures do **not** produce a success-looking receipt. On admitted runs, the artifact contains metadata and a numeric exit code only. Test stdout/stderr are raw and appear only in the GitHub Actions job logs, where GitHub's secret-masking policy applies; tests still must not emit secrets, sensitive user data, or proprietary values. A manually downloaded artifact should never be considered sanitized test output.
- The artifact is a **GitHub Actions verification record**, not a signed `dfh.slra.sandbox-test.v1` receipt, ZFG verdict, human review, or evidence of live SLRA mission dispatch.
- No repair branch, candidate changes, or deployment is produced.
- The separate Railway `slra-repair-host` is restricted to private allowlisted repositories, valid founder-authored `slra-mission` requests, accepted work claims and a failing baseline. Devora is public and its baseline passed. Do not loosen that repair admission system to force Devora into it.
- The test suite remains a prototype-level assurance control; passing tests cannot establish enterprise security or release readiness.

## Review gates

1. Independent reviewer examines workflow event triggers, matching `GITHUB_REF`, `github.workflow_sha`, and checked-out source SHA, fully pinned external actions, repository identity, limited permissions, trusted `npm test` command, sensitive-output exclusion, artifact content and admission-failure behavior.
2. Confirm normal PR CI for the exact workflow-implementation SHA before any merge proposal.
3. Obtain separate founder/governance permission for merge and confirm there is no collision with PR #5, which modifies different files and still requires independent human security review.
4. Only after a permitted merge, a real authorized operator can manually dispatch against the exact current `main` SHA. Record the GitHub Actions run and verify the artifact and test result.
5. To achieve the original SLRA mission, build and independently review a distinct, authenticated **verification** intake for the repair host or managed runtime, with founder proof, exact target, source pin, a signed worker receipt and explicit banking exclusion. Do not conflate this nonprivileged check with that service.

No banking, payments, token issuance, mainnet, production service activation, or new spending is included.
