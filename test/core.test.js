import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/core.js";

test("submission and application create immutable audit trail", () => {
  const r = createRegistry();
  const p = r.submitProject({ title: "Model evaluation", description: "Test AI outputs", ownerId: "dev1" });
  const a = r.applyForGrant({ projectId: p.id, applicantId: "dev1", statement: "Need compute credits" });
  assert.equal(a.status, "pending_review");
  assert.deepEqual(r.auditLog().map(e => e.type), ["project.submitted", "grant.applied"]);
  assert.throws(() => r.applyForGrant({ projectId: p.id, applicantId: "dev1", statement: "Repeat" }), /Duplicate/);
  assert.throws(() => r.applyForGrant({ projectId: p.id, applicantId: "stranger", statement: "Takeover" }), /own/);
});
test("rejects malformed submissions and unknown projects", () => {
  const r = createRegistry();
  assert.throws(() => r.submitProject({ title: "", description: "x", ownerId: "dev" }), /Invalid/);
  assert.throws(() => r.applyForGrant({ projectId: "missing", applicantId: "dev", statement: "x" }), /Invalid/);
});
