import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/agentRunController.ts');

assert.match(source, /markRendererDiagnosticContext\('agent-progress'/u);
assert.match(source, /const updateStartedAt = performance\.now\(\)/u);
assert.match(source, /const updateDurationMs = performance\.now\(\) - updateStartedAt/u);
assert.match(source, /if \(updateDurationMs >= 32\)/u);
assert.match(source, /Agent progress store update was slow/u);

console.log('agent progress store performance diagnostics smoke ok');
