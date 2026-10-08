import assert from 'node:assert/strict';
import { assertImplementationModuleGraph } from './implementationModuleGuard';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

assertImplementationModuleGraph({ entry: 'src/components/chat/agentRunController.ts', directory: 'src/components/chat/runController', maxEntryLines: 30 });

const baselineNames = [
  'createAgentExecutionReceipt', 'resolveAgentReceiptStatus', 'createDeniedAgentExecutionReceipt', 'createStoppedAgentExecutionReceipt',
  'createAgentWorkStages', 'completeAgentWorkStagesWithResult', 'stopPendingAgentWorkStages', 'createAgentRunTrace',
  'completeAgentRunTraceWithResult', 'stopPendingAgentRunTrace', 'stripAgentRunLoopSummaryFromText', 'compactAgentPersonaPromptText',
  'createAgentSafeVisibleFallbackText', 'findAgentPersonaReplyStyleIssues', 'buildAgentProductionSessionPersonaPrompt',
  'createAgentProductionSessionFallbackVisibleReply', 'createAgentProductionSessionProgressVisibleText',
  'createAgentProductionSessionRunMessage', 'runAgentPersonaResponseTurnWithStyleRetry', 'speakAgentProductionSessionResult',
  'speakGroupTaskProductionResult',
];
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

