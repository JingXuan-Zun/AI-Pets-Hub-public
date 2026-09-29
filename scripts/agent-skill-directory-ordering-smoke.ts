import assert from 'node:assert/strict';
import { orderAgentSkillDirectoryEntries } from '../src/agent/agentSkillDirectoryOrdering';

const imported = Object.freeze([
  { id: 'external.latest' },
  { id: 'external.earlier' },
]);
const bundled = Object.freeze([
  { id: 'builtin.first' },
  { id: 'builtin.second' },
]);
const ordered = orderAgentSkillDirectoryEntries(imported, bundled);
assert.deepEqual(ordered.map((entry) => entry.id), [
  'external.latest',
  'external.earlier',
  'builtin.first',
  'builtin.second',
]);
assert.deepEqual(imported.map((entry) => entry.id), ['external.latest', 'external.earlier']);
assert.deepEqual(bundled.map((entry) => entry.id), ['builtin.first', 'builtin.second']);

console.log('agent skill directory ordering smoke passed');
