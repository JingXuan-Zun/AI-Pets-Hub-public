import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolRecoveryEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'locate_screen_elements' ? 'desktop-observation' : 'app-launcher',
    instruction: 'click launch button and recover post-action state',
    kind: 'tool-call',
    sourceText: '/agent click launch button',
    toolCall: {
      goal: 'click launch button and recover post-action state',
      input,
      name,
    },
  };
}

function createPostActionResult(options: {
  recovery: AgentStructuredToolRecoveryEvidence;
  state: string;
}): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`Post-action visual state: ${options.state}`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', `Post-action visual state: ${options.state}`],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: `Post-sequence visual state is ${options.state}.`,
    },
    responseText: `Clicked the launcher button, but the target is ${options.state}.`,
    stateSummary: {
      missingEvidence: [`Post-sequence visual state is ${options.state}, so the requested final state is not yet confirmed.`],
      observedState: [`Post-action visual state: ${options.state}`],
      recommendedRecovery: [
        `postActionRecoveryStrategy=${options.recovery.strategy} | nextTool=${options.recovery.nextTool}`,
      ],
      structuredEvidence: {
        postActionRecovery: options.recovery,
        postActionState: options.state,
        status: 'unverified',
      },
    },
    verification: `Post-sequence visual state is ${options.state}.`,
  };
}

async function runReadRecoveryCase(options: {
  expectedAction: string;
  expectedQuestion: RegExp;
  recovery: AgentStructuredToolRecoveryEvidence;
  state: string;
  visibleEvidence: string;
}) {
  const executedCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;
  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createToolCommand('execute_desktop_sequence', {
        postVerifyVisualQuery: 'Game',
        stepsJson: '[]',
      }),
      result: createPostActionResult({
        recovery: options.recovery,
        state: options.state,
      }),
    },
    maxSteps: 4,
    modelCaller: async ({ userInput }) => {
      modelCallCount += 1;
      assert.equal(executedCommands.length, 1, `${options.state} should auto-run one read-only recovery first`);
      assert.match(userInput, /automatic recovery observation result/u);
      assert.match(userInput, new RegExp(options.visibleEvidence.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
      return JSON.stringify({
        action: 'final_answer',
        message: `I read the visible ${options.state} evidence and will stop for the user.`,
        understanding: {
          blockedGoals: [`post-action state is ${options.state}`],
          completedGoals: ['read visible post-action evidence'],
          remainingGoals: [],
          successCriteria: 'read the visible post-action blocker before retrying',
          userNeed: 'click launch button',
          verificationEvidence: [options.visibleEvidence],
          verificationGaps: [],
          verificationStatus: 'blocked',
        },
      });
    },
    settings,
    sourceText: '/agent click launch button',
    toolExecutor: async (command) => {
      executedCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, options.expectedAction);
      assert.equal(command.toolCall.input.forceRefresh, true);
      assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
      assert.match(String(command.toolCall.input.question), options.expectedQuestion);
      return {
        observations: [options.visibleEvidence],
        ok: true,
        receipt: {
          evidenceLines: [options.visibleEvidence],
          status: 'success',
          summaryLines: ['Call: locate_screen_elements', `Result: ${options.state} evidence read`],
          title: 'Agent post-action read recovery',
          toolName: 'locate_screen_elements',
          verification: options.visibleEvidence,
        },
        responseText: options.visibleEvidence,
        verification: options.visibleEvidence,
      };
    },
    userGoal: 'click launch button',
  });

  // A verified blocker after bounded recovery hands control back to the user.
  assert.equal(result.status, 'needs-user');
  assert.equal(modelCallCount, 1);
  assert.equal(executedCommands.length, 1);
  assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
}

await runReadRecoveryCase({
  expectedAction: 'describe_elements',
  expectedQuestion: /visible blocker/u,
  recovery: {
    nextArgs: {
      action: 'describe_elements',
      forceRefresh: true,
      question: 'Read the visible blocker, permission prompt, modal, or confirmation gate.',
      targetDescription: 'visible blocker, permission prompt, modal, or confirmation gate',
    },
    nextTool: 'locate_screen_elements',
    reason: 'Read the visible blocker before retrying.',
    strategy: 'read-blocker',
  },
  state: 'blocked',
  visibleEvidence: 'Visible blocker text: Please confirm administrator permission before continuing.',
});

await runReadRecoveryCase({
  expectedAction: 'describe_elements',
  expectedQuestion: /visible error/u,
  recovery: {
    nextArgs: {
      action: 'describe_elements',
      forceRefresh: true,
      question: 'Read the visible error text and recovery controls.',
      targetDescription: 'visible error text and recovery controls',
    },
    nextTool: 'locate_screen_elements',
    reason: 'Read the visible error before retrying.',
    strategy: 'read-error',
  },
  state: 'error',
  visibleEvidence: 'Visible error text: Launch failed because the client is updating.',
});

console.log('agent session v2 post-action read recovery smoke ok');
