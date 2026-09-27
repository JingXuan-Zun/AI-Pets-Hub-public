import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createUiaSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start Example Game inside Launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'start Example Game inside Launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'interact_window_ui',
              automationId: 'example-game-start',
              controlType: 'Button',
              fallbackX: 1440,
              fallbackY: 920,
              hwnd: 1001,
              query: 'Launcher',
              targetText: 'Example Game Start',
              uiAction: 'invoke',
              x: 1440,
              y: 920,
            },
            reason: 'Invoke the UI Automation launch control.',
            tool: 'execute_desktop_action',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createUnchangedUiaSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: unchanged',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_sequence',
        'Steps completed: 1',
        'Failed step: none',
      ],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-action visual verification found no visible change.',
    },
    responseText: 'Desktop sequence completed 1/1 step(s). Post-sequence desktop state observation was inconclusive.',
    stateSummary: {
      missingEvidence: [
        'Post-sequence visual state is unchanged, so the requested final state is not yet confirmed.',
      ],
      observedState: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: unchanged',
      ],
      recommendedRecovery: [
        'postActionRecoveryStrategy=refresh-observation | nextTool=execute_desktop_observation | nextArgs={"action":"inspect_window_ui","forceRefresh":true,"query":"Launcher","targetText":"Example Game"}',
      ],
      structuredEvidence: {
        confidence: 'low',
        postActionRecovery: {
          nextArgs: {
            action: 'inspect_window_ui',
            forceRefresh: true,
            hwnd: 1001,
            limit: 80,
            maxDepth: 6,
            query: 'Launcher',
            targetText: 'Example Game',
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The UI did not visibly change after a UI Automation action. Refresh controls before retrying.',
          strategy: 'refresh-observation',
        },
        postActionState: 'unchanged',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
      verificationEvidence: [
        'UI Automation action returned success, but post-action visual verification did not confirm launch.',
      ],
    },
    verification: 'execute_desktop_sequence completed all steps in order. Post-sequence verification: unchanged.',
  };
}

function createSameControlRecoveryResult(): AgentChatCommandResult {
  return {
    observations: [
      'Desktop observation: inspect_window_ui',
      'Window UI query: Launcher',
      'Target text: Example Game',
      'Matched controls: Example Game Start id=example-game-start type=Button center=1440,920 actions=invoke enabled=true',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'Matched controls: Example Game Start id=example-game-start type=Button center=1440,920 actions=invoke enabled=true',
      ],
      status: 'success',
      summaryLines: [
        'Call: execute_desktop_observation inspect_window_ui',
        'Window: Launcher',
        'Matched: 1',
      ],
      title: 'Agent window UI inspection',
      toolName: 'execute_desktop_observation',
      verification: 'Read current UI Automation controls from Launcher.',
    },
    responseText: 'Inspected UI controls in Launcher. controls=4, matched=1, actionable=1',
    stateSummary: {
      missingEvidence: [],
      observedState: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'UI Automation controls: 4',
      ],
      recommendedRecovery: [],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['invoke'],
            automationId: 'example-game-start',
            bounds: {
              coordinateSpace: 'native-screen',
              height: 44,
              source: 'ui-automation',
              width: 150,
              x: 1365,
              y: 898,
            },
            center: {
              coordinateSpace: 'native-screen',
              source: 'ui-automation',
              x: 1440,
              y: 920,
            },
            confidence: 'high',
            controlType: 'Button',
            description: 'Example Game Start id=example-game-start type=Button actions=invoke enabled=true',
            enabled: true,
            keyboardFocusable: true,
            label: 'Example Game Start id=example-game-start type=Button',
            name: 'Example Game Start',
            offscreen: false,
            relation: 'UI Automation reports this same control is still visible after the unchanged invoke.',
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
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'ui-automation',
          x: 1440,
          y: 920,
        },
        primaryAction: 'Start',
        relation: 'After the unchanged UIA invoke, the refreshed UIA tree still exposes the same actionable control.',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: [
        'UI Automation returned the same actionable control after the unchanged invoke.',
      ],
    },
    verification: 'Window UI inspection returned refreshed current controls.',
  };
}

let modelCallCount = 0;
const recoveryCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createUiaSequenceCommand(),
    result: createUnchangedUiaSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called before automatic UIA same-control fallback prepares approval');
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.hwnd, 1001);
    assert.equal(command.toolCall.input.query, 'Launcher');
    assert.equal(command.toolCall.input.targetText, 'Example Game');
    assert.equal(command.toolCall.input.recoveryPostActionState, 'unchanged');
    return createSameControlRecoveryResult();
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /execute_desktop_input/u);
assert.match(stepsJson, /"action":"click"/u);
assert.match(stepsJson, /"x":1440/u);
assert.match(stepsJson, /"y":920/u);
assert.doesNotMatch(stepsJson, /interact_window_ui/u);
assert.doesNotMatch(stepsJson, /"uiAction":"invoke"/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.match(result.continuation.historyLines.join('\n'), /visual-action approval after auto recovery/u);

console.log('agent session v2 UIA unchanged same-control coordinate fallback smoke ok');
