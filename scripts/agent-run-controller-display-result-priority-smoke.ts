import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { controller: controllerSource } = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
});

assert.match(controllerSource, /function createAgentProductionSessionDisplayResult/u);
assert.match(controllerSource, /sessionResult\.status !== 'completed'/u);
assert.match(controllerSource, /\[\.\.\.sessionResult\.toolResults\]\.reverse\(\)\.find/u);
assert.match(controllerSource, /entry\.result\.ok === false/u);
assert.match(controllerSource, /entry\.result\.receipt\?\.status === 'unverified'/u);
assert.match(controllerSource, /entry\.result\.assessment\?\.status === 'failed'/u);
assert.match(controllerSource, /entry\.result\.stateSummary\?\.missingEvidence\?\.length/u);

console.log('agent run controller display result priority smoke ok');
