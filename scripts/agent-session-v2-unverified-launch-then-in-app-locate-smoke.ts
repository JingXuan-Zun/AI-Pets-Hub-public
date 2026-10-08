import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createLaunchCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'open Example Game inside Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Game inside Example Launcher',
    toolCall: {
      goal: 'open Example Game inside Example Launcher',
      input: {
        action: 'launch_local_app',
        target: 'Example Launcher',
      },
      name: 'execute_desktop_action',
    },
  };
}

function createUnverifiedLaunchResult(): AgentChatCommandResult {
  return {
    observations: [
      'Tool: execute_desktop_action',
      'Desktop action: launch_local_app',
      'Launch status: launched-unverified',
      'Launch query: Example Launcher',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Launch status: launched-unverified',
        'Launch query: Example Launcher',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_action',
        'Result: launch request accepted, final visible state unverified',
      ],
      title: 'Execution receipt',
      toolName: 'execute_desktop_action',
      verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
    },
    responseText: 'Launch status: launched-unverified',
    verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
  };
}

const observedTools: string[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createLaunchCommand(),
    result: createUnverifiedLaunchResult(),
  },
  maxSteps: 6,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    assert.match(userInput, /tool=locate_screen_elements/u);
    assert.match(userInput, /target=Example Game/u);
    assert.match(userInput, /primaryAction=Launch/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1715,
              y: 1050,
            },
            reason: 'Click the launch action associated with Example Game.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'The in-app target and associated action are verified, so prepare one approval-gated click.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings,
  sourceText: '/agent open Example Game inside Example Launcher',
  toolExecutor: async (command) => {
    observedTools.push(command.toolCall?.name ?? command.kind);

    if (command.toolCall?.name === 'execute_desktop_observation') {
      return {
        observations: [
          'Waited briefly after launch request.',
          'Post-action visual state: waiting for target window.',
        ],
        ok: true,
        responseText: 'Post-action wait completed; target window still not confirmed.',
        verification: 'Waited for the app window to appear.',
      };
    }

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      assert.equal(command.toolCall.input.includeInstalledApps, false);
      assert.equal(command.toolCall.input.includeTaskbarPinned, false);
      return {
        observations: [
          'Observed apps/windows: running=1. Active window: Example Launcher - Home.',
          'Running sample: 1. ExampleLauncher pid=100 hwnd=200 display="Primary" title="Example Launcher - Home"',
        ],
        ok: true,
        responseText: 'Observed apps/windows: running=1. Active window: Example Launcher - Home.',
        stateSummary: {
          observedState: [
            'Active window: Example Launcher - Home',
            'Running window: ExampleLauncher title="Example Launcher - Home"',
          ],
          structuredEvidence: {
            finalWindow: {
              displayLabel: 'Primary',
              hwnd: 200,
              pid: 100,
              processName: 'ExampleLauncher',
              title: 'Example Launcher - Home',
            },
            status: 'success',
            targetCandidates: [
              {
                confidence: 'high',
                label: 'ExampleLauncher - Example Launcher - Home',
                source: 'observe_windows_and_apps',
                window: {
                  displayLabel: 'Primary',
                  hwnd: 200,
                  pid: 100,
                  processName: 'ExampleLauncher',
                  title: 'Example Launcher - Home',
                },
              },
            ],
            targetMatched: 'ExampleLauncher - Example Launcher - Home',
          },
          verificationEvidence: ['Example Launcher window is active.'],
        },
        verification: 'Example Launcher window is active.',
      };
    }

    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.toolCall.input.sourceQuery, 'Example Launcher');
      assert.equal(command.toolCall.input.targetText, 'Example Game');
      return {
        observations: [
          'Visual target matched: Example Game',
          'Visual primary action: Launch',
          'Visual element region: bottom right, button center around x=1715 y=1050',
          'Visual target/action relation: Launch belongs to Example Game',
        ],
        ok: true,
        responseText: 'Screen element observation: Example Game launch action is visible.',
        stateSummary: {
          observedState: [
            'Visual target matched: Example Game',
            'Visual primary action: Launch',
            'Visual target/action relation: Launch belongs to Example Game',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            // Declared bounds let the actionable-area gate accept the point.
            elementBounds: {
              coordinateSpace: 'native-screen',
              height: 44,
              source: 'test',
              width: 150,
              x: 1640,
              y: 1028,
            },
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1715,
              y: 1050,
            },
            primaryAction: 'Launch',
            relation: 'Launch belongs to Example Game',
            status: 'success',
            targetMatched: 'Example Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Example Game launch action is ready.'],
        },
        verification: 'locate_screen_elements verified the target and launch action.',
      };
    }

    throw new Error(`unexpected tool ${command.toolCall?.name ?? command.kind}`);
  },
  userGoal: 'open Example Game inside Example Launcher',
});

assert.ok(observedTools.includes('execute_desktop_observation'), observedTools.join(','));
assert.ok(observedTools.includes('observe_windows_and_apps'), observedTools.join(','));
assert.ok(observedTools.includes('locate_screen_elements'), observedTools.join(','));
assert.ok(modelCallCount <= 1, `expected no repeated model decision after verified window, got ${modelCallCount}`);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate/u);

console.log('agent session v2 unverified launch then in-app locate smoke ok');
