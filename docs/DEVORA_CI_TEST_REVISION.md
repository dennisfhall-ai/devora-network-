# Devora CI tested revision evidence

## Why this changed

Previously, the pull-request test workflow used the default `actions/checkout` ref. On a `pull_request` event that ref is typically `refs/pull/<number>/merge`, a **synthetic merge commit**, not the candidate PR's immutable head commit. A GitHub Actions job associated with PR head `d1705854...` was therefore testing a different tree. A job's `head_sha` alone cannot establish which checkout was tested.

This file documents the repository-side correction proposed under work claim #11. It is **nonproduction CI**, not a replacement for the Headquarters SLRA verification-intake code owned by claim #319, and does not overlap the separate Base44 platform build.

## Verification semantics

The `.github/workflows/devora-verify.yml` workflow runs on main-branch pushes, same-repository pull requests, and manually dispatched runs selected from `main`. It:

1. Uses immutable commit-pinned `actions/checkout`, `actions/setup-node` and `actions/upload-artifact` actions.
2. For pull requests, checks out `github.event.pull_request.head.sha` **explicitly** instead of GitHub's synthetic merge commit. For main pushes and manual main dispatch, checks out `github.sha`. Fork-origin pull requests fail closed in this candidate.
3. Before any dependency installation or test, verifies actual `git rev-parse --verify HEAD` against that event SHA. It also validates canonical repository, event/ref identity, PR association, workflow-definition SHA, GitHub run ID and run attempt. A mismatch fails the job before tests.
4. Runs `npm test`, retains its integer exit code, and refuses a success-looking receipt if the result is missing or inconsistent.
5. After testing, re-verifies the same checkout revision and writes a **non-release JSON receipt** naming the tested SHA, expected SHA, workflow-definition SHA, PR number, event, run ID, attempt, outcome and exit code. It explicitly records `authenticated_slra_worker_receipt: false`, `independent_security_approval: false`, and `production_release_authorized: false`.
6. Uploads only this JSON receipt and the numeric test exit code. It does **not** upload raw test logs, provider secrets, customer data or any credentials. Test output is still visible in GitHub Actions job logs; tests must never print secrets.

## Limits and review controls

- The receipt is **self-reported GitHub Actions test evidence**, not a cryptographic signature by an independent SLRA worker. Independent verification must inspect the trusted workflow definition at `workflow_definition_sha`, the captured run attempt, the recorded checkout identity and the result.
- PR-head testing does **not** evaluate whether the candidate merges cleanly with the latest main. Branch mergeability and any additional integration suite are separate gates.
- The workflow under review could itself be changed by a PR. The runner's evidence is not a substitute for human review of that changed workflow and the underlying trust boundary.
- A check in progress, failed, skipped or missing its exit code cannot be represented as a successful completed suite.
- No automatic merge, deployment, banking, grant disbursement, token issuance, paid service, Base44 publication or SLRA mission start is authorized by this workflow.
- PR #5 still requires independent qualified human security approval. The Headquarters read-only SLRA intake PR #320 needs independent remediation and a separately authorized deployment before it can produce a genuine Devora observation.
- Changes stay in a feature branch until exact-head GitHub CI, independent non-author review and explicit owner/governance merge authorization.

## Practical confirmation after an authorized merge

In GitHub open **Devora → Actions → Devora verification** and inspect a completed `pull_request` run. The test receipt's `tested_sha` must match the PR head SHA, not the synthetic merge SHA. The receipt's `run_id` and `run_attempt` must match the same Actions run. A passing result means only that the checked-out commit passed the included tests.

The parallel Base44-building chat owns the Devora app UI and product experience. Its integration boundary is tracked in Devora Issue #10. Neither workstream should edit the other's claimed files.
