import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { verifyTestedRevision, makeNonreleaseReceipt, parseExitCode } from '../scripts/devora-ci-revision.mjs';

const cwd = dirname(fileURLToPath(import.meta.url));
const triggerWorkflow = readFileSync(resolve(cwd, '../.github/workflows/devora-verify.yml'), 'utf8');
const workflow = readFileSync(resolve(cwd, '../.github/workflows/devora-trusted-verify.yml'), 'utf8');
const SOURCE_SHA = 'a'.repeat(40);
const WORKFLOW_SHA = 'b'.repeat(40);
const otherSHA = 'c'.repeat(40);
const repo = 'dennisfhall-ai/devora-network-';

function event(overrides = {}) {
  return {
    GITHUB_REPOSITORY: repo,
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_REF: 'refs/pull/5/merge',
    GITHUB_WORKFLOW_SHA: WORKFLOW_SHA,
    GITHUB_RUN_ID: '39691931766',
    GITHUB_RUN_ATTEMPT: '2',
    DEVORA_EXPECTED_SHA: SOURCE_SHA,
    DEVORA_PR_HEAD_REPO: repo,
    DEVORA_PR_NUMBER: '5',
    ...overrides
  };
}
test('PR admission binds tested checkout to exact event PR head, not merge commit', () => {
  const result = verifyTestedRevision(event(), SOURCE_SHA);
  assert.equal(result.tested_sha, SOURCE_SHA);
  assert.equal(result.intended_sha, SOURCE_SHA);
  assert.equal(result.workflow_definition_sha, WORKFLOW_SHA);
  assert.equal(result.run_attempt, '2');
  assert.equal(result.pull_request_number, 5);
  assert.equal(result.authenticated_slra_worker_receipt, undefined);
  assert.throws(() => verifyTestedRevision(event(), otherSHA), /Checked-out SHA/);
});

test('deny unexpected repository, fork, PR number and ref substitutions', () => {
  for (const [override, message] of [
    [{ GITHUB_REPOSITORY: 'another-owner/devora-network-' }, /repository/i],
    [{ DEVORA_PR_HEAD_REPO: 'attacker/fork' }, /Fork/],
    [{ DEVORA_PR_NUMBER: 'invalid' }, /request number/],
    [{ GITHUB_REF: 'refs/pull/6/merge' }, /event ref/],
    [{ GITHUB_REF: 'refs/pull/5/head' }, /event ref/],
    [{ DEVORA_EXPECTED_SHA: otherSHA }, /Checked-out SHA/],
    [{ GITHUB_WORKFLOW_SHA: 'not-a-sha' }, /workflow definition/],
    [{ GITHUB_RUN_ATTEMPT: '0' }, /run identity/],
    [{ GITHUB_RUN_ID: '-1' }, /run identity/],
  ]) assert.throws(() => verifyTestedRevision(event(override), SOURCE_SHA), message);
});

test('deny unknown events and non-main manual or push verification', () => {
  for (const eventName of ['push', 'workflow_dispatch']) {
    const valid = verifyTestedRevision(event({ GITHUB_EVENT_NAME: eventName, GITHUB_REF: 'refs/heads/main' }), SOURCE_SHA);
    assert.equal(valid.pull_request_number, null);
    assert.equal(valid.event, eventName);
    assert.throws(
      () => verifyTestedRevision(event({ GITHUB_EVENT_NAME: eventName, GITHUB_REF: 'refs/heads/feature' }), SOURCE_SHA),
      /Main-branch/
    );
  }
  assert.throws(() => verifyTestedRevision(event({ GITHUB_EVENT_NAME: 'pull_request_target' }), SOURCE_SHA), /Unapproved/);
});

