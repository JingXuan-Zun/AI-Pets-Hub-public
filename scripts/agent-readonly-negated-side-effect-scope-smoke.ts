import assert from 'node:assert/strict';
import {
  hasAgentEffectiveDirectActionIntent,
  isAgentExplicitReadOnlyObservationIntent,
} from '../src/agent/runtime/agentActionCoverage.ts';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const readonlyRequest = '\u5217\u51fa\u5f53\u524d\u53ef\u89c1\u7684\u5e94\u7528\u7a97\u53e3\uff0c'
  + '\u53ea\u8bfb\u53d6\u5e76\u6c47\u603b\uff0c'
  + '\u4e0d\u8981\u542f\u52a8\u3001\u70b9\u51fb\u3001\u79fb\u52a8\u6216\u4fee\u6539\u4efb\u4f55\u5185\u5bb9\u3002';
const productionReadonlyRequest = '\u5217\u51fa\u5f53\u524d\u53ef\u89c1\u7684\u5e94\u7528\u7a97\u53e3\uff0c'
  + '\u53ea\u6c47\u603b\u89c2\u5bdf\u7ed3\u679c\uff0c'
  + '\u4e0d\u8981\u542f\u52a8\u3001\u70b9\u51fb\u3001\u79fb\u52a8\u6216\u4fee\u6539\u4efb\u4f55\u5185\u5bb9\u3002';

assert.equal(
  isAgentExplicitReadOnlyObservationIntent(readonlyRequest, readonlyRequest),
  true,
  'an explicit list of prohibited side effects must retain read-only scope',
);
assert.equal(
  hasAgentEffectiveDirectActionIntent(readonlyRequest, readonlyRequest),
  false,
  'negated side-effect verbs must not become requested direct actions',
);
assert.equal(
  isAgentExplicitReadOnlyObservationIntent(productionReadonlyRequest, productionReadonlyRequest),
  true,
  'summarizing observation results plus an explicit no-side-effect scope must be treated as read-only',
);
assert.equal(
  hasAgentEffectiveDirectActionIntent(productionReadonlyRequest, productionReadonlyRequest),
  false,
  'production wording must not turn negated launch/click/move/modify verbs into requested actions',
);
assert.equal(
  isAgentExplicitReadOnlyObservationIntent(
    'List visible windows, read-only; do not open, click, move, or modify anything.',
    '',
  ),
  true,
  'English negated side-effect lists must retain read-only scope',
);

const readonlyThenActionRequest = readonlyRequest
  + ' \u7136\u540e\u6253\u5f00\u8bb0\u4e8b\u672c\u3002';
assert.equal(
  isAgentExplicitReadOnlyObservationIntent(readonlyThenActionRequest, readonlyThenActionRequest),
  false,
  'a later positive action must not inherit the earlier read-only scope',
);
assert.equal(
  hasAgentEffectiveDirectActionIntent(readonlyThenActionRequest, readonlyThenActionRequest),
  true,
  'a later positive action must remain actionable',
);

let modelCallCount = 0;
let toolCallCount = 0;
const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'list_running_apps',
          includeWindows: true,
        },
        reason: 'Read the visible application window list requested by the user.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [],
          remainingGoals: ['list visible application windows'],
          successCriteria: 'Current visible application windows are listed from live observation.',
          userNeed: readonlyRequest,
          verificationEvidence: [],
          verificationGaps: ['Need live running-window evidence.'],
          verificationStatus: 'unknown',
        },
      });
    }

    throw new Error('successful read-only evidence must terminate without a second model call');
  },
  settings: {} as PetConfig['settings'],
  sourceText: productionReadonlyRequest,
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'list_running_apps');
    return {
      observations: [
        'Desktop observation: list_running_apps',
        'Running app count: 8',
      ],
      ok: true,
      responseText: 'Current visible application windows: 8.',
      verification: 'Read 8 running application windows.',
    };
  },
  userGoal: productionReadonlyRequest,
});

assert.equal(modelCallCount, 1, result.continuation.historyLines.join('\n'));
assert.equal(toolCallCount, 1);
assert.equal(result.status, 'completed');
assert.deepEqual(
  result.continuation.steps.map((step) => step.action),
  ['tool_call', 'tool_result', 'final_answer'],
);

console.log('agent readonly negated side-effect scope smoke ok');
