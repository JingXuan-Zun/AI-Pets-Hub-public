import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as progress from '../src/components/chat/agentProgressMessageProjection';
import * as compatibility from '../src/components/chat/chatAgentRuntimeCompatibility';
import { resolveAgentStopTarget } from '../src/components/chat/agentRunStopPolicy';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

const names = ['projectStoppedAgentMessage', 'createAgentApprovalPreparedRequest', 'createAgentRunRequestContext'];
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function freeze(value: any): any {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}

export function exerciseAgentRunStopContext(baselineSource?: string, controllerSource?: string) {
  const outputs: unknown[] = [];
  const pure = createAgentRunPresentationFixture(baselineSource, names, { agentProgressMessageProjection: progress });
  const command: any = { kind: 'tool-call', sourceText: 'read', toolCall: { name: 'get_system_info' } };
  for (const runStatus of [null, 'planned', 'running', 'completed', 'blocked', 'failed']) {
    for (const approvalStatus of [null, 'pending', 'running', 'awaiting-approval', 'completed', 'denied', 'blocked', 'failed']) {
      for (const cancelled of [null, { taskState: { taskId: 'same-task', phase: 'cancelled' } }]) {
        const record = (status: string) => ({ command, status, stages: [{ id: 'execute-tools', status: 'running' }, { id: 'verify-result', status: 'completed' }], trace: [{ id: 'step', status: 'running' }], followUpText: 'old next' });
        const message: any = freeze({ id: 'task', text: 'before', petId: 'pet', agentRun: runStatus ? record(runStatus) : null, agentApproval: approvalStatus ? record(approvalStatus) : null });
        freeze(cancelled); const before = json(message);
        const projected = pure.module('stoppedMessageProjection').projectStoppedAgentMessage(message, cancelled);
        assert.deepEqual(json(message), before);
        for (const field of ['agentRun', 'agentApproval']) {
          const stoppable = field === 'agentRun' ? runStatus && progress.isStoppableAgentRunStatus(runStatus as any) : approvalStatus && progress.isStoppableAgentApprovalStatus(approvalStatus as any);
          if (stoppable) { assert.equal(projected[field].agentRuntime, cancelled); assert.equal(projected[field].stoppedByUser, true); assert.equal(projected[field].status, 'blocked'); assert.equal(projected[field].followUpText, null); assert.equal(projected[field].stages[1].status, 'completed'); }
          else assert.equal(projected[field], message[field], 'terminal records retain identity');
        }
        outputs.push(json(projected));
      }
    }
  }
  assert.equal(pure.effects.length, 0);

  for (const mode of ['single', 'group']) {
    for (const eventSource of ['approval', 'message', 'none', 'incomplete', 'empty-roles']) {
      for (const petId of ['pet', null]) {
        const effects: any[] = [], oldConfig: any = { id: 'old' }, newConfig: any = { id: 'new' };
        const configRef = { current: oldConfig }, latestHistory = [{ id: 'after-playback' }];
        const event: any = { taskId: 'group', collaborationPlan: {}, requestedCapability: 'read', summary: 'goal', sourceRoleIds: eventSource === 'empty-roles' ? [] : undefined };
        if (eventSource === 'incomplete') event.summary = '';
        const approval: any = { groupTaskEvent: ['approval', 'empty-roles', 'incomplete'].includes(eventSource) ? event : null };
        const approvalMessage: any = { petId, chatMode: mode, groupTaskEvent: eventSource === 'message' ? event : null };
        const targetSlot = petId ? { id: petId } : null, groupSlots = [{ id: 'group-role' }];
        const current = createAgentRunPresentationFixture(baselineSource, names, {
          chatStore: { desktopPetChatStore: { getState: () => { effects.push(['history']); return { messages: latestHistory }; } } },
          multiPetChat: { resolveChatTargetSlots: (config: any, chatMode: string, activePetId: string) => { assert.equal(config, newConfig); effects.push(['slots', chatMode, activePetId]); return groupSlots; } },
        });
        const result = current.module('approvalRequestContext').createAgentApprovalPreparedRequest({ currentChatState: { chatMode: 'single', activePetId: 'active', unrelated: 'keep' }, configRef, approval, approvalMessage, approvalRuntime: { sourceText: 'original source' }, targetSlot, requestToken: 42,
          getPlaybackToken: () => { effects.push(['playback']); configRef.current = newConfig; return 9; } });
        assert.equal(result.currentConfig, oldConfig); assert.equal(result.promptHistoryMessages, latestHistory);
        assert.equal(result.userMessage, approvalMessage); assert.equal(result.requestToken, 42);
        assert.equal(result.browserSearchMode, 'block'); assert.equal(result.outgoingText, 'original source');
        assert.equal(result.playbackToken, 9); assert.equal(result.currentChatState.unrelated, 'keep');
        assert.deepEqual(effects, mode === 'group' ? [['playback'], ['history'], ['slots', 'group', 'active']] : [['playback'], ['history']]);
        assert.equal(result.groupTaskCandidate !== undefined, !['none', 'incomplete'].includes(eventSource));
        if (result.groupTaskCandidate) assert.deepEqual(json(result.groupTaskCandidate.sourceRoleIds), eventSource === 'empty-roles' ? [] : [petId ?? 'primary']);
        if (mode === 'group') assert.equal(result.targetSlots, groupSlots);
        else assert.deepEqual(json(result.targetSlots), targetSlot ? [targetSlot] : []);
        outputs.push(json({ result, effects }));
      }
    }
  }
  for (const failAt of ['playback', 'history', 'slots']) {
    const effects: string[] = [], error = new Error('fixture failure');
    const call = (name: string) => { effects.push(name); if (name === failAt) throw error; };
    const current = createAgentRunPresentationFixture(baselineSource, names, {
      chatStore: { desktopPetChatStore: { getState: () => { call('history'); return { messages: [] }; } } },
      multiPetChat: { resolveChatTargetSlots: () => { call('slots'); return []; } },
    });
    assert.throws(() => current.module('approvalRequestContext').createAgentApprovalPreparedRequest({ currentChatState: { chatMode: 'group' }, configRef: { current: {} }, approval: {}, approvalMessage: {}, approvalRuntime: {}, targetSlot: null, requestToken: 1, getPlaybackToken: () => { call('playback'); return 1; } }), actual => actual === error);
    assert.deepEqual(effects, ['playback', 'history', 'slots'].slice(0, ['playback', 'history', 'slots'].indexOf(failAt) + 1));
    outputs.push({ failAt, effects });
  }
  for (const mode of [false, true]) {
    for (const failAt of [null, 'memory', 'command', 'skills']) {
      const effects: any[] = [], error = new Error('fixture input failure');
      const call = (name: string, value: unknown) => { effects.push([name, value]); if (name === failAt) throw error; };
      const history = [{ id: 'history' }], memory = { summaryText: 'memory' }, initialCommand = { kind: 'fixture' }, skills = ['skill'];
      const current = createAgentRunPresentationFixture(baselineSource, names, {
        agent: { createAgentWorkingMemorySnapshot: (messages: unknown) => { assert.equal(messages, history); call('memory', messages); return memory; } },
        agentFollowUpContinuation: { resolveAgentFollowUpContinuationCommand: (text: string, messages: unknown) => { assert.equal(messages, history); call('command', text); return initialCommand; } },
        agentImportedSkillRuntime: { loadEnabledAgentImportedSkills: (options: any) => { call('skills', options); return skills; } },
      });
      const execute = () => current.module('runRequestContext').createAgentRunRequestContext({ targetSlots: [{ personality: { name: 'a' } }, { personality: { name: 'b' } }], isGroupMode: mode, outgoingText: 'source', promptHistoryMessages: history }, { id: 'executor' });
      let result;
      if (failAt) assert.throws(execute, actual => actual === error);
      else { result = execute(); assert.equal(result.workingMemory, memory); assert.equal(result.initialCommand, initialCommand); assert.equal(result.importedSkills, skills); assert.equal(result.shouldAutoSpeakReply, !mode); assert.deepEqual(json(result.participantNames), ['a', 'b']); }
      assert.deepEqual(effects.map(row => row[0]), failAt ? ['memory', 'command', 'skills'].slice(0, ['memory', 'command', 'skills'].indexOf(failAt) + 1) : ['memory', 'command', 'skills']);
      outputs.push(json({ mode, failAt, result, effects }));
    }
  }

  const rootSource = controllerSource ?? readFileSync('src/components/chat/agentRunController.ts', 'utf8');
  for (const scenario of ['current-run', 'legacy-run', 'current-approval', 'legacy-approval', 'no-continuation', 'latest', 'missing', 'terminal', 'race', 'repeat', 'cancel-error']) {
    const effects: any[] = [], continuation: any = { taskState: { taskId: 'original' } }, cancelled: any = { taskState: { taskId: 'original', phase: 'cancelled' } }, error = new Error('cancel failure');
    const messages: any[] = [{ id: 'task', petId: 'pet', agentRun: { command, status: scenario === 'terminal' ? 'completed' : 'running', stages: [], trace: [] } }];
    const field = scenario.includes('approval') ? 'agentApproval' : 'agentRun';
    if (field === 'agentApproval') messages[0].agentApproval = { command, status: 'pending', stages: [], trace: [] };
    if (scenario !== 'no-continuation') messages[0][field][scenario.startsWith('legacy') ? 'agentSessionV2' : 'agentRuntime'] = continuation;
    if (scenario === 'latest') messages.push({ id: 'latest', agentApproval: { command, status: 'pending', stages: [], trace: [], agentRuntime: continuation } });
    const journal = { id: 'journal' };
    const current = createAgentRunPresentationFixture(rootSource, ['stopAgentRunMessage'], {
      agentProgressMessageProjection: progress, chatAgentRuntimeCompatibility: compatibility, agentRunStopPolicy: { resolveAgentStopTarget },
      chatStore: { desktopPetChatStore: { getState: () => { effects.push(['read']); return { messages }; }, updateMessage: (id: string, updater: any) => { effects.push(['update-start', id]); const index = messages.findIndex(m => m.id === id); messages[index] = updater(messages[index]); effects.push(['update-end', id]); } } },
      agentRunAbortRegistry: { abortAgentRunController: (id: string) => { effects.push(['abort', id]); if (scenario === 'race') messages[0].agentRun.agentRuntime = { taskState: { taskId: 'fresh' } }; } },
      agent: { getAgentCanonicalEventJournal: (id: string) => { effects.push(['journal', id]); return journal; }, cancelAgentProductionRuntime: (options: any) => { assert.equal(options.canonicalEventJournal, journal); assert.equal(options.continuation.taskState.taskId, scenario === 'race' ? 'fresh' : 'original'); effects.push(['cancel', options.continuation.taskState.taskId]); if (scenario === 'cancel-error') throw error; return { continuation: cancelled }; }, releaseAgentCanonicalEventJournal: (id: string) => effects.push(['release', id]) },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => effects.push(['log', ...args]) },
      agentRuntimeWorldBridge: { publishAgentRuntimeWorldResult: (result: any) => effects.push(['world', result]) },
    });
    const execute = () => current.module('unused').stopAgentRunMessage(scenario === 'latest' ? undefined : scenario === 'missing' ? 'missing' : 'task');
    if (scenario === 'cancel-error') assert.throws(execute, actual => actual === error);
    else {
      const result = execute(); assert.equal(result, !['missing', 'terminal'].includes(scenario));
      if (result) { const order = effects.map(row => row[0]); assert.deepEqual(order, scenario === 'no-continuation' ? ['read', 'abort', 'update-start', 'update-end', 'log', 'world', 'release'] : ['read', 'abort', 'update-start', 'journal', 'cancel', 'update-end', 'log', 'world', 'release']); }
      else assert.deepEqual(effects, [['read']]);
      if (scenario === 'repeat') { assert.equal(execute(), false); assert.equal(effects.filter(row => row[0] === 'cancel').length, 1); }
    }
    outputs.push(json({ scenario, messages, effects }));
  }
  return outputs;
}

const outputs = exerciseAgentRunStopContext();
console.log(`agent run stop/context smoke: PASS (${outputs.length} outputs; immutable stop projection, terminal identity, current/legacy cancellation, fresh context reads, dependency order, exception propagation)`);
