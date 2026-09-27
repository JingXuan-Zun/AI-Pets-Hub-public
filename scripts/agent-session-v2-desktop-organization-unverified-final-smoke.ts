import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: {
      capabilityId: 'desktop-organization',
      instruction: 'execute desktop icon organization',
      kind: 'tool-call',
      sourceText: '/agent organize desktop icons on secondary display',
      toolCall: {
        input: {
          mode: 'execute',
          sourceScope: 'display-icons',
          targetDisplay: 'secondary',
        },
        name: 'organize_desktop_icons',
      },
    },
    result: {
      observations: [
        'Desktop organization execution attempted.',
        'Post-move verification failed.',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Desktop organization execution attempted.',
          'Post-move verification failed.',
        ],
        status: 'unverified',
        summaryLines: [
          'Call: organize_desktop_icons',
          'Result: execution attempted, verification failed',
        ],
        title: 'Execution receipt',
        toolName: 'organize_desktop_icons',
        verification: 'Desktop organization post-move verification failed.',
      },
      responseText: 'Desktop organization execution attempted, but post-move verification failed.',
      verification: 'Desktop organization post-move verification failed.',
    },
  },
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      assert.match(userInput, /tool=organize_desktop_icons/u);
      return JSON.stringify({
        action: 'final_answer',
        message: 'Desktop icons have been organized.',
        understanding: {
          completedGoals: ['organized desktop icons'],
          remainingGoals: [],
          successCriteria: 'desktop icons are organized',
          userNeed: 'organize desktop icons',
          verificationEvidence: ['Tool returned an execution result.'],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    assert.match(userInput, /unverified|verification/i);
    return JSON.stringify({
      action: 'final_answer',
      message: 'I could not verify that the desktop icons were organized. Please retry after refreshing desktop state.',
      understanding: {
        blockedGoals: ['verify desktop icon positions after organization'],
        completedGoals: [],
        remainingGoals: [],
        successCriteria: 'desktop icons are organized',
        userNeed: 'organize desktop icons',
        verificationEvidence: ['Recovery observation did not verify desktop organization.'],
        verificationGaps: ['desktop organization execution returned unverified'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent organize desktop icons on secondary display',
  toolExecutor: async (command) => {
    toolCommands.push(command);
    return {
      observations: [
        'Recovery observation: desktop icon post-move state is still unclear.',
      ],
      ok: true,
      responseText: 'Recovery observation did not verify desktop organization.',
      verification: 'desktop organization still unverified',
    };
  },
  userGoal: 'organize desktop icons on secondary display',
});

assert.equal(toolCommands.length >= 1, true);
assert.notEqual(result.finalAnswer, 'Desktop icons have been organized.');
assert.match(result.finalAnswer ?? '', /could not verify|verify|budget/i);

console.log('agent session v2 desktop organization unverified final smoke ok');
