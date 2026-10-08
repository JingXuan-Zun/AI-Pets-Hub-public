import assert from 'node:assert/strict';
import {
  appendAgentRuntimeCoreEvent,
  createAgentRuntimeCoreContext,
  createAgentRuntimeCoreOpenMoveSequenceInput,
  createAgentRuntimeCoreOpenMoveTaskPlan,
  createAgentRuntimeCoreStepCompletedEvent,
  createAgentRuntimeCoreStepFailedEvent,
  createAgentRuntimeCoreStepStartedEvent,
  createAgentRuntimeCoreTaskCompletedEvent,
  createAgentRuntimeCoreTaskFailedEvent,
  resolveAgentRuntimeCoreSequenceOutcome,
  resolveAgentRuntimeCoreOpenAction,
  shouldAgentRuntimeCoreTargetOpenAsResource,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  coreSource,
  plannerSource,
  indexSource,
  controllerSource,
} = readProjectSources({
  coreSource: 'src/agent/agentRuntimeCore.ts',
  plannerSource: 'src/agent/agentPlanner.ts',
  indexSource: 'src/agent/index.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
});

assert.match(coreSource, /export interface AgentRuntimeCoreTaskPlan/u);
assert.match(coreSource, /export interface AgentRuntimeCoreContext/u);
assert.match(coreSource, /appendAgentRuntimeCoreEvent/u);
assert.match(coreSource, /export type AgentRuntimeCoreEventType/u);
assert.match(coreSource, /createAgentRuntimeCoreOpenMoveTaskPlan/u);
assert.match(coreSource, /createAgentRuntimeCoreOpenMoveSequenceInput/u);
assert.doesNotMatch(
  coreSource,
  /WeGame|Chrome|Bilibili|Live2D|Three\.js|avatar|animation/iu,
  'Runtime Core v0.1 should stay generic and must not call presentation systems.',
);
assert.match(indexSource, /export \* from '\.\/agentRuntimeCore';/u);
assert.match(plannerSource, /createAgentRuntimeCoreOpenMoveSequenceInput/u);
assert.match(plannerSource, /shouldAgentRuntimeCoreTargetOpenAsResource/u);
assert.match(controllerSource, /function getAgentRuntimeCoreEvidenceLines/u);
assert.match(controllerSource, /text\.startsWith\('RuntimeCore:'\)/u);
assert.match(controllerSource, /function mergeAgentReceiptEvidenceLines/u);
assert.match(controllerSource, /runtimeCoreLines\.slice\(0, 4\)/u);
assert.match(controllerSource, /runtimeCore: \$\{runtimeCoreLines\.join\('\s\|\s'\)\}/u);

assert.equal(shouldAgentRuntimeCoreTargetOpenAsResource('https://example.com'), true);
assert.equal(shouldAgentRuntimeCoreTargetOpenAsResource('example.com'), true);
assert.equal(shouldAgentRuntimeCoreTargetOpenAsResource('Notepad'), false);
assert.equal(resolveAgentRuntimeCoreOpenAction({ target: 'OpenAI docs', toolName: 'browser_search' }), 'search_web');
assert.equal(resolveAgentRuntimeCoreOpenAction({ target: 'https://example.com' }), 'open_resource');
assert.equal(resolveAgentRuntimeCoreOpenAction({ target: 'Notepad' }), 'launch_local_app');

const searchPlan = createAgentRuntimeCoreOpenMoveTaskPlan({
  sourceText: '/agent search docs and put it on secondary monitor',
  target: 'OpenAI docs',
  targetDisplay: 'secondary',
  toolName: 'search_web',
});
assert.equal(searchPlan.version, 1);
assert.equal(searchPlan.kind, 'open_target_and_move_window');
assert.equal(searchPlan.steps.length, 3);
assert.equal(searchPlan.steps[0]?.kind, 'open_web_or_search');
assert.equal(searchPlan.steps[0]?.action, 'search_web');
assert.equal(searchPlan.steps[1]?.kind, 'move_window');
assert.equal(searchPlan.steps[1]?.action, 'move_window_to_display');
assert.equal(searchPlan.steps[2]?.kind, 'verify_window_on_display');
assert.equal(searchPlan.events[0]?.type, 'task_started');

