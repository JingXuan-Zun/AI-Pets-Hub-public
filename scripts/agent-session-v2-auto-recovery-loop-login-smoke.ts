import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'desktop-observation' : 'app-launcher',
    instruction: 'start Example Game from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from launcher',
    toolCall: {
      goal: 'start Example Game from launcher',
      input,
      name,
    },
  };
}

function createApprovedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'execute_desktop_sequence completed all steps in order.',
    },
    responseText: 'execute_desktop_sequence completed all steps in order.',
    stateSummary: {
      changedState: ['cursor-position', 'active-window-input-state'],
      observedState: ['Step 1/1 tool=execute_desktop_input status=ok'],
      verificationEvidence: ['Sequence steps completed.'],
    },
    verification: 'execute_desktop_sequence completed all steps in order.',
  };
}

function createLoadingResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: loading'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', 'State: loading'],
      title: 'Post approval visual verification',
      toolName: 'execute_desktop_observation',
      verification: 'Example Game is still loading.',
    },
    responseText: 'Example Game is still loading.',
    stateSummary: {
      missingEvidence: ['Example Game is not fully launched yet.'],
      observedState: ['Post-action visual state: loading'],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: 'loading',
        status: 'unverified',
      },
      verificationEvidence: ['Example Game is still loading.'],
    },
    verification: 'Example Game is still loading.',
  };
}

function createLoginRequiredResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: login_required', 'Visible text: QR code verification required.'],
      status: 'blocked',
      summaryLines: ['Call: execute_desktop_observation wait_and_observe', 'State: login_required'],
      title: 'Agent wait and observe',
      toolName: 'execute_desktop_observation',
      verification: 'A QR-code verification screen is blocking the launch.',
    },
    responseText: 'The launcher now shows a QR-code verification screen before Example Game can start.',
    stateSummary: {
      missingEvidence: ['QR-code scan or verification code is required before launch can continue.'],
      observedState: ['Post-action visual state: login_required', 'Visible text: QR code verification required.'],
      structuredEvidence: {
        postActionState: 'login_required',
        status: 'blocked',
      },
      verificationEvidence: ['A QR-code verification screen is blocking the launch.'],
    },
    verification: 'A QR-code verification screen is blocking the launch.',
  };
}

const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyQuery: 'Example Game',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            x: 1440,
            y: 920,
          },
          reason: 'Click the located Start button.',
          tool: 'execute_desktop_input',
        },
      ]),
    }),
    result: createApprovedSequenceResult(),
  },
  maxSteps: 2,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called after login_required is observed');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    if (executedCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
      return createLoadingResult();
    }

    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.waitMs, 2500);
    return createLoginRequiredResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(result.status, 'needs-user');
assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 2);
assert.match(result.finalAnswer, /登录|验证|确认/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=login_required/u);
// The blocked login gate stops the recovery loop before any further action.
assert.match(result.continuation.historyLines.join('\n'), /Recovery Controller trigger decision:\naction=stop-needs-user/u);

let deniedRecoveryToolCalls = 0;
let recoveryAuthorizationCalls = 0;
const deniedRecoveryResult = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyQuery: 'Example Game',
      stepsJson: '[]',
    }),
    result: createApprovedSequenceResult(),
  },
  authorizeRecovery(request) {
    recoveryAuthorizationCalls += 1;
    assert.equal(request.kind, 'automatic-observation');
    return {
      allowed: false,
      attempt: 1,
      limit: 0,
      reason: 'test recovery budget exhausted',
    };
  },
  maxSteps: 2,
  modelCaller: async () => {
    throw new Error('model must not run after Task Runtime rejects recovery');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    deniedRecoveryToolCalls += 1;
    assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
    return createLoadingResult();
  },
  userGoal: 'start Example Game from launcher',
});
assert.equal(recoveryAuthorizationCalls, 1);
assert.equal(deniedRecoveryToolCalls, 1);
assert.equal(deniedRecoveryResult.status, 'needs-user');
assert.match(deniedRecoveryResult.finalAnswer, /Automatic recovery stopped/u);
assert.match(deniedRecoveryResult.continuation.historyLines.join('\n'), /allowed=false/u);

console.log('agent session v2 auto recovery loop login smoke ok');
