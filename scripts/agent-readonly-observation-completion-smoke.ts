import assert from 'node:assert/strict';
import {
  hasAgentEffectiveDirectActionIntent,
  isAgentExplicitReadOnlyObservationIntent,
} from '../src/agent/runtime/agentActionCoverage.ts';
import {
  countObservedRunningProcesses,
  resolveObserveWindowsAndAppsScopes,
} from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { createAgentTaskRuntimeV4SessionV2Shadow } from '../src/agent/agentTaskRuntimeV4SessionV2ShadowAdapter.ts';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const readonlyRequest = '查看当前正在运行的应用，只读取，不执行任何操作';
assert.equal(isAgentExplicitReadOnlyObservationIntent(readonlyRequest, readonlyRequest), true);
assert.equal(hasAgentEffectiveDirectActionIntent(readonlyRequest, readonlyRequest), false);
assert.equal(
  isAgentExplicitReadOnlyObservationIntent(
    '只查看运行中的应用，不执行其他操作，然后打开微信',
    '',
  ),
  false,
  'a later positive action must not inherit the read-only exception',
);

assert.deepEqual(
  resolveObserveWindowsAndAppsScopes({
    input: {
      includeRunningApps: true,
    },
    name: 'observe_windows_and_apps',
  }),
  {
    includeActiveWindow: false,
    includeDisplays: false,
    includeInstalledApps: false,
    includeRunningApps: true,
    includeTaskbarPinned: false,
  },
);
assert.equal(countObservedRunningProcesses([
  { pid: 101, processName: 'viewer', title: 'image-1' },
  { pid: 101, processName: 'viewer', title: 'image-2' },
  { pid: 202, processName: 'desktop-pet', title: 'chat' },
  { pid: 202, processName: 'desktop-pet', title: 'pet' },
  { pid: 303, processName: 'qq', title: 'QQ' },
]), 3);

const shadow = createAgentTaskRuntimeV4SessionV2Shadow({
  sourceText: readonlyRequest,
  status: 'completed',
  toolResults: [{
    command: {
      kind: 'tool_call',
      toolCall: {
        input: { includeRunningApps: true },
        name: 'observe_windows_and_apps',
      },
    },
    result: {
      ok: true,
      receipt: {
        status: 'success',
      },
      responseText: 'Observed apps/windows: running=9.',
      verification: 'Window/app observation returned current running windows.',
    },
  }],
  userGoal: readonlyRequest,
});

assert.equal(shadow.classification, 'verified_success');
assert.equal(shadow.context.currentState, 'succeeded');
assert.deepEqual(
  shadow.events.map((event) => event.kind),
  ['start', 'observation-collected', 'evidence-collected', 'outcome-verified'],
);
assert.match(shadow.notes.join('\n'), /no dispatch was required/u);

let modelCallCount = 0;
let toolCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 6,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          forceRefresh: true,
          includeRunningApps: true,
        },
        reason: 'Read the running-window list requested by the user.',
        tool: 'observe_windows_and_apps',
        understanding: {
          completedGoals: [],
          remainingGoals: ['list running applications'],
          successCriteria: 'Current running applications are listed from live observation.',
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
  sourceText: readonlyRequest,
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    return {
      observations: ['Running windows: 9'],
      ok: true,
      receipt: {
        status: 'success',
      },
      responseText: 'Observed apps/windows: installed=0, taskbarPinned=0, running=9.',
      stateSummary: {
        verificationEvidence: ['Live running-window observation returned 9 entries.'],
      },
      verification: 'Window/app observation returned current running windows.',
    };
  },
  userGoal: readonlyRequest,
});

assert.equal(modelCallCount, 1, sessionResult.continuation.historyLines.join('\n'));
assert.equal(toolCallCount, 1);
assert.equal(sessionResult.status, 'completed');
assert.deepEqual(
  sessionResult.continuation.steps.map((step) => step.action),
  ['tool_call', 'tool_result', 'final_answer'],
);
assert.equal(sessionResult.debug?.v4TaskShadow?.classification, 'verified_success');
assert.ok(
  sessionResult.diagnostics?.some((diagnostic) => (
    diagnostic.payload.status === 'verified_success'
    && /verified read-only observation completed; no dispatch was required/iu.test(diagnostic.payload.summary)
  )),
  'read-only verified success should be described as observation completion, not side-effect success',
);

console.log('agent readonly observation completion smoke ok');
