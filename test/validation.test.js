import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/core.js';

test('rejects oversized title', () => {
 const r = createRegistry();
 assert.throws(() => r.submitProject({ title: 'x'.repeat(121), description: 'ok' }, { subject: 'a', verified: true }));
 assert.equal(r.listProjects().length, 0);
});
