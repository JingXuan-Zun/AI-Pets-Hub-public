import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as compatibility from '../src/components/chat/chatAgentRuntimeCompatibility';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const clone = <T>(value: T): T => structuredClone(value);
function freeze(value: any): any {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}

export function exercisePendingApprovalAttachments(originals?: { run: string; approval: string }) {
  const outputs: unknown[] = [];
  for (const kind of ['run', 'approval']) for (const messageId of ['task', '', null])
  for (const status of [null, 'running', 'completed']) for (const approvalKind of ['none', 'id', 'missing-id'])
  for (const race of [false, true]) {
    const calls: unknown[][] = [];
    const oldContinuation = { taskState: { taskId: 'old' } };
    const newContinuation = { taskState: { taskId: 'new' } };
    let message: any = { id: 'task', role: 'model', text: 'before', petId: 'pet', extra: 'keep',
      groupTaskEvent: { id: 'old-event' },
      agentRun: status ? { status, agentRuntime: oldContinuation, followUpText: 'old next', trace: ['keep'] } : null };
    const approvalMessage: any = freeze({ id: 'approval', role: 'model', text: 'pending', petId: null,
      groupTaskEvent: approvalKind === 'none' ? null : { id: 'new-event' },
      agentApproval: approvalKind === 'none' ? null : {
        id: approvalKind === 'id' ? 'state-id' : '', status: 'pending', agentRuntime: newContinuation,
      } });
    const beforeApproval = clone(approvalMessage);
    const merger = createAgentRunPresentationFixture(readFileSync('src/components/chat/agentApprovalMessageStore.ts', 'utf8'),
      ['mergeAgentApprovalMessageIntoExistingMessage'], { chatAgentRuntimeCompatibility: compatibility })
      .module('unused').mergeAgentApprovalMessageIntoExistingMessage;
    const update = (owner: string, id: string, updater: (message: any) => any) => {
      calls.push(['update', owner, id]);
      if (race) message = { ...message, extra: 'latest', agentRun: message.agentRun ? { ...message.agentRun, trace: ['latest'] } : null };
      const old = freeze(message);
      message = updater(old);
      assert.equal(old.extra, race ? 'latest' : 'keep');
      assert.equal(message.extra, old.extra, 'merge must receive the latest store message');
      if (message.agentRun) assert.equal(message.agentRun.trace, old.agentRun.trace);
      calls.push(['merged', clone(message)]);
    };
    const add = (actual: any) => { assert.equal(actual, approvalMessage); calls.push(['add', clone(actual)]); };
    const storeApi = {
      updateAgentRunMessage: (id: string, updater: any) => update('run', id, updater),
      updateAgentApprovalMessage: (id: string, updater: any) => update('approval', id, updater),
      mergeAgentApprovalMessageIntoExistingMessage: merger,
    };
    const fixture = createAgentRunPresentationFixture(undefined, [], {
      agentApprovalMessageStore: storeApi, chatStore: { desktopPetChatStore: { addMessage: add } },
    });
    if (originals) {
      const body = originals[kind as 'run' | 'approval'];
      vm.runInNewContext(body, { ...storeApi, runMessageId: messageId, messageId, approvalMessage,
        desktopPetChatStore: { addMessage: add } });
    } else {
      const api = fixture.module('pendingApprovalAttachment');
      if (kind === 'run') api.attachAgentRunPendingApproval(messageId, approvalMessage);
      else api.attachAgentPendingApproval(messageId, approvalMessage);
    }
    assert.deepEqual(clone(approvalMessage), beforeApproval);
    const adds = kind === 'run' && !messageId;
    assert.deepEqual(calls.map(row => row[0]), adds ? ['add'] : ['update', 'merged']);
    if (!adds) {
      assert.equal(message.id, 'task');
      assert.equal(message.text, 'pending');
      assert.equal(message.agentApproval?.id ?? null, approvalKind === 'none' ? null : approvalKind === 'id' ? 'state-id' : 'agent-approval-state-1');
      if (message.agentRun) {
        assert.equal(message.agentRun.status, 'awaiting-approval');
        assert.equal(message.agentRun.followUpText, null);
        assert.equal(message.agentRun.agentRuntime, approvalKind === 'none' ? oldContinuation : newContinuation);
      }
    }
    outputs.push(clone({ kind, messageId, status, approvalKind, race, message, calls }));
  }
  return outputs;
}

for (const [entry, stage, attachment, count] of [
  ['runPreparedAgentProductionSession', 'presentAgentRunPendingApproval', 'attachAgentRunPendingApproval', 3],
  ['resolveAgentApprovalRequest', 'presentAgentPendingApproval', 'attachAgentPendingApproval', 2],
] as const) {
  const source = readModuleProjectFunction('src/components/chat/agentRunController.ts', entry);
  if (entry === 'runPreparedAgentProductionSession') {
    assert.equal((source.match(new RegExp(`await ${stage}\\(`, 'gu')) ?? []).length, count);
  } else {
    assert.equal((source.match(/if \(pendingPresentation\) await pendingPresentation;/gu) ?? []).length, count);
    for (const dispatch of ['dispatchApprovedPendingPresentation', 'dispatchReadOnlyPendingPresentation']) {
      assert.match(source, new RegExp(`const pendingPresentation = ${dispatch}\\(\\{[\\s\\S]*preparedRequest, messageId \\}\\);\\s*if \\(pendingPresentation\\) await pendingPresentation;`, 'u'));
      const dispatchSource = readModuleProjectFunction('src/components/chat/agentRunController.ts', dispatch);
      assert.match(dispatchSource, /return presentAgentPendingApproval\(\{[\s\S]*preparedRequest, messageId: messageId,/u);
    }
  }
  const stageSource = readModuleProjectFunction('src/components/chat/agentRunController.ts', stage);
  assert.match(stageSource, new RegExp(`await createPendingApprovalStageMessage\\(options\\);[\\s\\S]*${attachment}\\(messageId, approvalMessage\\)`, 'u'));
  assert.doesNotMatch(source, /mergeAgentApprovalMessageIntoExistingMessage/u);
}
for (const dependency of ['update', 'merge', 'add']) {
  const error = new Error(`${dependency} failure`);
  const fixture = createAgentRunPresentationFixture(undefined, [], {
    agentApprovalMessageStore: {
      updateAgentRunMessage: (_id: unknown, updater: any) => { if (dependency === 'update') throw error; updater({}); },
      mergeAgentApprovalMessageIntoExistingMessage: () => { throw error; },
    },
    chatStore: { desktopPetChatStore: { addMessage: () => { throw error; } } },
  });
  const api = fixture.module('pendingApprovalAttachment');
  assert.throws(() => api.attachAgentRunPendingApproval(dependency === 'add' ? null : 'task', {}), actual => actual === error);
}
const outputs = exercisePendingApprovalAttachments();
console.log(`agent pending approval attachment smoke: PASS (${outputs.length} outputs; latest store message, identity, continuation, immutable inputs, no duplicate messages, exception propagation)`);
