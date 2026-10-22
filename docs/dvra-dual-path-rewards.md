# DVRA Dual-Path Rewards — Nonproduction Specification

Status: DESIGN / NOT APPROVED FOR TOKEN ISSUANCE
Maximum lifetime supply: 1,000,000 DVRA (founder authorized)
Chain candidate: Solana Token-2022 (no on-chain action authorized)

## Earning paths
A. Commissioned work: project-scoped deliverables completed using TensorLogic.
B. Independent innovation: original TensorLogic-built software submitted by a verified developer.
Both require objective acceptance criteria, immutable evidence references, and independent SLRA assurance before reward approval.

## Allocation (PROPOSAL ONLY)
The 40% developer allocation (400,000 DVRA) remains unapproved pending founder allocation signoff.
If approved: commissioned 240,000; innovation 120,000; exceptional engineering 40,000.
Never interpret a proposed allocation as permission to issue tokens.

## Lifecycle
SUBMITTED -> EVIDENCE_ATTACHED -> REVIEW_PENDING -> VERIFIED -> REWARD_APPROVED -> DISTRIBUTION_ELIGIBLE.
Any stage may move to REJECTED with reason. VERIFIED requires an independent verifier identity, evidence hash, timestamp, scope, and verification outcome.
DISTRIBUTION_ELIGIBLE is ledger-only and does not mean tokens were transferred.
A separate authorized production process is required for actual distribution.

## Ledger and safety invariants
- Fixed lifetime cap <= 1,000,000 base-token units (account for token decimals precisely).
- Sum of all allocation budgets <= 1,000,000 DVRA.
- Sum of committed and distributed reward liabilities <= the applicable approved pool.
- Idempotency key: project_id + milestone_id + recipient_id + reward_policy_version; innovation uses submission_id in place of project/milestone.
- Reject duplicate claims, self-approval, unauthorized verifiers, stale or missing evidence, negative amounts, and budget overruns.
- Append-only event journal; never rewrite reward history; reverse errors with compensating events.
- No automatic cash valuation, guaranteed conversion, staking, speculative pricing, or token sale.
- No wallet secrets, transfers, mainnet deployment, minting, or live payment operations.

## TensorLogic contract (proposed)
project_id, developer_id, build_job_id, artifact_digest, source_commit, milestone_id, acceptance_criteria_version, completed_at.
Build success alone is not independent verification.

## SLRA contract (proposed)
verification_id, artifact_digest, reviewer_identity, independence_assertion, verdict, evidence_uri, verified_at.
Devora must validate the assurance identity and match artifact digests before any reward approval.

## Test acceptance criteria
1. Both earning paths submit claims and retain evidence.
2. Duplicate idempotency keys cannot create multiple liabilities.
3. Budget exhaustion and >1,000,000 total supply are rejected.
4. Failed or absent SLRA verification blocks approval.
5. Concurrent approvals cannot exceed a pool.
6. Reversal is auditable and cannot erase prior decisions.
7. All token transfer/mint operations are absent from the nonproduction module.

## Release gates
Feature branch -> tests -> independent SLRA review -> founder approval -> merge.
No deployment, spending, minting, transfers, or token sale authorized.
