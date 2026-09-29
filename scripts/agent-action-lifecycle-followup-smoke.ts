import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  resolveAgentResultFollowUpActions,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

const command: AgentChatCommand = {
  instruction: 'launch game',
  sourceText: 'Open League of Legends in WeGame',
  toolCall: {
    goal: 'Open League of Legends in WeGame',
    input: {
      postVerify: true,
      postVerifyQuery: 'League of Legends',
      stepsJson: '[]',
    },
    name: 'execute_desktop_sequence',
  },
};

const waitingResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [],
    status: 'unverified',
    summaryLines: [],
    title: 'sequence',
    toolName: 'execute_desktop_sequence',
  },
  responseText: 'Sequence sent launch request.',
  stateSummary: {
    structuredEvidence: {
      actionLifecycle: {
        reason: 'target not ready',
        recommendedRecovery: 'wait and observe',
        status: 'unverified_wait',
      },
      postActionRecovery: {
        nextArgs: {
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          query: 'League of Legends',
          waitMs: 3000,
        },
        nextTool: 'execute_desktop_observation',
        reason: 'Wait and poll target process/window evidence.',
        strategy: 'wait-and-observe',
      },
      postActionState: 'waiting_target',
    },
  },
};

const waitingAssessed = assessAgentCommandResult(command, waitingResult);
const waitingActions = resolveAgentResultFollowUpActions(waitingAssessed);
const waitAction = waitingActions.find((action) => action.kind === 'run-command');
assert.equal(waitAction?.label, 'Wait for app readiness');
assert.equal(waitAction?.kind === 'run-command' ? waitAction.command.toolCall?.name : '', 'execute_desktop_observation');
assert.equal(waitAction?.kind === 'run-command' ? waitAction.command.toolCall?.input.action : '', 'wait_and_observe');
assert.equal(waitAction?.kind === 'run-command' ? waitAction.command.toolCall?.input.waitMs : 0, 3000);

const noEffectResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [],
    status: 'unverified',
    summaryLines: [],
    title: 'sequence',
    toolName: 'execute_desktop_sequence',
  },
  responseText: 'Sequence completed but did not change the UI.',
  stateSummary: {
    structuredEvidence: {
      actionLifecycle: {
        reason: 'no visible UI change',
        recommendedRecovery: 'diagnose before retry',
        status: 'failed_no_effect',
      },
      postActionRecovery: {
        nextArgs: {
          action: 'inspect_window_ui',
          forceRefresh: true,
          query: 'WeGame',
          targetText: '快速安全登录',
        },
        nextTool: 'execute_desktop_observation',
        reason: 'Refresh the same window controls before retrying.',
        strategy: 'refresh-observation',
      },
      postActionState: 'unchanged',
    },
  },
};

const noEffectAssessed = assessAgentCommandResult(command, noEffectResult);
const noEffectActions = resolveAgentResultFollowUpActions(noEffectAssessed);
const diagnoseAction = noEffectActions.find((action) => action.kind === 'run-command');
assert.equal(diagnoseAction?.label, 'Diagnose no effect');
assert.equal(diagnoseAction?.kind === 'run-command' ? diagnoseAction.command.toolCall?.name : '', 'execute_desktop_observation');
assert.equal(diagnoseAction?.kind === 'run-command' ? diagnoseAction.command.toolCall?.input.action : '', 'inspect_window_ui');
assert.equal(noEffectActions.some((action) => action.label === 'Retry once'), false);

console.log('agent action lifecycle follow-up smoke ok');
