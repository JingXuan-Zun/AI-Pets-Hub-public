import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const names = ['runPreparedAgentProductionSession', 'resolveAgentApprovalRequest', 'stopAgentRunMessage',
  'resolveAgentApprovalDecisionFromText', 'findLatestPendingAgentApprovalMessage'];
let checks = 0;
for (const failure of [false, true]) {
  const calls: unknown[] = []; const error = new Error('original entry error');
  const originalPromise = Promise.resolve({ marker: 'original result' }); const originalStop = { marker: 'stop result' };
  const functions = Object.fromEntries(names.map(name => [name, (options: unknown) => {
    calls.push([name, options]); if (failure) throw error; return name === 'stopAgentRunMessage' ? originalStop : originalPromise;
  }]));
  const fixture = createAgentRunPresentationFixture(undefined, [], {
    initialRunLifecycle: { runPreparedAgentProductionSession: functions.runPreparedAgentProductionSession },
    approvalRunLifecycle: { resolveAgentApprovalRequest: functions.resolveAgentApprovalRequest },
    stopRunLifecycle: { stopAgentRunMessage: functions.stopAgentRunMessage },
    approvalDecisionText: { resolveAgentApprovalDecisionFromText: functions.resolveAgentApprovalDecisionFromText,
      findLatestPendingAgentApprovalMessage: functions.findLatestPendingAgentApprovalMessage },
  });
  const facade = fixture.module('../agentRunController');
  assert.deepEqual(Object.keys(facade).sort(), [...names, 'agentRunController'].sort());
  assert.deepEqual(Object.keys(facade.agentRunController).sort(), names.slice(0, 3).sort());
  assert.equal(calls.length, 0, 'loading the facade does not run an entry');
  for (const name of names) {
    assert.equal(facade[name], functions[name], 'direct re-export preserves function identity');
    if (names.slice(0, 3).includes(name)) assert.equal(facade.agentRunController[name], functions[name]);
    const options = Object.freeze({ marker: name });
    if (failure) assert.throws(() => facade[name](options), caught => caught === error);
    else assert.equal(facade[name](options), name === 'stopAgentRunMessage' ? originalStop : originalPromise);
    assert.deepEqual(calls.at(-1), [name, options]); checks++;
  }
}
// Exercise real lifecycle exports through the facade where no Runtime is needed.
for (const mode of ['missing-target', 'missing-approval', 'terminal-approval', 'denied']) {
  const calls: string[] = []; const journal = { marker: 'journal' }; const runtime = { marker: 'runtime' };
  const approval = { status: mode === 'terminal-approval' ? 'completed' : 'pending' };
  const message = { id: 'task', agentApproval: mode === 'missing-approval' ? null : approval };
  const fixture = createAgentRunPresentationFixture(undefined, [], {
    sessionMessageProjection: { resolvePreparedAgentTargetSlot: () => { calls.push('target'); return null; } },
    chatStore: { desktopPetChatStore: { getState: () => { calls.push('store'); return { messages: [message] }; } } },
    chatAgentRuntimeCompatibility: { resolveChatAgentRuntimeContinuation: (value: unknown) => {
      assert.equal(value, approval); calls.push('runtime'); return runtime;
    } },
    agent: { getAgentCanonicalEventJournal: (id: unknown) => { assert.equal(id, 'task'); calls.push('journal'); return journal; } },
    approvalTerminalStages: { completeDeniedAgentApproval: (options: any) => {
      assert.equal(options.canonicalEventJournal, journal); assert.equal(options.approvalRuntime, runtime);
      assert.equal(options.approval, approval); assert.equal(options.approvalMessage, message); assert.equal(options.messageId, 'task'); calls.push('deny');
    } },
    approvalRequestActivation: { activateApprovedAgentRequest: () => assert.fail('early exits must not activate a request') },
    agentRunAbortRegistry: { registerAgentRunAbortController: () => assert.fail('early exits must not register abort') },
  });
  const facade = fixture.module('../agentRunController');
  const returned = mode === 'missing-target'
    ? facade.agentRunController.runPreparedAgentProductionSession({ preparedRequest: {} })
    : facade.agentRunController.resolveAgentApprovalRequest({ messageId: 'task', decision: 'deny' });
  assert.equal(await returned, undefined);
  assert.deepEqual(calls, mode === 'missing-target' ? ['target'] : mode === 'denied' ? ['store', 'runtime', 'journal', 'deny'] : ['store']); checks++;
}
const entry = readFileSync('src/components/chat/agentRunController.ts', 'utf8');
assert.doesNotMatch(entry, /\b(?:async|await|function)\b/u, 'facade has no execution wrapper');
for (const [name, module] of [[names[0], 'initialRunLifecycle'], [names[1], 'approvalRunLifecycle'], [names[2], 'stopRunLifecycle']]) {
  assert.match(entry, new RegExp(`export \\{ ${name} \\} from './runController/${module}';`, 'u'));
}
assert.match(readModuleProjectFunction('src/components/chat/agentRunController.ts', names[0]), /export async function runPreparedAgentProductionSession/u);
assert.match(readModuleProjectFunction('src/components/chat/agentRunController.ts', names[1]), /export async function resolveAgentApprovalRequest/u);
assert.equal(checks, 14);
console.log('Controller lifecycle exports smoke passed (14 paths; public keys/function and promise identity/errors/no eager work/real lifecycle early exits).');
