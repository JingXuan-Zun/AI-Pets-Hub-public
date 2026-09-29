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
        'Control sample: QR code scan required',
        'Control sample: Verification code',
      ],
      status: 'blocked',
      summaryLines: [
        'Call: execute_desktop_observation inspect_window_ui',
        'State: login_required',
      ],
      title: 'Agent window UI inspection',
      toolName: 'execute_desktop_observation',
      verification: 'A QR-code verification screen blocks the requested launch.',
    },
    responseText: 'The launcher shows a QR-code verification screen before Example Game can start.',
    stateSummary: {
      missingEvidence: [
        'QR-code scan or verification code is required before launch can continue.',
      ],
      observedState: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'Control sample: Sign in to continue',
        'Control sample: QR code scan required',
        'Control sample: Verification code',
      ],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: null,
          nextTool: null,
          reason: 'UI Automation text suggests a private login/account/verification step.',
          strategy: 'ask-user',
        },
        postActionState: 'login_required',
        status: 'blocked',
        targetMatched: 'Example Game',
        visualActionReadiness: 'not-actionable',
      },
      verificationEvidence: [
        'A QR-code verification screen blocks the requested launch.',
      ],
    },
    verification: 'A QR-code verification screen blocks the requested launch.',
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
    assert.equal(toolCallCount, 1);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    return createLoginRequiredInspectionResult();
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'needs-user');
assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 1);
assert.match(result.finalAnswer, /login|verification|confirm|sign|QR|code/i);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=login_required/u);
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);

console.log('agent session v2 non-automatable login gate smoke ok');