let context = createAgentRuntimeCoreContext(searchPlan, { now: 1000 });
assert.equal(context.taskId, searchPlan.taskId);
assert.equal(context.stepStates.length, 3);
assert.equal(context.stepStates[0]?.status, 'pending');
assert.equal(context.events[0]?.type, 'task_started');

const started = createAgentRuntimeCoreStepStartedEvent(context, searchPlan.steps[0]!.id);
assert.equal(started.type, 'step_started');
assert.equal(started.stepKind, 'open_web_or_search');
context = appendAgentRuntimeCoreEvent(context, started, { now: 1100 });
assert.equal(context.currentStepId, searchPlan.steps[0]?.id);
assert.equal(context.stepStates[0]?.status, 'running');
assert.equal(context.stepStates[0]?.attempts, 1);

const completed = createAgentRuntimeCoreStepCompletedEvent(context, searchPlan.steps[0]!.id, {
  result: 'search window opened',
  verified: true,
});
context = appendAgentRuntimeCoreEvent(context, completed, { now: 1200 });
assert.equal(context.stepStates[0]?.status, 'completed');
assert.equal(context.stepStates[0]?.verified, true);
assert.equal(context.lastEvidence, 'search window opened');

const failed = createAgentRuntimeCoreStepFailedEvent(context, searchPlan.steps[1]!.id, {
  reason: 'window move was not verified',
  recoverable: true,
});
context = appendAgentRuntimeCoreEvent(context, failed, { now: 1300 });
assert.equal(context.stepStates[1]?.status, 'failed');
assert.equal(context.stepStates[1]?.verified, false);
assert.equal(context.retryCount, 1);

const taskCompleted = createAgentRuntimeCoreTaskCompletedEvent(context, {
  summary: 'OpenAI docs confirmed on secondary display.',
});
assert.equal(taskCompleted.type, 'task_completed');
assert.equal(taskCompleted.verified, true);

const taskFailed = createAgentRuntimeCoreTaskFailedEvent(context, {
  reason: 'target window was not found',
  recoverable: false,
});
assert.equal(taskFailed.type, 'task_failed');
assert.equal(taskFailed.recoverable, false);
assert.equal(taskFailed.verified, false);

const sequenceInput = createAgentRuntimeCoreOpenMoveSequenceInput({
  sourceText: '/agent search docs and put it on secondary monitor',
  target: 'OpenAI docs',
  targetDisplay: 'secondary',
  toolName: 'search_web',
});
const steps = JSON.parse(sequenceInput.stepsJson) as Array<{ args?: Record<string, unknown>; tool?: string }>;
assert.equal(sequenceInput.postVerify, true);
assert.equal(sequenceInput.postVerifyQuery, 'OpenAI docs on secondary display');
assert.equal(steps.length, 2);
assert.equal(steps[0]?.tool, 'execute_desktop_action');
assert.equal(steps[0]?.args?.action, 'search_web');
assert.equal(steps[0]?.args?.query, 'OpenAI docs');
assert.equal(steps[1]?.args?.action, 'move_window_to_display');
assert.equal(steps[1]?.args?.targetDisplay, 'secondary');
assert.equal(steps[1]?.args?.fallbackToActiveWindow, true);