test('nonrelease receipt only passes on an actual successful test exit', () => {
  const binding = verifyTestedRevision(event(), SOURCE_SHA);
  const pass = makeNonreleaseReceipt(binding, 'success', 0);
  assert.equal(pass.test_status, 'PASS');
  assert.equal(pass.test_exit_code, 0);
  assert.equal(pass.authenticated_slra_worker_receipt, false);
  assert.equal(pass.independent_security_approval, false);
  assert.equal(pass.production_release_authorized, false);
  assert.deepEqual(
    ['test_status', 'test_step_outcome', 'test_exit_code', 'run_id', 'run_attempt', 'tested_sha'].map(k => pass[k]),
    ['PASS', 'success', 0, '39691931766', '2', SOURCE_SHA]
  );
  assert.equal(makeNonreleaseReceipt(binding, 'failure', 1).test_status, 'FAIL');
  assert.equal(makeNonreleaseReceipt(binding, 'skipped', null).test_status, 'NOT_COMPLETED');
  assert.equal(makeNonreleaseReceipt(binding, 'cancelled', null).test_status, 'NOT_COMPLETED');
  assert.throws(() => makeNonreleaseReceipt(binding, 'success', null), /zero exit/);
  assert.throws(() => makeNonreleaseReceipt(binding, 'success', 1), /zero exit/);
  assert.throws(() => makeNonreleaseReceipt(binding, 'failure', 0), /Conflicting/);
  assert.throws(() => makeNonreleaseReceipt(binding, 'unknown', 0), /Unknown/);
});

test('recorded exit code parser rejects malformed or implausible values', () => {
  assert.equal(parseExitCode('0\n'), 0);
  assert.equal(parseExitCode('127\n'), 127);
  for (const value of ['foo', '-1', '0x0', '1 2', '', '256', 'Infinity', 'NaN'])
    assert.throws(() => parseExitCode(value), /Invalid recorded/);
});

test('workflow pins real PR head and external actions, and cannot upload raw logs', () => {
  assert.match(triggerWorkflow, /pull_request:/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /DEVORA_EXPECTED_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /GITHUB_WORKFLOW_SHA: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /scripts\/devora-ci-revision\.mjs verify/);
  assert.match(workflow, /scripts\/devora-ci-revision\.mjs receipt/);
  assert.match(workflow, /github\.run_attempt/);
  assert.doesNotMatch(workflow, /devora-test-output\.log/);
  assert.doesNotMatch(workflow, /secrets\./);
});

test('GitHub Actions refuses evidence upload when receipt creation fails', () => {
  const record = workflow.split('      - name: Record test revision, outcome and nonrelease status\n')[1]?.split('      - name: Retain bounded test receipt without raw logs or secrets\n')[0];
  const upload = workflow.split('      - name: Retain bounded test receipt without raw logs or secrets\n')[1];
  assert.ok(record, 'recording step exists');
  assert.ok(upload, 'upload step exists');
  assert.match(record, /(?:^|\n)\s*id: receipt\s*(?:\n|$)/);
  assert.match(record, /steps\.admission\.outcome == 'success'/);
  assert.match(upload, /steps\.admission\.outcome == 'success'/);
  assert.match(upload, /steps\.receipt\.outcome == 'success'/);
  assert.match(upload, /steps\.suite\.outcome != 'skipped'/);
  assert.doesNotMatch(upload, /steps\.suite\.outcome == 'success'/);
  assert.match(upload, /if-no-files-found: error/);
  // The upload condition must depend on successful receipt generation, not merely its existence.
  assert.match(upload, /if: \$\{\{ always\(\) && steps\.admission\.outcome == 'success' && steps\.receipt\.outcome == 'success' && steps\.suite\.outcome != 'skipped' \}\}/);
});

test('the public trigger delegates only to GitHub-attested reusable verification', () => {
  assert.match(triggerWorkflow, /pull_request:/);
  assert.match(triggerWorkflow, /permissions:\n  contents: read/);
  assert.match(triggerWorkflow, /uses: \.\/\.github\/workflows\/devora-trusted-verify\.yml/);
  assert.match(workflow, /workflow_call:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(triggerWorkflow, /npm test/);
  assert.doesNotMatch(triggerWorkflow, /secrets\./);
  assert.doesNotMatch(triggerWorkflow, /actions\/checkout@/);
  assert.match(workflow, /steps\.receipt\.outcome == 'success'/);
  assert.match(workflow, /scripts\/devora-ci-revision\.mjs verify/);
});
