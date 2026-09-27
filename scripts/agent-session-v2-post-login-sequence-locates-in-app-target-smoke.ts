import assert from 'node:assert/strict';

import {
  runAgentProductionSession,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const launchWeGameCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Launch WeGame',
  kind: 'tool-call' as const,
  sourceText: '/agent Open League of Legends in WeGame',
  toolCall: {
    goal: 'Open League of Legends in WeGame',
    input: {
      action: 'launch_local_app',
      target: 'WeGame',
    },
    name: 'execute_desktop_action' as const,
  },
  userGoal: 'Open League of Legends in WeGame',
};

const observeWeGameCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Observe post-action UI state',
  kind: 'tool-call' as const,
  sourceText: '/agent Open League of Legends in WeGame',
  toolCall: {
    goal: 'Observe post-action UI state.',
    input: {
      action: 'wait_and_observe',
      delayMs: 600,
      query: 'WeGame',
    },
    name: 'execute_desktop_observation' as const,
  },
  userGoal: 'Open League of Legends in WeGame',
};

const loginClickSequenceCommand = {
  capabilityId: 'desktop-sequence',
  instruction: 'Click safe login continuation',
  kind: 'tool-call' as const,
  sourceText: '/agent Open League of Legends in WeGame',
  toolCall: {
    goal: 'Open League of Legends in WeGame',
    input: {
      postVerify: true,
      postVerifyQuery: 'Open League of Legends in WeGame',
      postVerifyVisualQuery: 'Open League of Legends in WeGame',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            forceMouseEventFallback: true,
            x: 826,
            y: 446,
          },
          reason: 'Click the safe login continuation button.',
          tool: 'execute_desktop_input',
        },
        {
          args: {
            action: 'send_keys',
            keys: '{ENTER}',
          },
          reason: 'Fallback Enter after login continuation click.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence' as const,
  },
  userGoal: 'Open League of Legends in WeGame',
};

const continuation: AgentSessionV2ContinuationState = {
  historyLines: [
    'Approved tool result: launch WeGame was unverified.',
    'Auto recovery observed active window: wegame - WeGame.',
  ],
  sourceText: '/agent Open League of Legends in WeGame',
  steps: [],
  timing: null,
  traceEvents: [],
  toolResults: [
    {
      command: launchWeGameCommand,
      result: {
        ok: true,
        responseText: 'Launch request sent for WeGame, but no focusable window was detected yet.',
        receipt: {
          status: 'unverified',
        },
        stateSummary: {
          actionEvidence: {
            outcome: 'uncertain',
          },
          observedState: [
            'Desktop action: launch_local_app',
            'Launch status: launched-unverified',
            'Launch query: WeGame',
          ],
        },
      },
    } satisfies AgentSessionV2ToolResultEntry,
    {
      command: observeWeGameCommand,
      result: {
        ok: true,
        responseText: 'Waited 600ms, then observed current desktop state. Active window: wegame - WeGame.',
        stateSummary: {
          observedState: [
            'Active window: wegame - WeGame',
            'Running sample: wegame pid=40808 hwnd=3413698',
          ],
          structuredEvidence: {
            finalWindow: {
              processName: 'wegame',
              title: 'wegame - WeGame',
            },
            status: 'success',
            targetMatched: 'wegame - WeGame',
          },
          verificationEvidence: [
            'WeGame is now the active window.',
          ],
        },
      },
    } satisfies AgentSessionV2ToolResultEntry,
  ],
  userGoal: 'Open League of Legends in WeGame',
};

let modelCalled = false;
const modelCaller: AgentSessionV2ModelCaller = async () => {
  modelCalled = true;
  assert.fail('Runtime should locate the in-app target after login click sequence before asking the model again.');
};

let locateCallCount = 0;
const result = await runAgentProductionSession({
  approvedToolResult: {
    command: loginClickSequenceCommand,
    result: {
      ok: true,
      assessment: {
        status: 'unverified',
        summary: 'Desktop sequence steps completed, but at least one step had unverified replay or coordinate-closure evidence.',
      },
      observations: [
        'Step 1/2 | tool=execute_desktop_input | status=ok | reason=Click (826, 446) to trigger "primary action" for "wegame - WeGame". | inputReplayChanged=true | inputReplayClosure=coordinate_closure_ok | actionOutcome=changed | response=Desktop input executed: click.',
        'Step 2/2 | tool=execute_desktop_input | status=ok | reason=Fallback: send Enter after login continuation click in case the launcher button accepted focus but ignored synthetic mouse-up. | actionOutcome=uncertain | response=Desktop input executed: send_keys.',
      ],
      receipt: {
        evidenceLines: [
          'Step 1/2 execute_desktop_input actionOutcome=changed',
          'Step 2/2 execute_desktop_input actionOutcome=uncertain',
        ],
        status: 'unverified',
        summaryLines: [
          'Desktop sequence completed 2/2 step(s). Post-sequence desktop state observation succeeded.',
        ],
        title: 'Desktop sequence completed with unverified outcome',
        toolName: 'execute_desktop_sequence',
        verification: 'execute_desktop_sequence completed all steps in order. Post-sequence verification did not confirm the final target.',
      },
      responseText: 'Desktop sequence completed 2/2 step(s). Post-sequence desktop state observation succeeded.',
      stateSummary: {
        actionEvidence: {
          outcome: 'changed',
        },
      },
    },
  },
  continuation,
  maxSteps: 4,
  modelCaller,
  settings,
  sourceText: '/agent Open League of Legends in WeGame',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    locateCallCount += 1;
    return {
      ok: true,
      responseText: 'Located League of Legends launch button at x=1200 y=700.',
      stateSummary: {
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1200,
            y: 700,
          },
          primaryAction: 'Start',
          relation: 'Start button belongs to League of Legends.',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'League of Legends start button is visible.',
    };
  },
  userGoal: 'Open League of Legends in WeGame',
});

assert.equal(modelCalled, false);
assert.equal(locateCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1200/u);

console.log('agent session v2 post-login sequence locates in-app target smoke ok');
