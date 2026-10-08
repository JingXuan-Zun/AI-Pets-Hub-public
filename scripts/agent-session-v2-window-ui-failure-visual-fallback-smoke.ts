import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { executeInspectWindowUi } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const originalInspectWindowUi = desktopPetShellRuntime.inspectWindowUi;

try {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = async () => ({
    controlCount: 0,
    controls: [],
    error: 'UI Automation script failed: parser error near Sort-Object.',
    matchedControls: [],
    ok: false,
    query: 'Launcher',
    targetText: 'Example Game',
    window: {
      hwnd: 9001,
      processName: 'Launcher',
      title: 'Launcher',
    },
  });

  const failedInspection = await executeInspectWindowUi({
    capabilityId: 'desktop-observation',
    goal: 'inspect Launcher controls',
    input: {
      action: 'inspect_window_ui',
      query: 'Launcher',
      targetText: 'Example Game',
    },
    name: 'execute_desktop_observation',
  });

  assert.equal(failedInspection.ok, false);
  assert.equal(failedInspection.stateSummary?.structuredEvidence?.postActionRecovery?.nextTool, 'locate_screen_elements');
  assert.equal(failedInspection.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.query, 'Launcher');
  assert.equal(failedInspection.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.targetText, 'Example Game');
  assert.equal(failedInspection.stateSummary?.structuredEvidence?.visualActionReadiness, 'low-confidence');
  assert.match(failedInspection.stateSummary?.recommendedRecovery?.join('\n') ?? '', /locate_screen_elements/u);
} finally {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = originalInspectWindowUi;
}

let modelCallCount = 0;
let toolCallCount = 0;

const sessionResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 2) {
      // Vision fallback plus focused refinement verified the Start button;
      // the model selects the click, which pauses for approval.
      assert.match(userInput, /elementCenter=812,590/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: { action: 'click', x: 812, y: 590 },
              reason: 'Click the Start button found by the vision fallback.',
              tool: 'execute_desktop_input',
            },
          ]),
        },
        reason: 'The vision fallback verified the Start button; request approval for the click.',
        tool: 'execute_desktop_sequence',
      });
    }
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'inspect_window_ui',
        query: 'Launcher',
        targetText: 'Example Game',
      },
      reason: 'Read window controls first; if UIA fails, fall back to vision.',
      tool: 'execute_desktop_observation',
      understanding: {
        completedGoals: [],
        remainingGoals: ['find the launch button for Example Game'],
        successCriteria: 'button coordinate is verified before clicking',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need UI or visual evidence for the launch button.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;

    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      return {
        errorText: 'UI Automation script failed: parser error near Sort-Object.',
        observations: [
          'Window UI query: Launcher',
          'Target text: Example Game',
          'Error: UI Automation script failed: parser error near Sort-Object.',
        ],
        ok: false,
        responseText: 'Window UI inspection failed: UI Automation script failed: parser error near Sort-Object.',
        stateSummary: {
          missingEvidence: [
            'Window UI Automation controls were not available.',
            'Need visual/OCR evidence for visible target text, primary action, status text, and coordinates.',
          ],
          observedState: [
            'Window UI query: Launcher',
            'Target text: Example Game',
          ],
          recommendedRecovery: [
            'postActionRecoveryStrategy=re-locate-target | nextTool=locate_screen_elements | nextArgs={"action":"describe_elements","forceRefresh":true,"query":"Launcher","targetText":"Example Game","sourceQuery":"Launcher"} | reason=UI Automation failed before controls could be inspected.',
          ],
          structuredEvidence: {
            confidence: 'low',
            coordinateConfidence: 'low',
            finalWindow: {
              hwnd: 9001,
              processName: 'Launcher',
              title: 'Launcher',
            },
            postActionRecovery: {
              nextArgs: {
                action: 'describe_elements',
                forceRefresh: true,
                query: 'Launcher',
                sourceQuery: 'Launcher',
                targetText: 'Example Game',
              },
              nextTool: 'locate_screen_elements',
              reason: 'UI Automation failed before controls could be inspected.',
              strategy: 're-locate-target',
            },
            postActionState: 'unknown',
            status: 'failed',
            targetMatched: 'Example Game',
            visualActionReadiness: 'low-confidence',
          },
          verificationEvidence: [],
        },
        verification: 'UI Automation script failed: parser error near Sort-Object.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    if (toolCallCount === 3) {
      // Bounded focused refinement of the ready Start button.
      assert.equal(command.toolCall.input.action, 'locate_element');
      assert.match(String(command.toolCall.input.targetDescription), /; focused candidate: /u);
    } else {
      assert.equal(command.toolCall.input.action, 'describe_elements');
      assert.equal(command.toolCall.input.forceRefresh, true);
      assert.equal(command.toolCall.input.query, 'Launcher');
      assert.equal(command.toolCall.input.targetText, 'Example Game');
      // Before any action attempt, the UIA failure's structured recovery runs as
      // the window UI visual fallback refinement with the recovery reason.
      assert.match(String(command.toolCall.input.question), /AgentSessionV2 window UI visual fallback/u);
      assert.match(String(command.toolCall.input.question), /UI Automation failed/u);
    }

    return {
      observations: [
        'Visual target matched: Example Game',
        'Visual primary action: Start button',
        'Visual element center: x=812 y=590',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Vision located the Start button for Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start button',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'vision-fallback-test',
            x: 812,
            y: 590,
          },
          primaryAction: 'Start button',
          relation: 'Start button belongs to Example Game.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Vision fallback verified the Start button coordinate.'],
      },
      verification: 'Vision fallback verified the actionable button.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 2);
assert.equal(toolCallCount, 3);
assert.equal(sessionResult.status, 'needs-approval');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(sessionResult.pendingApproval?.command.toolCall?.input.stepsJson), /812/u);
assert.match(String(sessionResult.pendingApproval?.command.toolCall?.input.stepsJson), /590/u);
assert.match(sessionResult.continuation.historyLines.join('\n'), /AgentSessionV2 window UI visual fallback/u);
assert.match(sessionResult.continuation.historyLines.join('\n'), /locate_screen_elements/u);

console.log('agent session v2 window UI failure visual fallback smoke ok');
