import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createPreviousSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start the visible app from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'interact_window_ui',
              automationId: 'start-primary',
              controlType: 'Button',
              fallbackX: 1440,
              fallbackY: 920,
              hwnd: 4321,
              query: 'Launcher',
              targetText: 'Start',
              uiAction: 'invoke',
              x: 1440,
              y: 920,
            },
            reason: 'Invoke the first visible Start control.',
            tool: 'execute_desktop_action',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createBlockedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action UI state: unchanged'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action UI state: unchanged'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence UI state is unchanged.',
    },
    responseText: 'Invoked the first Start control, but the requested app was not confirmed launched.',
    stateSummary: {
      missingEvidence: ['The requested app was not confirmed launched.'],
      observedState: ['Post-action UI state: unchanged'],
      structuredEvidence: {
        postActionState: 'unchanged',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
    },
    verification: 'Post-sequence UI state is unchanged.',
  };
}

function createRecoveryResult(evidence: AgentStructuredToolEvidence): AgentChatCommandResult {
  return {
    observations: [
      'Desktop observation: inspect_window_ui',
      'Matched controls: Start type=Button actions=invoke id=start-primary',
      'Matched controls: Start type=Button actions=invoke id=start-secondary',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Recovery read found multiple Start UIA candidates.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: UIA action candidates found'],
      title: 'Post-action recovery candidate read',
      toolName: 'locate_screen_elements',
      verification: 'Start candidates are visible.',
    },
    responseText: 'Recovery read found multiple Start controls for Example Game.',
    stateSummary: {
      observedState: ['Window UI query: Launcher', 'Target text: Example Game Start'],
      structuredEvidence: evidence,
      verificationEvidence: ['Recovery read found multiple Start UIA candidates.'],
    },
    verification: 'Start candidates are visible.',
  };
}

const recoveryCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createPreviousSequenceCommand(),
    result: createBlockedSequenceResult(),
  },
  maxSteps: 2,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called for UIA candidate recovery ranking');
  },
  settings,
  sourceText: '/agent start the visible app from the launcher',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return createRecoveryResult({
      actionCandidates: [
        {
          actions: ['invoke'],
          automationId: 'start-primary',
          center: {
            coordinateSpace: 'native-screen',
            source: 'ui-automation',
            x: 1440,
            y: 920,
          },
          confidence: 'high',
          controlType: 'Button',
          description: 'Start id=start-primary type=Button actions=invoke',
          enabled: true,
          label: 'Start id=start-primary',
          name: 'Start',
          offscreen: false,
          relation: 'Start control belongs to Example Game',
          source: 'ui-automation',
          window: {
            hwnd: 4321,
            processName: 'Launcher.exe',
            title: 'Launcher',
          },
        },
        {
          actions: ['invoke'],
          automationId: 'start-secondary',
          center: {
            coordinateSpace: 'native-screen',
            source: 'ui-automation',
            x: 1510,
            y: 940,
          },
          confidence: 'medium',
          controlType: 'Button',
          description: 'Start id=start-secondary type=Button actions=invoke',
          enabled: true,
          label: 'Start id=start-secondary',
          name: 'Start',
          offscreen: false,
          relation: 'Start control belongs to Example Game',
          source: 'ui-automation',
          window: {
            hwnd: 4321,
            processName: 'Launcher.exe',
            title: 'Launcher',
          },
        },
      ],
      confidence: 'high',
      coordinateConfidence: 'high',
      primaryAction: 'Start',
      relation: 'Start controls are visible near Example Game.',
      status: 'success',
      targetMatched: 'Example Game',
      visualActionReadiness: 'ready',
    });
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /start-secondary/u);
assert.match(stepsJson, /1510/u);
assert.match(stepsJson, /940/u);
assert.doesNotMatch(stepsJson, /start-primary/u);

console.log('agent session v2 window ui candidate recovery smoke ok');
