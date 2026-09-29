import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createInspectWindowUiCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'inspect disabled launcher button',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'inspect disabled launcher button',
      input: {
        action: 'inspect_window_ui',
        forceRefresh: true,
        query: 'Launcher',
        targetText: 'Example Game',
      },
      name: 'execute_desktop_observation',
    },
  };
}

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createInspectWindowUiCommand(),
    result: {
      observations: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'Matched controls: Example Game Start enabled=false',
        'Control sample: Loading game resources 42%',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Matched controls: Example Game Start enabled=false',
          'Control sample: Loading game resources 42%',
        ],
        status: 'success',
        summaryLines: [
          'Call: execute_desktop_observation inspect_window_ui',
          'Matched: 1',
        ],
        title: 'Agent window UI inspection',
        toolName: 'execute_desktop_observation',
        verification: 'UI Automation read disabled target and loading text.',
      },
      responseText: 'Inspected UI controls in Launcher. controls=3, matched=1, actionable=0',
      stateSummary: {
        missingEvidence: [
          'UI Automation post-action state is loading.',
          'Target/action relation is not fully proven by UI Automation alone.',
        ],
        observedState: [
          'Window UI query: Launcher',
          'Target text: Example Game',
          'Matched controls: Example Game Start enabled=false',
          'Control sample: Loading game resources 42%',
        ],
        recommendedRecovery: [
          'postActionRecoveryStrategy=wait-and-observe | nextTool=execute_desktop_observation | nextArgs={"action":"wait_and_observe","forceRefresh":true,"includeVisual":true,"waitMs":2500,"query":"Launcher"}',
        ],
        structuredEvidence: {
          confidence: 'medium',
          coordinateConfidence: 'medium',
          postActionRecovery: {
            nextArgs: {
              action: 'wait_and_observe',
              forceRefresh: true,
              includeVisual: true,
              query: 'Launcher',
              waitMs: 2500,
            },
            nextTool: 'execute_desktop_observation',
            reason: 'UI Automation found the target unavailable while the window looks like it is loading or starting.',
            strategy: 'wait-and-observe',
          },
          postActionState: 'loading',
          status: 'success',
          targetCandidates: [
            {
              actions: ['invoke'],
              automationId: 'example-game-start',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 1280,
                y: 822,
              },
              confidence: 'high',
              controlType: 'Button',
              enabled: false,
              label: 'Example Game Start',
              name: 'Example Game Start',
              offscreen: false,
              source: 'ui-automation',
            },
          ],
          targetMatched: 'Example Game Start',
          visualActionReadiness: 'needs-primary-action',
        },
        verificationEvidence: [
          'UI Automation returned disabled target and loading text.',
        ],
      },
      verification: 'UI Automation read disabled target and loading text.',
    },
  },
  maxSteps: 3,
  modelCaller: async () => {
    throw new Error('model should not be called while disabled loading UIA recovery can auto-wait and complete');
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'wait_and_observe');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.includeVisual, true);
    assert.equal(command.toolCall.input.query, 'Launcher');
    assert.equal(command.toolCall.input.waitMs, 2500);
    return {
      observations: [
        'Recovered observation: Example Game main window is visible.',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Example Game main window is visible.',
        ],
        status: 'success',
        summaryLines: [
          'Call: execute_desktop_observation wait_and_observe',
          'Result: launched',
        ],
        title: 'Agent post-action wait observation',
        toolName: 'execute_desktop_observation',
        verification: 'Example Game is launched.',
      },
      responseText: 'Example Game launched after waiting.',
      stateSummary: {
        observedState: [
          'Example Game main window is visible.',
        ],
        structuredEvidence: {
          postActionState: 'launched',
          status: 'success',
          targetMatched: 'Example Game',
        },
        verificationEvidence: [
          'Example Game main window is visible.',
        ],
      },
      verification: 'Example Game is launched.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'completed');
assert.equal(result.toolResults.length, 2);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.match(result.continuation.historyLines.join('\n'), /wait_and_observe/u);

console.log('agent session v2 UIA disabled loading recovery smoke ok');
