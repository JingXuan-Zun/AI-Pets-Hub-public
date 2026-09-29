import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createBlockedInspectionResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Matched controls: Example Game Start enabled=false',
        'Control sample: Permission confirmation required',
      ],
      status: 'success',
      summaryLines: [
        'Call: execute_desktop_observation inspect_window_ui',
        'Matched: 1',
      ],
      title: 'Agent window UI inspection',
      toolName: 'execute_desktop_observation',
      verification: 'UI Automation read disabled target and permission prompt text.',
    },
    responseText: 'Inspected UI controls in Launcher. controls=4, matched=1, actionable=0',
    stateSummary: {
      missingEvidence: [
        'UI Automation post-action state is blocked.',
        'Visible blocker text should be read before retrying.',
      ],
      observedState: [
        'Window UI query: Launcher',
        'Target text: Example Game',
        'Matched controls: Example Game Start enabled=false',
        'Control sample: Permission confirmation required',
      ],
      recommendedRecovery: [
        'postActionRecoveryStrategy=read-blocker | nextTool=locate_screen_elements | nextArgs={"action":"describe_elements","forceRefresh":true,"query":"Launcher","targetDescription":"visible blocker, permission prompt, modal, disabled-state reason, and alternate controls","targetText":"Example Game"}',
      ],
      structuredEvidence: {
        confidence: 'medium',
        coordinateConfidence: 'medium',
        postActionRecovery: {
          nextArgs: {
            action: 'describe_elements',
            forceRefresh: true,
            query: 'Launcher',
            question: 'Read visible blocker, modal, permission prompt, disabled-state reason, and safe alternate controls. Do not click anything.',
            targetDescription: 'visible blocker, permission prompt, modal, disabled-state reason, and alternate controls',
            targetText: 'Example Game',
          },
          nextTool: 'locate_screen_elements',
          reason: 'UI Automation found the requested control disabled or blocked by a gate.',
          strategy: 'read-blocker',
        },
        postActionState: 'blocked',
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
        'UI Automation returned disabled target and permission text.',
      ],
    },
    verification: 'UI Automation read disabled target and permission prompt text.',
  };
}

function createVisibleBlockerReadResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Visible blocker text: Please confirm administrator permission before continuing.',
      ],
      status: 'success',
      summaryLines: [
        'Call: locate_screen_elements',
        'Result: visible blocker read',
      ],
      title: 'Agent visible blocker observation',
      toolName: 'locate_screen_elements',
      verification: 'Visible blocker text was read.',
    },
    responseText: 'Visible blocker text: Please confirm administrator permission before continuing.',
    stateSummary: {
      missingEvidence: [
        'User must confirm administrator permission before launch can continue.',
      ],
      observedState: [
        'Visible blocker text: Please confirm administrator permission before continuing.',
      ],
      structuredEvidence: {
        postActionState: 'blocked',
        status: 'blocked',
      },
      verificationEvidence: [
        'Visible blocker text was read from the screen.',
      ],
    },
    verification: 'Visible blocker text was read.',
  };
}

let modelCallCount = 0;
const executedCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
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
    }

    throw new Error('model should not be called after an automatic blocker read identifies a manual gate');
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);

    if (executedCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      return createBlockedInspectionResult();
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'describe_elements');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
    assert.match(String(command.toolCall.input.question), /Do not click anything/u);
    return createVisibleBlockerReadResult();
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'needs-user');
assert.equal(modelCallCount, 1);
assert.equal(executedCommands.length, 2);
assert.equal(executedCommands[1]?.toolCall?.name, 'locate_screen_elements');
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=blocked/u);
assert.match(result.finalAnswer, /administrator permission/u);

console.log('agent session v2 UIA blocked gate recovery smoke ok');
