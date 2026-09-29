import assert from 'node:assert/strict';
import { runAgentProductionSession, type AgentSessionV2ModelCaller } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;

const modelCaller: AgentSessionV2ModelCaller = async () => {
  modelCallCount += 1;
  return JSON.stringify({
    action: 'tool_calls',
    reason: 'Observe current windows and recall any WeGame preference before acting.',
    tools: [
      {
        args: {
          includeActiveWindow: true,
          includeRunningApps: true,
        },
        reason: 'Find whether WeGame is already running.',
        tool: 'observe_windows_and_apps',
      },
      {
        args: {
          action: 'recall',
          query: 'WeGame',
        },
        reason: 'Recall a stored WeGame alias if one exists.',
        tool: 'execute_memory_action',
      },
    ],
  });
};

const result = await runAgentProductionSession({
  maxSteps: 1,
  modelCaller,
  settings,
  sourceText: '/agent 打开 WeGame 应用并登录',
  toolExecutor: async (command) => {
    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        observations: [
          'Active window: AI Desktop Pet - AI Desktop Pet',
          'Running sample: AI Desktop Pet hwnd=528056 title="AI Desktop Pet"',
        ],
        ok: true,
        responseText: 'Observed apps/windows. Active window: AI Desktop Pet.',
        stateSummary: {
          observedState: ['Active window: AI Desktop Pet'],
          structuredEvidence: {
            actionCandidates: [
              {
                actions: ['invoke'],
                center: {
                  coordinateSpace: 'native-screen',
                  x: 1937,
                  y: 466,
                },
                confidence: 'high',
                enabled: true,
                label: 'primary action',
                relation: 'Primary action belongs to the active window.',
              },
            ],
            confidence: 'high',
            coordinateAuditStatus: 'coordinate_ok',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'active-window-primary-action',
              x: 1937,
              y: 466,
            },
            finalWindow: {
              hwnd: 528056,
              processName: 'AI Desktop Pet',
              title: 'AI Desktop Pet - AI Desktop Pet',
            },
            primaryAction: 'primary action',
            relation: 'Primary action belongs to the active window.',
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 900,
              width: 600,
              x: 1500,
              y: 100,
            },
            status: 'success',
            targetMatched: 'AI Desktop Pet - AI Desktop Pet',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Current active window was observed.'],
        },
        verification: 'Window/app observation returned current running windows.',
      };
    }

    if (command.toolCall?.name === 'execute_memory_action') {
      return {
        observations: ['Memory scope: global', 'Memory filter: WeGame'],
        ok: true,
        responseText: 'No matching Agent memory was found.',
        verification: 'Read 0 matching memories.',
      };
    }

    throw new Error(`Unexpected tool: ${command.toolCall?.name}`);
  },
  userGoal: '打开 WeGame 应用并登录',
});

assert.equal(modelCallCount, 1);
assert.notEqual(result.status, 'needs-approval');
assert.equal(result.pendingApproval, null);
assert.equal(
  result.toolResults.some((entry) => entry.command.toolCall?.name === 'execute_desktop_sequence'),
  false,
);
assert.doesNotMatch(
  result.continuation.historyLines.join('\n'),
  /prepared visual-action approval|Click \(1937, 466\)/u,
);

console.log('agent session v2 nonvisual observation no click approval smoke ok');