const successfulOutcome = resolveAgentRuntimeCoreSequenceOutcome(
  createAgentRuntimeCoreContext(searchPlan, { now: 2000 }),
  {
    ok: true,
    receipt: {
      evidenceLines: ['Window OpenAI docs is on secondary display.'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'Verified window is on requested display.',
    },
    responseText: 'Desktop sequence completed 2/2 step(s). Post-sequence desktop state observation succeeded.',
    stateSummary: {
      actionEvidence: {
        action: 'sequence',
        diff: {
          changed: true,
          signals: ['stepsCompleted=2/2'],
          summary: 'Desktop sequence completed and available evidence supports a state change.',
        },
        outcome: 'changed',
        timestamp: 2001,
        tool: 'execute_desktop_sequence',
      },
      structuredEvidence: {
        status: 'success',
      },
    },
    verification: 'Verified window is on requested display.',
  },
);
assert.equal(successfulOutcome.completed, true);
assert.equal(successfulOutcome.verified, true);
assert.equal(successfulOutcome.events.at(-1)?.type, 'task_completed');
assert.equal(successfulOutcome.context.stepStates.every((step) => step.status === 'completed'), true);
assert.equal(successfulOutcome.context.stepStates.at(-1)?.verified, true);

const unverifiedOutcome = resolveAgentRuntimeCoreSequenceOutcome(
  createAgentRuntimeCoreContext(searchPlan, { now: 3000 }),
  {
    ok: true,
    assessment: {
      evidence: ['Post-sequence observation was inconclusive.'],
      status: 'unverified',
      summary: 'Desktop sequence steps completed, but post-sequence verification did not confirm the requested final state.',
    },
    receipt: {
      evidenceLines: ['Post-sequence verification was inconclusive.'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence verification was inconclusive.',
    },
    responseText: 'Desktop sequence completed 2/2 step(s). Post-sequence desktop state observation was inconclusive.',
    stateSummary: {
      actionEvidence: {
        action: 'sequence',
        diff: {
          changed: null,
          signals: ['stepsCompleted=2/2'],
          summary: 'Desktop sequence ran, but available evidence is insufficient to verify the requested state change.',
        },
        outcome: 'uncertain',
        timestamp: 3001,
        tool: 'execute_desktop_sequence',
      },
      missingEvidence: ['Post-sequence window/app/display observation did not verify the requested final desktop state.'],
      structuredEvidence: {
        status: 'unverified',
      },
    },
    verification: 'Post-sequence verification was inconclusive.',
  },
);
assert.equal(unverifiedOutcome.completed, false);
assert.equal(unverifiedOutcome.verified, false);
assert.equal(unverifiedOutcome.events.at(-1)?.type, 'task_failed');
assert.equal(unverifiedOutcome.context.stepStates.at(-1)?.status, 'failed');
assert.equal(unverifiedOutcome.context.stepStates.at(-1)?.verified, false);

const failedOutcome = resolveAgentRuntimeCoreSequenceOutcome(
  createAgentRuntimeCoreContext(searchPlan, { now: 4000 }),
  {
    errorText: 'Desktop sequence failed at step 2.',
    ok: false,
    receipt: {
      evidenceLines: ['Step 2 failed.'],
      status: 'failed',
      summaryLines: ['Call: execute_desktop_sequence'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'execute_desktop_sequence failed at step 2.',
    },
    responseText: 'Desktop sequence stopped after 1/2 successful step(s). Step 2 failed.',
    stateSummary: {
      actionEvidence: {
        action: 'sequence',
        diff: {
          changed: null,
          signals: ['stepsCompleted=1/2', 'failedStep=2'],
          summary: 'Desktop sequence was blocked or failed before a verified final state.',
        },
        outcome: 'blocked',
        timestamp: 4001,
        tool: 'execute_desktop_sequence',
      },
      missingEvidence: ['Desktop sequence failed at step 2.'],
      structuredEvidence: {
        status: 'failed',
      },
    },
    verification: 'execute_desktop_sequence failed at step 2.',
  },
);
assert.equal(failedOutcome.completed, false);
assert.equal(failedOutcome.verified, false);
assert.equal(failedOutcome.events.at(-1)?.type, 'task_failed');
assert.equal(failedOutcome.events.at(-1)?.recoverable, false);

console.log('agent runtime core v0.2 smoke ok');
