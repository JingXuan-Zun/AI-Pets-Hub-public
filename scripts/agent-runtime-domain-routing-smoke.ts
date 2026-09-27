import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness';

const source = readProjectFile('src/agent/agentProductionSession.ts');
assert.match(source, /isOfficeDevelopmentTask/u);
assert.match(source, /isDeepSeekHarnessConfigured/u);
assert.match(source, /shouldUseHarness/u);
assert.match(source, /computerControlSignals/u);
console.log('agent runtime domain routing smoke ok');
