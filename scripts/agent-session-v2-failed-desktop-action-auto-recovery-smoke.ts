import assert from 'node:assert/strict';
import {
  AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER,
  createAgentDesktopFailedDesktopActionRecoveryCommand,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const settings = {} as PetConfig['settings'];
const failedRecoveryMarker = AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER;
const {
  compatibilityBuilder: compatibilityBuilderSource,
  recoveryCommandBuilder: recoveryCommandBuilderSource,
  session: sessionSource,
  toolCommandFactory: toolCommandFactorySource,
} = readProjectSources({
  compatibilityBuilder: 'src/agent/capabilities/agentDesktopRecoveryCommandBuilder.ts',
  recoveryCommandBuilder: 'src/agent/capabilities/agentDesktopRecoveryCommandBuilder.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  toolCommandFactory: 'src/agent/runtime/agentToolCommandFactory.ts',
});

assertSourceMatches(
  recoveryCommandBuilderSource,
  /export function createAgentDesktopFailedDesktopActionRecoveryCommand/u,
  'Desktop Recovery Capability should own failed desktop action recovery command construction.',
);
assertSourceMatches(
  toolCommandFactorySource,
  /export function createAgentToolCommand/u,
  'Runtime Tool Command Factory should own version-neutral command construction.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2FailedDesktopActionRecoveryCommand/u,
  'AgentSessionV2 should not own failed desktop action recovery command construction.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function resolveAgentSessionV2AutoRecoveryQuery/u,
  'AgentSessionV2 should not own shared recovery query resolution.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2ToolCommand/u,
  'AgentSessionV2 should not own the generic tool command factory.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/capabilities\/agentDesktopRecoveryCommandBuilder'/u,
  'AgentSessionV2 should consume the Desktop Recovery Capability directly.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentToolCommandFactory'/u,
  'AgentSessionV2 should consume Runtime Tool Command Factory directly.',
);

function createSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start Example Game inside Launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'start Example Game inside Launcher',
      input: {
        postVerifyVisualQuery: 'Example Game',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              button: 'left',
              x: 1440,
              y: 920,
            },
            reason: 'Click the previously located Start button.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createFailedSequenceResult(): AgentChatCommandResult {
  return {
    errorText: 'The click did not activate the target. The previous coordinate may be stale.',
    ok: false,
    responseText: 'The approved click sequence failed before the target opened.',
    stateSummary: {
      missingEvidence: [
        'Current actionable UI control is unknown after the failed click.',
        'Need current window controls before retrying.',
      ],
      observedState: [
        'Launcher window is still visible after the failed click.',
      ],
      recommendedRecovery: [
        'Inspect current window UI controls before retrying the action.',
      ],
    },
    verification: 'Target was not opened after the approved click.',
  };
}

const windowObservationRecoveryCommand = createAgentDesktopFailedDesktopActionRecoveryCommand({
  latestEntry: {
    command: {
      capabilityId: 'app-launcher',
      instruction: 'open Example Launcher',
      kind: 'tool-call',
      sourceText: '/agent open Example Launcher',
      toolCall: {
        goal: 'open Example Launcher',
        input: {
          action: 'open',
          target: 'Example Launcher',
        },
        name: 'execute_desktop_action',
      },
    },
    result: {
      errorText: 'The target app did not become active.',
      ok: false,
      responseText: 'Desktop action failed.',
    },
  },
  sourceText: '/agent open Example Launcher',
  toolResults: [],
  userGoal: 'open Example Launcher',
});
assert.equal(windowObservationRecoveryCommand?.toolCall?.name, 'observe_windows_and_apps');
assert.equal(windowObservationRecoveryCommand.toolCall.input.query, 'Example Launcher');
assert.match(String(windowObservationRecoveryCommand.toolCall.input.recoveryReason), new RegExp(failedRecoveryMarker, 'u'));

const repeatedWindowObservationRecoveryCommand = createAgentDesktopFailedDesktopActionRecoveryCommand({
  latestEntry: {
    command: {
      capabilityId: 'app-launcher',
      instruction: 'open Example Launcher',
      kind: 'tool-call',
      sourceText: '/agent open Example Launcher',
      toolCall: {
        goal: 'open Example Launcher',
        input: {
          action: 'open',
          target: 'Example Launcher',
        },
        name: 'execute_desktop_action',
      },
    },
    result: {
      errorText: 'The target app did not become active.',
      ok: false,
      responseText: 'Desktop action failed.',
    },
  },
  sourceText: '/agent open Example Launcher',
  toolResults: [{
    command: windowObservationRecoveryCommand,
    result: {
      ok: true,
      responseText: 'Observed windows after failure.',
    },
  }],
  userGoal: 'open Example Launcher',
});
assert.equal(
  repeatedWindowObservationRecoveryCommand,
  null,
  'Failed desktop action recovery should remain budgeted and avoid repeated recovery reads.',
);

let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createSequenceCommand(),
    result: createFailedSequenceResult(),
  },
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called before failed desktop action recovery prepares approval');
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.query, 'Example Game');
    assert.equal(command.toolCall.input.targetText, 'Example Game');
    assert.match(String(command.toolCall.input.question), new RegExp(failedRecoveryMarker, 'u'));
    assert.match(String(command.toolCall.input.question), /Do not click, invoke, type, focus, move, or change anything/u);

    return {
      observations: [
        'Desktop observation: inspect_window_ui',
        'Matched controls: Example Game id=game-launch type=Button center=830,564 actions=invoke matchScore=100',
      ],
      ok: true,
      responseText: 'Read current UI controls after the failed click. matched=1, actionable=1',
      stateSummary: {
        observedState: [
          'Window UI query: Example Game',
          'Target text: Example Game',
          'UI Automation controls: 5',
        ],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['invoke'],
              automationId: 'game-launch',
              bounds: {
                coordinateSpace: 'native-screen',
                height: 48,
                source: 'ui-automation',
                width: 180,
                x: 740,
                y: 540,
              },
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 830,
                y: 564,
              },
              confidence: 'high',
              controlType: 'Button',
              description: 'Example Game id=game-launch type=Button actions=invoke depth=3',
              enabled: true,
              label: 'Example Game id=game-launch type=Button',
              name: 'Example Game',
              region: 'Button',
              relation: 'UI Automation reports this control as actionable.',
              source: 'ui-automation',
              window: {
                hwnd: 1001,
                processName: 'Launcher.exe',
                title: 'Launcher',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 48,
            source: 'ui-automation',
            width: 180,
            x: 740,
            y: 540,
          },
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'ui-automation',
            x: 830,
            y: 564,
          },
          elementDescription: 'Example Game id=game-launch type=Button',
          primaryAction: 'Example Game id=game-launch type=Button',
          relation: 'The target text matched an actionable UI Automation control.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [
          'UI Automation returned a fresh actionable control after the failed click.',
        ],
      },
      verification: 'Current UI inspection returned an enabled actionable control.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(toolCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /game-launch/u);
assert.match(stepsJson, /830/u);
assert.match(stepsJson, /564/u);
assert.doesNotMatch(stepsJson, /"x":1440/u);
assert.match(result.continuation.historyLines.join('\n'), /failed desktop action recovery result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after failed desktop action recovery/u);

console.log('agent session v2 failed desktop action auto recovery smoke ok');
