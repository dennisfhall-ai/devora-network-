#!/usr/bin/env node
/**
 * Devora CI tested-revision contract. Not an SLRA worker receipt or release grant.
 * All GitHub-provided values are checked again against the checked-out Git SHA.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SHA = /^[a-f0-9]{40}$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const REPO = 'dennisfhall-ai/devora-network-';

const deny = (reason) => { throw new Error(reason); };
const isPositiveInteger = (value) => INTEGER.test(String(value ?? '')) &&
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

/**
 * Pure admission predicate. Required for both before-test and receipt stages.
 * GitHub's run/job head_sha by itself is not evidence of the checked-out tree.
 */
export function verifyTestedRevision(env, actualSha) {
  if (env.GITHUB_REPOSITORY !== REPO) deny('Unexpected GitHub repository');
  if (!SHA.test(actualSha || '') || !SHA.test(env.DEVORA_EXPECTED_SHA || '') ||
      actualSha !== env.DEVORA_EXPECTED_SHA) deny('Checked-out SHA does not match intended test revision');
  if (!SHA.test(env.GITHUB_WORKFLOW_SHA || '')) deny('Missing workflow definition SHA');
  if (!isPositiveInteger(env.GITHUB_RUN_ID) || !isPositiveInteger(env.GITHUB_RUN_ATTEMPT))
    deny('Invalid GitHub run identity');

  const event = env.GITHUB_EVENT_NAME;
  let prNumber = null;
  if (event === 'pull_request') {
    if (env.DEVORA_PR_HEAD_REPO !== REPO) deny('Fork or unexpected pull request repository');
    if (!isPositiveInteger(env.DEVORA_PR_NUMBER)) deny('Invalid pull request number');
    prNumber = Number(env.DEVORA_PR_NUMBER);
    if (env.GITHUB_REF !== `refs/pull/${prNumber}/merge`) deny('Unexpected pull request event ref');
  } else if (event === 'push' || event === 'workflow_dispatch') {
    if (env.GITHUB_REF !== 'refs/heads/main') deny('Main-branch verification only');
  } else {
    deny('Unapproved verification event');
  }

  return Object.freeze({
    schema: 'dfh.devora.tested-revision.v1',
    repository: REPO,
    event,
    github_ref: env.GITHUB_REF,
    pull_request_number: prNumber,
    intended_sha: env.DEVORA_EXPECTED_SHA,
    tested_sha: actualSha,
    workflow_definition_sha: env.GITHUB_WORKFLOW_SHA,
    workflow_path: '.github/workflows/devora-verify.yml',
    run_id: String(env.GITHUB_RUN_ID),
    run_attempt: String(env.GITHUB_RUN_ATTEMPT)
  });
}

/** A failed or skipped step MUST NOT be represented as a successful test. */
export function makeNonreleaseReceipt(binding, outcome, exitCode) {
  if (!['success', 'failure', 'skipped', 'cancelled'].includes(outcome))
    deny('Unknown test step outcome');
  if (exitCode !== null && (!Number.isSafeInteger(exitCode) || exitCode < 0 || exitCode > 255))
    deny('Invalid test exit code');
  if (outcome === 'success' && exitCode !== 0)
    deny('Successful test step without a verified zero exit code');
  if (outcome === 'failure' && exitCode === 0)
    deny('Conflicting test outcome and exit code');
  const testStatus = outcome === 'success' && exitCode === 0 ? 'PASS' :
    outcome === 'failure' ? 'FAIL' : 'NOT_COMPLETED';
  return Object.freeze({
    ...binding,
    test_status: testStatus,
    test_step_outcome: outcome,
    test_exit_code: exitCode,
    provenance: 'github-actions-self-reported',
    authenticated_slra_worker_receipt: false,
    independent_security_approval: false,
    production_release_authorized: false
  });
}

export function parseExitCode(text) {
  const trimmed = String(text ?? '').trim();
  if (!INTEGER.test(trimmed) || !Number.isSafeInteger(Number(trimmed)) || Number(trimmed) > 255)
    deny('Invalid recorded test exit code');
  return Number(trimmed);
}

export function getCheckoutSha() {
  const sha = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!SHA.test(sha)) deny('Cannot establish checkout revision');
  return sha;
}

function main(env = process.env, mode = process.argv[2]) {
  if (mode !== 'verify' && mode !== 'receipt') deny('Expected verify or receipt command');
  const binding = verifyTestedRevision(env, getCheckoutSha());
  if (mode === 'verify') {
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, 'tested_sha=' + binding.tested_sha + '\n');
    console.log('Checkout verified against GitHub event: ' + binding.tested_sha);
    return;
  }

  const exitCode = existsSync('devora-test-exit-code.txt')
    ? parseExitCode(readFileSync('devora-test-exit-code.txt', 'utf8')) : null;
  const receipt = makeNonreleaseReceipt(binding, env.DEVORA_TEST_OUTCOME, exitCode);
  writeFileSync('devora-tested-revision-receipt.json', JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log('Recorded non-release test evidence:', receipt.test_status, receipt.tested_sha);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); }
  catch (error) {
    console.error('Devora CI admission/evidence failed: ' + String(error?.message || 'error'));
    process.exitCode = 1;
  }
}
