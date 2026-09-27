import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createLoginRequiredInspectionResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Control sample: Sign in to continue',
        'Control sample: Password',
      ],
      status: 'blocked',
      summaryLines: [
        'Call: execute_desktop_observation inspect_window_ui',
        'State: login_required',
      ],
      title: 'Agent window UI inspection',
      toolName: 'execute_desktop_observation',
      verification: 'A login screen blocks the requested launch.',
    },
    responseText: 'The launcher shows a sign-in screen before Example Game can start.',
    stateSummary: {
      missingEvidence: [
        'User login is required before launch can continue.',
      ],
      observedState: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'Control sample: Sign in to continue',
        'Control sample: Password',
      ],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: {
            action: 'describe_elements',
            forceRefresh: true,
            question: 'Read the visible login/account page.',
            targetDescription: 'login continuation controls and non-automatable verification gates',
            targetText: 'Sign in Log in Continue Confirm OK',
          },
          nextTool: 'locate_screen_elements',
          reason: 'UI Automation text suggests a login/account page.',
          strategy: 're-locate-target',
        },
        postActionState: 'login_required',
        status: 'blocked',
        targetMatched: 'Example Game',
        visualActionReadiness: 'not-actionable',
      },
      verificationEvidence: [
        'A login screen blocks the requested launch.',
      ],
    },
    verification: 'A login screen blocks the requested launch.',
  };
}

let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'inspect_window_ui',
        forceRefresh: true,
        query: 'Launcher',
        targetText: 'Example Game',
      },
      reason: 'Read launcher UI controls before choosing any action.',
      tool: 'execute_desktop_observation',
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      return createLoginRequiredInspectionResult();
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'describe_elements');
    return {
      ok: true,
      responseText: 'Located Sign in button with saved credentials already filled.',
      stateSummary: {
        observedState: ['Login continuation control: Sign in'],
        structuredEvidence: {
          actionCandidates: [{
            centerX: 500,
            centerY: 640,
            coordinateSpace: 'native-screen',
            label: 'Sign in',
            source: 'vision',
          }],
          captureSourceType: 'window',
          elementCenter: {
            coordinateSpace: 'native-screen',
            x: 500,
            y: 640,
          },
          postActionState: 'login_required',
          finalWindow: { hwnd: 2048, pid: 4096, title: 'Launcher' },
          primaryAction: 'Sign in',
          status: 'ready',
          targetMatched: 'Sign in',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Sign in button is visible and credentials appear already filled.'],
      },
      verification: 'Sign in button is visible and credentials appear already filled.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'needs-approval');
assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 2);
assert.match(result.finalAnswer, /Sign in|approval|desktop/i);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=login_required/u);
assert.match(result.continuation.historyLines.join('\n'), /(?:automatic recovery observation|visual refinement)/u);

console.log('agent session v2 UIA login auto-continue smoke ok');
