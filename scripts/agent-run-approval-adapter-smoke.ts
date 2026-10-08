import assert from 'node:assert/strict';
import * as agent from '../src/agent';
import { findLatestPendingAgentApprovalMessage, resolveAgentApprovalDecisionFromText } from '../src/components/chat/agentRunController';
import * as decision from '../src/components/chat/runController/approvalDecisionText';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFile } from './projectModuleSource.mjs';

assert.equal(findLatestPendingAgentApprovalMessage, decision.findLatestPendingAgentApprovalMessage);
assert.equal(resolveAgentApprovalDecisionFromText, decision.resolveAgentApprovalDecisionFromText);
const controllerSource = readModuleProjectFile('src/components/chat/agentRunController.ts');
for (const retired of ['speakAgentResult', 'buildAgentCommandPersonaPrompt', 'createAgentCommandPersonaStatusGuidance',
  'formatAgentCommandResultForPersonaPrompt', 'formatAgentResultEvidenceForPersonaPrompt',
  'createAgentFallbackVisibleReply', 'resolveAgentRunControllerStructuredEvidence']) {
  assert.doesNotMatch(controllerSource, new RegExp(`function ${retired}\\s*\\(`), `retired helper ${retired}`);
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const baselineNames = ['resolveAgentApprovalDecisionFromText', 'findLatestPendingAgentApprovalMessage',
  'getApprovalCommandDesktopOrganization', 'createAgentDesktopSequenceApprovalSummary', 'createAgentApprovalSummary',
  'createAgentApprovalMessage', 'updateAgentToolExecutionProgressMessage', 'runAgentToolExecutorWithLiveProgress',
  'runAgentControllerToolTransactionWithLiveProgress', 'createAgentProductionSessionDisplayResult',
  'createSkippedStaleOuterApprovalResult', 'createRepeatedApprovalLoopResult'];
const command: any = { kind: 'tool-call', sourceText: '读状态', toolCall: { name: 'get_system_info', input: {} } };
const plan: any = { goal: '读状态', instruction: '读状态', steps: [{ id: 'read', summary: '读取状态', details: ['Read fixture'], decision: { mode: 'silent', reason: 'read-only' } }] };
const preparedRequest: any = { outgoingText: '读状态', promptHistoryMessages: [], targetSlots: [{ id: 'pet', personality: { name: '角色' } }], currentChatState: { chatMode: 'single' } };

export async function exerciseAgentRunApprovalAdapters(baselineSource?: string) {
  const outputs: unknown[] = [];
  const fixture = createAgentRunPresentationFixture(baselineSource, baselineNames);
  const input = fixture.module('approvalDecisionText');
  for (const [text, expected] of [
    ['可以', 'approve'], ['／agent ＹＥＳ！', 'approve'], ['/助手 继续吧。', 'approve'], ['按刚才的计划执行吧', 'approve'],
    ['别执行', 'deny'], ['先不用了', 'deny'], ['NO!', 'deny'], ['不要，先停下', null], ['', null], ['可以打开浏览器搜索今天的天气吗', null], ['y'.repeat(19), null],
  ]) { const result = input.resolveAgentApprovalDecisionFromText(text); assert.equal(result, expected); outputs.push(result); }
  const messages: any[] = [
    { id: 'older', petId: 'pet', chatMode: 'single', agentApproval: { status: 'pending' } },
    { id: 'other', petId: 'other', chatMode: 'single', agentApproval: { status: 'pending' } },
    { id: 'group', petId: 'pet', chatMode: 'group', agentApproval: { status: 'pending' } },
    { id: 'unowned', petId: null, chatMode: 'single', agentApproval: { status: 'pending' } },
    { id: 'done', petId: 'pet', chatMode: 'single', agentApproval: { status: 'approved' } }, { agentApproval: { status: 'pending' } },
  ];
  for (const options of [{}, { activePetId: 'pet', chatMode: 'single' }, { activePetId: 'other', chatMode: 'single' }, { activePetId: 'pet', chatMode: 'group' }]) {
    const result = input.findLatestPendingAgentApprovalMessage(messages, options);
    assert.equal(result?.id, !('chatMode' in options) ? 'unowned' : options.chatMode === 'group' ? 'group' : options.activePetId === 'other' ? 'other' : 'older');
    outputs.push(json(result));
  }
  const organization = fixture.module('desktopOrganizationApproval');
  for (const options of [
    { mode: 'execute', targetDisplay: 'secondary', sourceDisplay: 'primary', sourceScope: 'display-icons', groupBy: 'kind' },
    { displayTarget: 'current', scope: 'all-icons', groupBy: 'invalid' }, { mode: 'invalid', targetDisplay: 'invalid', sourceScope: 'invalid' },
  ]) outputs.push(json(organization.getApprovalCommandDesktopOrganization({ ...command, toolCall: { name: 'organize_desktop_icons', input: options } })));
  const sequence = fixture.module('desktopSequenceApproval');
  for (const stepsJson of ['', '{bad', '{}', 'null', '[]', JSON.stringify([null, [], 42]), JSON.stringify([
    { tool: 'execute_desktop_action', args: { action: 'open-resource', target: 'example.com' }, reason: '打开网页' },
    { tool: 'move_window_to_display', input: { targetDisplay: 'secondary' } },
    ...Array.from({ length: 5 }, () => ({ tool: 'get_system_info', args: {} })),
  ])]) {
    const result = sequence.createAgentDesktopSequenceApprovalSummary({ ...command, toolCall: { name: 'execute_desktop_sequence', input: { stepsJson } } }, plan);
    if (stepsJson.includes('example.com')) { assert.equal(result.lines.length, 7); assert.match(result.warning, /2 more/u); assert.match(result.lines[2], /open_resource -> example.com/u); }
    else assert.equal(result, null);
    outputs.push(result);
  }
  for (const mode of ['chat-preview', 'history-preview', 'no-preview', 'sequence', 'mcp', 'fallback', 'mcp-error']) {
    let mcpCalls = 0;
    const current = createAgentRunPresentationFixture(baselineSource, baselineNames, {
      agentMcpApprovalSummary: { createAgentMcpApprovalSummaryWithSchema: async () => { mcpCalls++; if (mode === 'mcp-error') throw new Error('fixture schema failure'); return mode === 'mcp' ? { title: 'MCP fixture', lines: ['schema evidence'], warning: null } : null; } },
    });
    const preview = { id: 'preview', agentRun: { context: { kind: 'desktop-organization', desktopOrganization: { previewSummaryLines: ['preview evidence'], previewWarning: 'preview warning' } } } };
    const request = { ...preparedRequest, promptHistoryMessages: mode === 'history-preview' ? [preview] : [] };
    if (mode === 'chat-preview') current.messages.push(preview);
    const selected = ['chat-preview', 'history-preview', 'no-preview'].includes(mode)
      ? { ...command, desktopOrganization: { mode: 'execute' } }
      : mode === 'sequence' ? { ...command, toolCall: { name: 'execute_desktop_sequence', input: { stepsJson: '[{"tool":"get_system_info"}]' } } } : command;
    const summaryModule = current.module('approvalSummary');
    if (mode === 'mcp-error') { await assert.rejects(summaryModule.createAgentApprovalSummary(selected, plan, request), /fixture schema failure/u); outputs.push({ mode, mcpCalls }); continue; }
    const summary = await summaryModule.createAgentApprovalSummary(selected, plan, request);
    assert.equal(mcpCalls, ['mcp', 'fallback'].includes(mode) ? 1 : 0, 'preview/sequence summaries must not scan MCP schema');
    if (mode.endsWith('preview') && mode !== 'no-preview') assert.deepEqual(json(summary.lines), ['preview evidence']);
    outputs.push(json({ summary, mcpCalls }));
    const message = await current.module('approvalMessage').createAgentApprovalMessage({ command: selected, plan, preparedRequest: request, text: '' });
    assert.equal(message.text, '', 'explicit visible text must be preserved');
    assert.equal(message.agentApproval.status, 'pending'); assert.equal(message.petId, 'pet');
    outputs.push(json(message));
  }
  for (const runStatus of ['planned', 'running', 'completed', 'stopped']) {
    for (const approvalStatus of [null, 'pending', 'running', 'approved', 'stopped']) {
      for (const phase of ['started', 'completed', 'failed']) {
        const current = createAgentRunPresentationFixture(baselineSource, baselineNames, {
          agentApprovalMessageStore: { updateAgentRunMessage: (id: string, updater: any) => current.store.updateMessage(id, updater) },
          agentProgressMessageProjection: {
            isStoppableAgentRunStatus: (status: string) => ['planned', 'running'].includes(status),
            isStoppableAgentApprovalStatus: (status: string) => ['pending', 'running', 'awaiting-approval'].includes(status),
          },
        });
        const initial: any = { id: 'task', text: 'initial', petId: 'pet', agentRun: { status: runStatus, stages: [{ id: 'execute-tools', status: 'pending' }], trace: [{ id: 'step-read', status: 'pending' }] },
          agentApproval: approvalStatus ? { status: approvalStatus, stages: [{ id: 'execute-tools', status: 'pending' }], trace: [{ id: 'step-read', status: 'pending' }] } : null };
        current.messages[0] = initial;
        current.module('toolExecutionProgress').updateAgentToolExecutionProgressMessage({ command, messageId: 'task', phase,
          result: { ok: phase !== 'failed', responseText: 'result', receipt: { status: 'unverified', summaryLines: ['Step 1/2 read'], evidenceLines: ['Step 1/2 read'] }, observations: ['Step 1/2 read', 'observed'] } });
        const next = current.messages[0];
        if (!['planned', 'running'].includes(runStatus)) assert.equal(next.agentRun, initial.agentRun, 'terminal runs must not be revived');
        if (approvalStatus && !['pending', 'running'].includes(approvalStatus)) assert.equal(next.agentApproval, initial.agentApproval, 'terminal approvals must not be overwritten');
        if (['planned', 'running'].includes(runStatus)) assert.equal(next.agentRun.stages[0].status, 'running', 'unverified evidence keeps verification work active');
        outputs.push(json({ message: next, effects: current.effects }));
      }
    }
  }
  for (const transactional of [false, true]) {
    for (const mode of ['success', 'failed', 'throw', 'aborted', 'no-message']) {
      const transactions: any[] = [];
      const current = createAgentRunPresentationFixture(baselineSource, baselineNames, {
        agent: { ...agent, runAgentToolTransaction: async (options: any) => { const transaction = await agent.runAgentToolTransaction(options); transactions.push(json({ source: options.source, stepIndex: options.stepIndex, timing: transaction.timing })); return transaction; } },
        agentApprovalMessageStore: { updateAgentRunMessage: (id: string, updater: any) => current.store.updateMessage(id, updater) },
        agentProgressMessageProjection: { isStoppableAgentRunStatus: (status: string) => status === 'running', isStoppableAgentApprovalStatus: () => false },
      });
      current.messages[0].agentRun = { status: 'running', stages: [{ id: 'execute-tools', status: 'pending' }], trace: [{ id: 'step-read', status: 'pending' }] };
      const signal = new AbortController().signal;
      const controller = new AbortController(); if (mode === 'aborted') controller.abort();
      const actualSignal = mode === 'aborted' ? controller.signal : signal;
      let executions = 0;
      const originalError = new Error('fixture executor failure');
      const options = { command: { ...command, toolCall: { ...command.toolCall, input: { action: '  read-status  ' } } }, messageId: mode === 'no-message' ? null : 'task', signal: actualSignal,
        executor: async (_command: any, context: any) => { executions++; assert.equal(context.signal, actualSignal); assert.equal(context.petId, mode === 'no-message' ? null : 'pet'); if (mode === 'throw') throw originalError; return { ok: mode !== 'failed', responseText: 'fixture result' }; } };
      const adapter = current.module('toolExecutionAdapter');
      const execute = () => transactional ? adapter.runAgentControllerToolTransactionWithLiveProgress(options) : adapter.runAgentToolExecutorWithLiveProgress(options);
      let result;
      if (mode === 'throw' && !transactional) await assert.rejects(execute(), (error: unknown) => error === originalError);
      else { result = await execute(); assert.equal(result.ok, !['failed', 'throw'].includes(mode)); }
      assert.equal(executions, 1);
      if (mode === 'no-message') assert.equal(current.effects.length, 0);
      if (transactional) { assert.equal(transactions.length, 1); assert.equal(transactions[0].timing.detail, 'read-status'); assert.equal(transactions[0].timing.status, mode === 'aborted' ? 'cancelled' : ['failed', 'throw'].includes(mode) ? 'failed' : 'success'); }
      outputs.push(json({ result, messages: current.messages, effects: current.effects, transactions }));
    }
  }
  const display = createAgentRunPresentationFixture(baselineSource, baselineNames, { agent }).module('sessionDisplayResult');
  for (const status of ['completed', 'failed', 'needs-user', 'max-steps']) {
    for (const toolResults of [[], [{ command, result: { ok: true, responseText: 'latest' } }], [{ command, result: { ok: true, receipt: { status: 'unverified' } } }, { command, result: { ok: true, responseText: 'latest' } }]]) {
      const result = display.createAgentProductionSessionDisplayResult({ status, finalAnswer: 'session answer', toolResults }, command);
      if (toolResults.length === 2 && status !== 'completed') assert.equal(result, toolResults[0]);
      if (toolResults.length && status === 'completed') assert.equal(result, toolResults.at(-1));
      outputs.push(json(result));
    }
  }
  const conflict = createAgentRunPresentationFixture(baselineSource, baselineNames, { agent }).module('approvalConflictResult');
  outputs.push(json(conflict.createSkippedStaleOuterApprovalResult(command)));
  outputs.push(json(conflict.createRepeatedApprovalLoopResult(command, { ok: true, responseText: 'fixture executed' })));
  return outputs;
}

await exerciseAgentRunApprovalAdapters();
console.log('agent run approval adapter smoke: PASS (public exports, decisions, scoped approvals, summaries, terminal progress guards, executor/transaction delegation, evidence priority)');
