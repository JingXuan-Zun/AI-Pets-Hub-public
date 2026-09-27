import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open Example Game inside Example Launcher';
const userGoal = 'open Example Game inside Example Launcher';

const approvedFocusCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'focus_window',
      target: 'Example Launcher',
    },
    name: 'execute_desktop_action',
  },
};

const approvedFocusResult: AgentChatCommandResult = {
  observations: [
    'Desktop action: focus_window',
    'Focused window: Example Launcher',
    'Post-action state: loading',
  ],
  ok: true,
  responseText: 'Example Launcher focused and still loading.',
  stateSummary: {
    observedState: ['Focused window: Example Launcher', 'Launcher is still loading.'],
    structuredEvidence: {
      finalWindow: {
        hwnd: 100,
        processName: 'example-launcher',
        title: 'Example Launcher',
      },
      postActionState: 'loading',
      status: 'loading',
      targetMatched: 'Example Launcher',
    },
    verificationEvidence: ['Launcher is still loading.'],
  },
  verification: 'Window focused, but launcher is still loading.',
};

const observedTools: string[] = [];
let sawInAppTargetLocate = false;
let modelInput = '';

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedFocusCommand,
    result: approvedFocusResult,
  },
  maxSteps: 1,
  modelCaller: async ({ userInput }) => {
    modelInput = userInput;
    return JSON.stringify({
      action: 'ask_user',
      message: 'Launcher is still loading; please wait or confirm when it is ready.',
      understanding: {
        blockedGoals: ['launcher still loading'],
        completedGoals: ['outer launcher window is focused'],
        remainingGoals: ['open Example Game inside Example Launcher'],
        successCriteria: 'Example Game launches from inside Example Launcher',
        userNeed: userGoal,
        verificationEvidence: ['Launcher is still loading.'],
        verificationGaps: ['Inner target is not ready to locate yet.'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    observedTools.push(command.toolCall?.name ?? command.kind);
    if (
      command.toolCall?.name === 'locate_screen_elements'
      && String(command.toolCall.input.question).includes('AgentSessionV2 in-app target locate')
    ) {
      sawInAppTargetLocate = true;
    }
    if (command.toolCall?.name === 'locate_screen_elements') {
      return {
        observations: [
          'Tool: locate_screen_elements',
          'Wait-cap read: Example Launcher is still loading.',
        ],
        ok: true,
        responseText: 'Example Launcher is still loading.',
        stateSummary: {
          observedState: ['Example Launcher is still loading.'],
          structuredEvidence: {
            finalWindow: {
              hwnd: 100,
              processName: 'example-launcher',
              title: 'Example Launcher',
            },
            postActionState: 'loading',
            status: 'loading',
            targetMatched: 'Example Launcher',
          },
          verificationEvidence: ['Example Launcher is still loading.'],
        },
        verification: 'Post-action state is loading.',
      };
    }
    if (command.toolCall?.name === 'execute_desktop_observation') {
      return {
        observations: [
          'Tool: execute_desktop_observation',
          'Action: wait_and_observe',
          'Example Launcher is still loading.',
        ],
        ok: true,
        responseText: 'Example Launcher is still loading.',
        stateSummary: {
          observedState: ['Example Launcher is still loading.'],
          structuredEvidence: {
            finalWindow: {
              hwnd: 100,
              processName: 'example-launcher',
              title: 'Example Launcher',
            },
            postActionState: 'loading',
            status: 'loading',
            targetMatched: 'Example Launcher',
          },
          verificationEvidence: ['Example Launcher is still loading.'],
        },
        verification: 'Post-action state is loading.',
      };
    }

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        observations: [
          'Windows/apps query: Example Launcher',
          'Running sample: 1. example-launcher hwnd=100 title="Example Launcher"',
          'Post-action state: loading',
        ],
        ok: true,
        responseText: 'Observed Example Launcher; still loading.',
        stateSummary: {
          observedState: ['Example Launcher visible but still loading.'],
          structuredEvidence: {
            finalWindow: {
              hwnd: 100,
              processName: 'example-launcher',
              title: 'Example Launcher',
            },
            postActionState: 'loading',
            status: 'loading',
            targetMatched: 'Example Launcher',
          },
          verificationEvidence: ['Example Launcher visible but still loading.'],
        },
        verification: 'Post-action state is loading.',
      };
    }

    throw new Error(`Unexpected tool while launcher is loading: ${command.toolCall?.name ?? command.kind}`);
  },
  userGoal,
});

assert.equal(sawInAppTargetLocate, false, `should not locate inner target while launcher is loading; tools=${observedTools.join(',')}`);
assert.match(result.continuation.historyLines.join('\n'), /deferred in-app target locate|post-action-state:loading|Post-action state is loading/u);
assert.match(modelInput, /loading/u);
assert.notEqual(result.status, 'needs-approval');

console.log('agent session v2 in-app loading defers locate smoke ok');
