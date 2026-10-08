import assert from 'node:assert/strict';
import * as agent from '../src/agent';
import * as statusProjection from '../src/components/chat/agentRuntimeUiStatusProjection';
import * as compatibility from '../src/components/chat/chatAgentRuntimeCompatibility';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

const projections = {
  runResultProjection: ['projectAgentRunResult', 'projectAgentRunContinuationResult'],
  approvalDecisionProjection: ['projectAgentApprovalDenied', 'projectAgentApprovalAccepted'],
  approvalResultProjection: ['projectAgentUnsupportedApproval', 'projectAgentApprovalResult'],
  approvalContinuationProjection: ['projectAgentDuplicateApproval', 'projectAgentApprovalContinuationResult', 'projectAgentDuplicateFollowUpApproval'],
  approvalFailureProjection: ['projectAgentApprovalFailure'],
};
const names = Object.values(projections).flat();
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function freeze(value: any): any {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function exerciseAgentRunLifecycleProjections(baselineSource?: string) {
  const fixture = createAgentRunPresentationFixture(baselineSource, names, {
    agent, agentRuntimeUiStatusProjection: statusProjection, chatAgentRuntimeCompatibility: compatibility,
  });
  const functions = Object.fromEntries(Object.entries(projections).flatMap(([module, exports]) => {
    const loaded = fixture.module(module);
    return exports.map(name => [name, loaded[name]]);
  }));
  const stages = fixture.module('workStageCreation');
  const traces = fixture.module('runTraceCreation');
  const command: any = { kind: 'tool-call', sourceText: '读取窗口', toolCall: { name: 'get_system_info', input: {} } };
  const plan: any = { goal: '读取窗口', instruction: '读取窗口', steps: [{ id: 'read', summary: '读取', decision: { mode: 'silent', reason: 'read' } }] };
  // The baseline controller imports these creators indirectly; obtain them
  // from the same current implementation in either side of the differential.
  const actualFixture = baselineSource ? createAgentRunPresentationFixture(undefined, [], { agent }) : fixture;
  const workStages = (baselineSource ? actualFixture.module('workStageCreation') : stages).createAgentWorkStages(plan, { needsApproval: true });
  const runTrace = (baselineSource ? actualFixture.module('runTraceCreation') : traces).createAgentRunTrace(plan, { needsApproval: true });
  const outputs: unknown[] = [];
  for (const status of ['completed', 'needs-approval', 'needs-user', 'failed', 'max-steps', 'budget-exceeded', 'cancelled', 'running']) {
    for (const shape of ['both', 'run', 'approval', 'neither']) {
      for (const outcome of ['success', 'failed', 'unverified', 'missing']) {
        for (const hide of [false, true]) {
          const continuation: any = { taskState: { taskId: 'same-task', revision: 5 }, sourceText: 'original input', userGoal: 'original goal' };
          const groupTaskEvent: any = { taskId: 'group-task', summary: 'group summary', outcome: 'completed' };
          const approval: any = { command, plan, status: 'pending', stages: workStages, trace: runTrace };
          const message: any = {
            id: 'task', role: 'model', text: 'old visible reply', petId: 'pet', chatMode: 'group', unrelated: 'preserve',
            agentRun: ['both', 'run'].includes(shape) ? { command, status: 'running', stages: workStages, trace: runTrace, agentSessionV2: continuation, followUpText: 'old follow-up' } : null,
            agentApproval: ['both', 'approval'].includes(shape) ? approval : null,
          };
          const toolResult: any = { ok: outcome !== 'failed', responseText: 'tool result', followUp: 'ask next', followUpActions: [] };
          if (outcome === 'failed') toolResult.errorText = 'tool error';
          if (outcome !== 'missing') toolResult.assessment = { status: outcome === 'success' ? 'completed' : outcome, summary: 'evidence summary', evidence: ['observed'] };
          const sessionResult: any = { status, finalAnswer: 'session result', continuation, steps: [], toolResults: [], pendingApproval: { command, plan },
            taskState: outcome === 'missing' ? null : { state: outcome === 'success' ? 'succeeded' : outcome === 'failed' ? 'failed' : 'waiting_approval' } };
          const runStatus = statusProjection.getAgentTaskRuntimeRunStatus(sessionResult);
          const args: any = {
            result: toolResult, displayResult: { command, result: toolResult }, shouldHideRunFollowUps: hide,
            runStatus, deniedGroupTaskEvent: groupTaskEvent, approval, approvalRuntime: hide ? null : continuation,
            nextGroupTaskEvent: groupTaskEvent, sessionResult, shouldHideApprovalFollowUps: hide,
            approvalRunStatus: statusProjection.resolveAgentApprovalUiStatus(runStatus), taskRunStatus: runStatus,
            duplicateResult: toolResult, continuationGroupTaskEvent: groupTaskEvent,
            continuationSessionResult: sessionResult, continuationStatus: runStatus,
            pendingReadOnlyFollowUpApproval: { command, plan }, failedGroupTaskEvent: groupTaskEvent, errorText: 'fixture failure',
          };
          const input = json({ message, args });
          freeze(message); freeze(args);
          for (const name of names) {
            const options = ['projectAgentRunResult', 'projectAgentRunContinuationResult'].includes(name)
              ? { ...args, result: sessionResult } : args;
            const projected = functions[name](message, options);
            assert.equal(projected.id, message.id); assert.equal(projected.petId, message.petId);
            assert.equal(projected.unrelated, 'preserve');
            assert.notEqual(projected, message);
            assert.equal(projected.agentRun === null, message.agentRun === null);
            assert.equal(projected.agentApproval === null, message.agentApproval === null);
            if (name === 'projectAgentApprovalDenied' || name.startsWith('projectAgentDuplicate')) {
              if (projected.agentRun) assert.equal(projected.agentRun.status, 'blocked');
              if (projected.agentRun) assert.equal(projected.agentRun.followUpText, null);
            }
            if (name === 'projectAgentApprovalAccepted' && projected.agentRun) {
              assert.equal(projected.agentRun.agentRuntime, continuation, 'acceptance preserves current or legacy continuation identity');
            }
            if (name === 'projectAgentRunContinuationResult' && projected.agentRun) {
              assert.equal(projected.agentRun.status, runStatus, 'task state takes precedence over legacy result status');
            }
            if (name === 'projectAgentApprovalResult' && projected.agentApproval) {
              assert.equal(projected.agentApproval.agentRuntime, continuation);
              assert.equal(projected.agentApproval.followUpText, hide ? null : 'ask next');
            }
            outputs.push(json({ name, status, shape, outcome, hide, projected }));
          }
          assert.deepEqual(json({ message, args }), input, 'projection must not mutate messages or runtime results');
        }
      }
    }
  }
  assert.equal(fixture.effects.length, 0, 'pure projections must not write stores or publish lifecycle events');
  return outputs;
}

const results = exerciseAgentRunLifecycleProjections();
console.log(`agent run lifecycle projection smoke: PASS (${results.length} projections; immutable inputs, message identity, continuation identity, denied/blocked follow-ups; no effects)`);
