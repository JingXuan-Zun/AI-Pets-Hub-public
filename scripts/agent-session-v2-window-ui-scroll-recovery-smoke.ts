import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createScrollSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'window-ui-interaction',
    instruction: 'scroll Advanced settings into view in Settings',
    kind: 'tool-call',
    sourceText: '/agent scroll Advanced settings into view in Settings, then open it',
    toolCall: {
      goal: 'scroll Advanced settings into view in Settings, then open it',
      input: {
        postVerifyVisualQuery: 'Advanced settings should be visible and openable in Settings',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'interact_window_ui',
              automationId: 'advanced-settings-item',
              hwnd: 9876,
              query: 'Settings',
              targetText: 'Advanced settings',
              uiAction: 'scroll_into_view',
            },
            reason: 'Scroll the UI Automation list item into view.',
            tool: 'execute_desktop_action',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createUnverifiedScrollResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: unknown',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_sequence',
        'Steps completed: 1',
      ],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The scroll action completed, but the requested final state is not yet verified.',
    },
    responseText: 'Desktop sequence completed 1/1 step(s). The UIA scroll action completed, but the target still needs a refreshed UIA read.',
    stateSummary: {
      missingEvidence: [
        'Post-sequence visual state is unknown, so the requested final state is not yet confirmed.',
      ],
      observedState: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: unknown',
      ],
      recommendedRecovery: [
        'postActionRecoveryStrategy=refresh-observation | nextTool=execute_desktop_observation | nextArgs={"action":"inspect_window_ui","forceRefresh":true,"query":"Settings","targetText":"Advanced settings"}',
      ],
      structuredEvidence: {
        confidence: 'low',
        postActionRecovery: {
          nextArgs: {
            action: 'inspect_window_ui',
            forceRefresh: true,
            hwnd: 9876,
            limit: 80,
            maxDepth: 6,
            query: 'Settings',
            targetText: 'Advanced settings',
          },
          nextTool: 'execute_desktop_observation',
          reason: 'After scroll_into_view, refresh the current UI Automation tree before invoking the now-visible control.',
          strategy: 'refresh-observation',
        },
        postActionState: 'unknown',
        status: 'unverified',
        targetMatched: 'Advanced settings',
      },
      verificationEvidence: [
        'UIA scroll completed, but visibility/actionability must be refreshed.',
      ],
    },
    verification: 'execute_desktop_sequence completed all steps in order. Post-sequence verification: unknown.',
  };
}

function createRecoveredVisibleWindowUiResult(): AgentChatCommandResult {
  return {
    observations: [
      'Desktop observation: inspect_window_ui',
      'Window UI query: Settings',
      'Target text: Advanced settings',
      'Matched controls: Advanced settings id=advanced-settings-item type=ListItem center=1180,720 actions=invoke enabled=true offscreen=false',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Window UI query: Settings',
        'Target text: Advanced settings',
        'Matched controls: Advanced settings id=advanced-settings-item type=ListItem center=1180,720 actions=invoke enabled=true offscreen=false',
      ],
      status: 'success',
      summaryLines: [
        'Call: execute_desktop_observation inspect_window_ui',
        'Window: Settings',
        'Matched: 1',
      ],
      title: 'Agent window UI inspection',
      toolName: 'execute_desktop_observation',
      verification: 'Read current UI Automation controls from Settings.',
    },
    responseText: 'Inspected UI controls in Settings. controls=20, matched=1, actionable=1',
    stateSummary: {
      missingEvidence: [],
      observedState: [
        'Window UI query: Settings',
        'Target text: Advanced settings',
        'UI Automation controls: 20',
      ],
      recommendedRecovery: [],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['invoke'],
            automationId: 'advanced-settings-item',
            bounds: {
              coordinateSpace: 'native-screen',
              height: 48,
              source: 'ui-automation',
              width: 260,
              x: 1050,
              y: 696,
            },
            center: {
              coordinateSpace: 'native-screen',
              source: 'ui-automation',
              x: 1180,
              y: 720,
            },
            confidence: 'high',
            controlType: 'ListItem',
            description: 'Advanced settings id=advanced-settings-item type=ListItem actions=invoke enabled=true offscreen=false',
            enabled: true,
            keyboardFocusable: true,
            label: 'Advanced settings id=advanced-settings-item type=ListItem',
            name: 'Advanced settings',
            offscreen: false,
            relation: 'After scroll_into_view, UI Automation reports the target as visible and invokable.',
            source: 'ui-automation',
            window: {
              hwnd: 9876,
              processName: 'Settings.exe',
              title: 'Settings',
            },
          },
        ],
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'ui-automation',
          x: 1180,
          y: 720,
        },
        primaryAction: 'open Advanced settings',
        relation: 'The refreshed UIA tree exposes the target as a visible invokable item.',
        status: 'success',
        targetMatched: 'Advanced settings',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: [
        'UI Automation returned the target as visible and invokable.',
      ],
    },
    verification: 'Window UI inspection returned the visible target control.',
  };
}

let modelCallCount = 0;
const recoveryCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createScrollSequenceCommand(),
    result: createUnverifiedScrollResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called before automatic UIA scroll recovery prepares approval');
  },
  settings,
  sourceText: '/agent scroll Advanced settings into view in Settings, then open it',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.hwnd, 9876);
    assert.equal(command.toolCall.input.query, 'Settings');
    assert.equal(command.toolCall.input.targetText, 'Advanced settings');
    assert.equal(command.toolCall.input.recoveryPostActionState, 'unknown');
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
    assert.match(String(command.toolCall.input.question), /Do not click or invoke anything/u);
    return createRecoveredVisibleWindowUiResult();
  },
  userGoal: 'scroll Advanced settings into view in Settings, then open it',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /advanced-settings-item/u);
assert.match(stepsJson, /1180/u);
assert.match(stepsJson, /720/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.match(result.continuation.historyLines.join('\n'), /inspect_window_ui/u);
assert.match(result.continuation.historyLines.join('\n'), /visual-action approval after auto recovery/u);

console.log('agent session v2 window ui scroll recovery smoke ok');
