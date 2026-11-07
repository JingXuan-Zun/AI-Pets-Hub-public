import assert from 'node:assert/strict';
import { assertImplementationModuleGraph } from './implementationModuleGuard';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

// What is left of the run-presentation layer since the conversation loop's task card (0609b19):
// execution receipts and stopping a running card. The old creation / persona-speaker modules are gone
// (docs/removed-features-log.md, 2026-11-06).
assertImplementationModuleGraph({
  entry: 'src/components/chat/agentRunController.ts',
  extraEntries: ['src/components/chat/petChatMessageSendExecution.ts'],
  directory: 'src/components/chat/runController',
  maxEntryLines: 30,
});

const fixture = createAgentRunPresentationFixture();
const receipt = fixture.module('executionReceipt');
const work = fixture.module('workStageProjection');
const trace = fixture.module('runTraceProjection');
const command = { kind: 'tool-call', sourceText: '打开窗口', toolCall: { name: 'launch_local_app' } };
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const resultCases = [
  { ok: true, responseText: '看到了窗口', observations: ['RuntimeCore: read', 'RuntimeCore: read', 'window found'], verification: 'window verified' },
  { ok: false, responseText: '未找到窗口', errorText: 'missing' },
  { responseText: '尚未确认' },
  ...['failed', 'unverified', 'needs-user', 'can-continue', 'completed'].map(status => ({ ok: true, responseText: '有结果', assessment: { status, summary: 'fixture', evidence: ['fixture'] } })),
  ...['success', 'blocked', 'failed', 'unverified'].map(status => ({ ok: true, responseText: '有结果', receipt: { status, title: 'Fixture', summaryLines: ['summary'], evidenceLines: ['RuntimeCore: receipt', 'RuntimeCore: receipt', 'evidence'] } })),
];
for (const result of resultCases) {
  const projected = receipt.createAgentExecutionReceipt(command, result);
  assert.equal(projected.status, receipt.resolveAgentReceiptStatus(result));
  assert.ok(projected.evidenceLines.length <= 8);
  assert.equal(new Set(projected.evidenceLines.map((line: string) => line.trim())).size, projected.evidenceLines.length, 'evidence is de-duplicated');
}
assert.notEqual(receipt.createDeniedAgentExecutionReceipt(command).status, 'success');
assert.notEqual(receipt.createStoppedAgentExecutionReceipt(command).status, 'success');

// Stopping a card blocks what was still pending/running, leaves finished steps alone, never mutates.
const stages = [
  { id: 'a', status: 'completed', summary: 'done' },
  { id: 'b', status: 'running', summary: 'doing' },
  { id: 'c', status: 'pending', summary: 'later' },
];
const before = json(stages);
const stopped = work.stopPendingAgentWorkStages(stages);
assert.deepEqual(json(stages), before, 'stage projections must not mutate source state');
assert.deepEqual(stopped.map((stage: any) => stage.status), ['completed', 'blocked', 'blocked']);
const items = [{ id: 'x', status: 'completed' }, { id: 'y', status: 'running' }];
assert.deepEqual(trace.stopPendingAgentRunTrace(items).map((item: any) => item.status), ['completed', 'blocked']);
assert.deepEqual(json(work.stopPendingAgentWorkStages(undefined)), []);

console.log('agent run presentation module smoke: PASS (module graph, receipts, stop projections)');