export async function exerciseAgentRunPresentation(baselineSource?: string) {
  const results: unknown[] = [];
  const fixture = createAgentRunPresentationFixture(baselineSource, baselineNames);
  const receipt = fixture.module('executionReceipt');
  const work = { ...fixture.module('workStageCreation'), ...fixture.module('workStageProjection') };
  const trace = { ...fixture.module('runTraceCreation'), ...fixture.module('runTraceProjection') };
  const command = { kind: 'tool-call', sourceText: '打开窗口', toolCall: { name: 'launch_local_app' } };
  const plan = { goal: '打开窗口', instruction: '打开窗口', steps: [
    { id: 'first', summary: 'Observe', decision: { mode: 'silent', reason: 'read-only' } },
    { id: 'second', summary: 'Open', decision: { mode: 'ask', reason: 'local action' } },
  ] };
  const resultCases = [
    { ok: true, responseText: '看到了窗口', observations: ['RuntimeCore: read', 'RuntimeCore: read', 'window found'], verification: 'window verified' },
    { ok: false, responseText: '未找到窗口', errorText: 'missing' },
    { responseText: '尚未确认' },
    ...['failed', 'unverified', 'needs-user', 'can-continue', 'completed'].map(status => ({ ok: true, responseText: '有结果', assessment: { status, summary: 'fixture assessment', evidence: ['fixture'] } })),
    ...['success', 'blocked', 'failed', 'unverified'].map(status => ({ ok: true, responseText: '有结果', receipt: { status, title: 'Fixture', summaryLines: ['summary'], evidenceLines: ['RuntimeCore: receipt', 'RuntimeCore: receipt', 'evidence'] } })),
  ];
  for (const result of resultCases) {
    const projected = receipt.createAgentExecutionReceipt(command, result);
    assert.equal(projected.status, receipt.resolveAgentReceiptStatus(result));
    assert.ok(projected.evidenceLines.length <= 8);
    assert.equal(new Set(projected.evidenceLines.map((line: string) => line.trim())).size, projected.evidenceLines.length);
    for (const options of [{}, { needsApproval: true }, { blockedStepId: 'second' }]) {
      const stages = work.createAgentWorkStages(plan, options);
      const oldStages = json(stages);
      const completed = work.completeAgentWorkStagesWithResult(stages, result);
      assert.deepEqual(json(stages), oldStages, 'stage projections must not mutate source state');
      if (projected.status === 'unverified') assert.equal(completed.find((stage: any) => stage.id === 'decide-next-step').status, 'pending');
      const initialTrace = trace.createAgentRunTrace(plan, options);
      const oldTrace = json(initialTrace);
      const completedTrace = trace.completeAgentRunTraceWithResult(initialTrace, result);
      assert.deepEqual(json(initialTrace), oldTrace, 'trace projections must not mutate source state');
      results.push(json({ projected, stages, completed, completedTrace,
        stoppedStages: work.stopPendingAgentWorkStages(stages), stoppedTrace: trace.stopPendingAgentRunTrace(initialTrace) }));
    }
  }
  results.push(json([receipt.createDeniedAgentExecutionReceipt(command), receipt.createStoppedAgentExecutionReceipt(command)]));
  const text = fixture.module('personaText');
  for (const input of ['', '具体的窗口已经打开了。', 'Execution rounds: 4', '真实结果\nExecution rounds: 4', 'Runtime diagnosis\n【结果】窗口已出现\n完成', 'AgentSessionV2 internal JSON', 'x'.repeat(250)]) {
    results.push([text.stripAgentRunLoopSummaryFromText(input), text.compactAgentPersonaPromptText(input), text.createAgentSafeVisibleFallbackText(input)]);
  }
  const styles = fixture.module('personaReplyStyle');
  assert.equal(styles.findAgentPersonaReplyStyleIssues('窗口在第二块屏幕上。').length, 0);
  assert.ok(styles.findAgentPersonaReplyStyleIssues('任务已完成，根据工具结果我会继续观察。').length > 0);
  const prompts = fixture.module('productionPersonaPrompt');
  for (const status of ['completed', 'needs-user', 'needs-approval', 'budget-exceeded', 'max-steps', 'failed']) {
    const session = { status, sourceText: '请求', finalAnswer: 'AgentSessionV2 JSON internal', steps: [], toolResults: [{ command, result: resultCases[0] }] };
    results.push([prompts.buildAgentProductionSessionPersonaPrompt('目标', session), prompts.createAgentProductionSessionFallbackVisibleReply(session)]);
  }
  const visible = fixture.module('sessionVisibleText');
  for (const event of [
    { type: 'model-thinking', continuation: { steps: [] } }, { type: 'model-thinking', continuation: { steps: [{}] } },
    ...['tool_call', 'tool_calls', 'final'].map(action => ({ type: 'model-decision', continuation: { steps: [{ action }] } })),
    { type: 'tools-running', commands: [{}, {}] }, { type: 'tools-running', command: {} }, { type: 'tool-result' }, { type: 'unknown', message: '可见消息' },
  ]) results.push(visible.createAgentProductionSessionProgressVisibleText(event));

  const targetSlot = { id: 'pet', personality: { name: '角色' } };
  const preparedRequest = { outgoingText: '请求', currentChatState: { chatMode: 'single' }, targetSlots: [targetSlot],
    currentConfig: { settings: {} }, isGroupMode: false, playbackToken: 1, requestToken: 2, promptHistoryMessages: [] };
  const projectedMessage = fixture.module('sessionMessageProjection').createAgentProductionSessionRunMessage({ instruction: '目标', preparedRequest });
  assert.equal(projectedMessage.petId, 'pet'); assert.equal(projectedMessage.agentRun.status, 'running');
  results.push(json(projectedMessage));
  for (const candidate of [
    { collaborationPlan: { executorRoleId: 'pet' }, sourceRoleIds: ['other'] },
    { sourceRoleIds: ['pet'] }, { sourceRoleIds: ['missing'] },
  ]) {
    const request = { ...preparedRequest, targetSlots: [{ id: 'other', personality: { name: '其他角色' } }, targetSlot], groupTaskCandidate: candidate };
    const message = fixture.module('sessionMessageProjection').createAgentProductionSessionRunMessage({ instruction: '群任务', preparedRequest: request });
    assert.equal(message.petId, candidate.sourceRoleIds[0] === 'missing' ? 'other' : 'pet');
    results.push(json(message));
  }

  for (const mode of ['normal', 'rewrite', 'first-cancel', 'retry-cancel', 'empty', 'retry-empty', 'in-place', 'silent']) {
    const current = createAgentRunPresentationFixture(baselineSource, baselineNames);
    let drafts = 0;
    const runPetResponseTurn = async (_slot: unknown, options: any) => {
      drafts++; current.effects.push(['draft', options]);
      assert.equal(options.shouldAutoSpeakReply, false, 'drafts must never speak before style acceptance');
      const cancelled = mode === 'first-cancel' || mode === 'retry-cancel' && drafts === 2;
      const finalResponse = mode === 'empty' || mode === 'retry-empty' && drafts === 2 ? ''
        : ['rewrite', 'retry-cancel', 'retry-empty'].includes(mode) && drafts === 1 ? '任务已完成。' : '窗口在第二块屏幕上。';
      if (mode === 'in-place') current.store.updateMessage('task', (message: any) => ({ ...message, text: finalResponse }));
      else if (finalResponse) current.store.addMessage({ id: `draft-${drafts}`, role: 'model', text: finalResponse, petId: 'pet', chatMode: 'single' });
      current.store.addMessage({ id: `other-${drafts}`, role: 'model', text: '其他角色回复', petId: 'other', chatMode: 'single' });
      return { cancelled, finalResponse };
    };
    const response = await current.module('personaReplyTurn').runAgentPersonaResponseTurnWithStyleRetry({
      ...preparedRequest, chatMode: 'single', historyMessages: [], participantNames: ['角色'], promptText: '提示',
      compactReplyIntoMessageId: 'task', shouldAutoSpeakReply: mode !== 'silent', targetSlot, runPetResponseTurn,
      playVoiceText: async (...args: any[]) => { current.effects.push(['voice', ...args]); },
    });
    const voices = current.effects.filter(effect => effect[0] === 'voice');
    assert.ok(drafts <= 2, 'there must be at most one rewrite');
    assert.equal(voices.length, ['first-cancel', 'retry-cancel', 'empty', 'retry-empty', 'silent'].includes(mode) ? 0 : 1);
    assert.ok(current.messages.some(message => message.petId === 'other'), 'merging a reply must preserve other characters');
    results.push(json({ response, messages: current.messages, effects: current.effects }));
  }
  for (const mode of ['accepted', 'fallback-error', 'fallback-empty', 'cancelled', 'no-target']) {
    for (const compactReplyIntoMessageId of ['task', null]) {
    const current = createAgentRunPresentationFixture(baselineSource, baselineNames);
    let drafts = 0;
    const session = { status: 'completed', sourceText: '请求', finalAnswer: mode === 'accepted' ? '窗口在第二块屏幕上。' : 'AgentSessionV2 internal', steps: [], toolResults: [] };
    await current.module('productionPersonaSpeaker').speakAgentProductionSessionResult({
      instruction: '目标', participantNames: ['角色'], preparedRequest, result: session, compactReplyIntoMessageId,
      shouldAutoSpeakReply: true, targetSlot: mode === 'no-target' ? null : targetSlot,
      playVoiceText: async (...args: any[]) => { current.effects.push(['voice', ...args]); },
      runPetResponseTurn: async () => { drafts++; if (mode === 'fallback-error') throw new Error('fixture persona failure'); return { cancelled: mode === 'cancelled', finalResponse: '' }; },
    });
    assert.equal(drafts, ['accepted', 'no-target'].includes(mode) ? 0 : 1);
    assert.equal(current.effects.filter(effect => effect[0] === 'voice').length, mode === 'accepted' ? 1 : 0);
    results.push(json({ messages: current.messages, effects: current.effects }));
    }
  }
  for (const reporterRoleId of ['reporter', 'missing']) {
    const current = createAgentRunPresentationFixture(baselineSource, baselineNames);
    const reporter = { id: 'reporter', personality: { name: '汇报角色' } };
    await current.module('groupPersonaSpeaker').speakGroupTaskProductionResult({ speakOptions: {
      instruction: '目标', participantNames: ['角色', '汇报角色'],
      preparedRequest: { ...preparedRequest, targetSlots: [targetSlot, reporter], groupTaskCandidate: { collaborationPlan: { reporterRoleId } } },
      result: { status: 'completed', sourceText: '请求', finalAnswer: '已找到窗口。', steps: [], toolResults: [] },
      shouldAutoSpeakReply: false, targetSlot,
      playVoiceText: async () => { throw new Error('silent group reply must not speak'); },
      runPetResponseTurn: async () => { throw new Error('accepted group result must not call a model'); },
    } });
    const expectedRole = reporterRoleId === 'reporter' ? 'reporter' : 'pet';
    assert.equal(current.effects[0][1], expectedRole);
    assert.equal(current.messages.at(-1).petId, expectedRole);
    results.push(json({ messages: current.messages, effects: current.effects }));
  }
  return results;
}

await exerciseAgentRunPresentation();
console.log('agent run presentation module smoke: PASS (receipts, immutable projections, persona sanitation, rewrite/cancellation/voice, session fallback, module graph)');
