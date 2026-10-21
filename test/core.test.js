import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/core.js";

const principal = subject => ({ subject, verified: true });
test("verified project owner can submit one grant application", () => {
  const r = createRegistry();
  const p = r.submitProject({ title: "Model evaluation", description: "Test AI outputs" }, principal("dev1"));
  const a = r.applyForGrant({ projectId: p.id, statement: "Need compute credits" }, principal("dev1"));
  assert.equal(a.status, "pending_review");
  assert.deepEqual(r.auditLog().map(e => e.type), ["project.submitted", "grant.applied"]);
  assert.throws(() => r.applyForGrant({ projectId: p.id, statement: "Repeat" }, principal("dev1")), /Duplicate/);
  assert.throws(() => r.applyForGrant({ projectId: p.id, statement: "Takeover" }, principal("stranger")), /own/);
});
test("rejects malformed submissions and unknown projects", () => {
  const r = createRegistry();
  assert.throws(() => r.submitProject({ title: "", description: "x" }, principal("dev")), /Invalid/);
  assert.throws(() => r.applyForGrant({ projectId: "missing", statement: "x" }, principal("dev")), /Invalid/);
});
test("rejects absent or unverified principal", () => {
  const r = createRegistry();
  const data = { title: "Example", description: "Example description", ownerId: "spoofed" };
  assert.throws(() => r.submitProject(data), /Verified principal/);
  assert.throws(() => r.submitProject(data, { subject: "spoofed", verified: false }), /Verified principal/);
  assert.equal(r.listProjects().length, 0);
});
