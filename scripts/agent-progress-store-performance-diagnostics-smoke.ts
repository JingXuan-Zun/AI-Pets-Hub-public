import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { readProjectFile } from './smokeTestHarness.ts';

const controller = readProjectFile('src/components/chat/agentRunController.ts');
const source = readProjectFile('src/components/chat/agentProgressMessageProjection.ts');
assert.match(controller, /updateAgentProductionSessionProgressMessage/u);

assert.match(source, /markRendererDiagnosticContext\('agent-progress'/u);
assert.match(source, /const updateStartedAt = performance\.now\(\)/u);
assert.match(source, /const updateDurationMs = performance\.now\(\) - updateStartedAt/u);
assert.match(source, /if \(updateDurationMs >= 32\)/u);
assert.match(source, /Agent progress store update was slow/u);

const updateSource = readModuleProjectFunction('src/components/chat/agentProgressMessageProjection.ts', 'updateAgentProgressMessage');
for (const duration of [0, 31.99, 32, 32.6, 100]) {
  const effects: unknown[][] = [];
  let clockReads = 0;
  const exported = { exports: null as any };
  const message = { id: 'task' };
  const event = { type: 'tool-result', stepIndex: 2, taskPhase: 'evaluating', continuation: { steps: [1, 2], toolResults: [1] } };
  vm.runInNewContext(ts.transpileModule(updateSource + '\nmodule.exports = updateAgentProgressMessage;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: exported,
    exports: {},
    performance: { now: () => clockReads++ === 0 ? 100 : 100 + duration },
    markRendererDiagnosticContext: (...args: unknown[]) => effects.push(['diagnostic', ...args]),
    updateAgentRunMessage: (id: string, updater: (message: unknown) => unknown) => { effects.push(['update', id]); assert.equal(updater(message), message); },
    projectAgentProgressMessage: (options: any) => { assert.equal(options.event, event); assert.equal(options.visibleText, 'progress'); return options.message; },
    pushFrontendRuntimeLog: (...args: unknown[]) => effects.push(['log', ...args]),
  });
  exported.exports({ messageId: null, event, visibleText: 'progress' });
  assert.equal(effects.length, 0);
  assert.equal(clockReads, 0);
  exported.exports({ messageId: 'task', event, visibleText: 'progress' });
  assert.equal(effects[0][0], 'diagnostic');
  assert.deepEqual(effects[1], ['update', 'task']);
  assert.equal(clockReads, 2);
  assert.equal(effects.length, duration >= 32 ? 3 : 2);
  if (duration >= 32) {
    assert.equal(effects[2][0], 'log');
    assert.equal((effects[2][3] as any).durationMs, Math.round(duration));
    assert.equal((effects[2][3] as any).toolResultCount, 1);
  }
}

console.log('agent progress store performance diagnostics smoke ok');
