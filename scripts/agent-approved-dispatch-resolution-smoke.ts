import assert from 'node:assert/strict';
import { resolveAgentApprovedDispatch } from '../src/agent/runtime/agentApprovedDispatchResolution.ts';
import {
  getAgentRuntimeDesktopSequenceWindowTarget,
  resolveAgentRuntimeDesktopSequenceObservedWindow,
  resolveAgentRuntimeDesktopSequencePostCreationTarget,
} from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { type AgentChatCommand } from '../src/agent/agentChatCommand.ts';
import { type AgentRuntimeContinuation } from '../src/agent/runtime/agentRuntimeContract.ts';

function observationResult(hwnd: number, pid: number) {
  return {
    ok: true,
    responseText: 'A live target window was observed.',
    stateSummary: {
      structuredEvidence: {
        observationCapturedAt: Date.now(),
        status: 'success',
        targetCandidates: [{
          confidence: 'high',
          label: 'Example App',
          source: 'observe_windows_and_apps',
          window: { hwnd, pid, processName: 'example-app', title: 'Example App' },
        }],
      },
    },
  };
}

const command: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Focus Example App',
  kind: 'tool-call',
  sourceText: 'focus Example App',
  toolCall: {
    goal: 'Focus Example App',
    input: { action: 'focus_window', hwnd: 100, pid: 10, query: 'Example App' },
    name: 'execute_desktop_action',
  },
};

const continuation: AgentRuntimeContinuation = {
  historyLines: [],
  sourceText: command.sourceText,
  steps: [],
  taskState: null,
  traceEvents: [],
  toolResults: [{
    command: {
      ...command,
      toolCall: {
        ...command.toolCall!,
        input: { action: 'observe_windows_and_apps' },
        name: 'observe_windows_and_apps',
      },
    },
    result: {
      ok: true,
      stateSummary: {
        structuredEvidence: {
          observationCapturedAt: Date.now() - 10_000,
          status: 'success',
          targetCandidates: [{
            confidence: 'high',
            label: 'Example App',
            source: 'observe_windows_and_apps',
            window: { hwnd: 100, pid: 10, processName: 'example-app', title: 'Example App' },
          }],
        },
      },
    },
  }],
  userGoal: command.instruction,
};

let observationCount = 0;
const resolved = await resolveAgentApprovedDispatch({
  command,
  continuation,
  executeObservation: async (observationCommand) => {
    observationCount += 1;
    assert.equal(observationCommand.toolCall?.name, 'observe_windows_and_apps');
    return observationResult(200, 20);
  },
});

assert.equal(observationCount, 1);
assert.equal(resolved.blockedResult, null);
assert.equal(resolved.command.toolCall?.input.hwnd, 200);
assert.equal(resolved.command.toolCall?.input.pid, 20);
assert.ok(resolved.plan?.steps.length);

let blockedExecutionCount = 0;
const blocked = await resolveAgentApprovedDispatch({
  command,
  continuation,
  executeObservation: async () => {
    blockedExecutionCount += 1;
    return { ok: true, responseText: 'No live window candidates were found.' };
  },
});
assert.equal(blockedExecutionCount, 1);
assert.ok(blocked.blockedResult);
assert.equal(blocked.blockedResult?.receipt?.status, 'blocked');
assert.equal(blocked.command.toolCall?.input.hwnd, 100);

const sequenceCommand: AgentChatCommand = {
  ...command,
  toolCall: {
    ...command.toolCall!,
    input: {
      stepsJson: JSON.stringify([
        { args: { action: 'focus_window', hwnd: 100, pid: 10, query: 'Example App' }, tool: 'execute_desktop_action' },
        { args: { action: 'click', expectedForegroundHwnd: 100, expectedForegroundPid: 10, x: 20, y: 30 }, tool: 'execute_desktop_input' },
      ]),
    },
    name: 'execute_desktop_sequence',
  },
};
const resolvedSequence = await resolveAgentApprovedDispatch({
  command: sequenceCommand,
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
const resolvedSteps = JSON.parse(String(resolvedSequence.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
}>;
assert.equal(resolvedSteps[0]?.args.hwnd, 200);
assert.equal(resolvedSteps[0]?.args.pid, 20);
assert.equal(resolvedSteps[1]?.args.expectedForegroundHwnd, 200);
assert.equal(resolvedSteps[1]?.args.expectedForegroundPid, 20);
assert.ok(resolvedSequence.plan?.steps.length);

const resolvedNonFocusSequence = await resolveAgentApprovedDispatch({
  command: {
    ...sequenceCommand,
    toolCall: {
      ...sequenceCommand.toolCall!,
      input: {
        stepsJson: JSON.stringify([
          { args: { action: 'focus_window', hwnd: 100, pid: 10, query: 'Example App' }, tool: 'execute_desktop_action' },
          { args: { action: 'control_window', hwnd: 100, pid: 10, operation: 'restore', query: 'Example App' }, tool: 'execute_desktop_action' },
          { args: { action: 'close_window', hwnd: 100, pid: 10, query: 'Example App' }, tool: 'execute_desktop_action' },
        ]),
      },
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
const resolvedNonFocusSteps = JSON.parse(String(resolvedNonFocusSequence.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
}>;
assert.equal(resolvedNonFocusSteps[1]?.args.action, 'control_window');
assert.equal(resolvedNonFocusSteps[1]?.args.hwnd, 200);
assert.equal(resolvedNonFocusSteps[1]?.args.pid, 20);
assert.equal(resolvedNonFocusSteps[2]?.args.action, 'close_window');
assert.equal(resolvedNonFocusSteps[2]?.args.hwnd, 200);
assert.equal(resolvedNonFocusSteps[2]?.args.pid, 20);

const resolvedLaunchThenInputSequence = await resolveAgentApprovedDispatch({
  command: {
    ...sequenceCommand,
    toolCall: {
      ...sequenceCommand.toolCall!,
      input: {
        stepsJson: JSON.stringify([
          { args: { action: 'launch_local_app', target: 'Example App' }, tool: 'execute_desktop_action' },
          { args: { action: 'click', expectedForegroundHwnd: 100, expectedForegroundPid: 10, x: 20, y: 30 }, tool: 'execute_desktop_input' },
        ]),
      },
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
const resolvedLaunchThenInputSteps = JSON.parse(String(resolvedLaunchThenInputSequence.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
}>;
assert.equal(resolvedLaunchThenInputSteps[1]?.args.sourceQuery, 'Example App');
assert.equal(resolvedLaunchThenInputSteps[1]?.args.expectedForegroundHwnd, undefined);
assert.equal(resolvedLaunchThenInputSteps[1]?.args.expectedForegroundPid, undefined);

assert.equal(
  resolveAgentRuntimeDesktopSequencePostCreationTarget({
    createdTarget: 'First App',
    nextStepTarget: 'Second App',
  }),
  'Second App',
  'a step with its own semantic target must not be rebound to the app created by the previous step',
);
assert.equal(
  resolveAgentRuntimeDesktopSequencePostCreationTarget({
    createdTarget: 'Example App',
    nextStepTarget: '',
  }),
  'Example App',
  'an untargeted immediate input step should inherit the just-created app as its logical target',
);
assert.equal(
  getAgentRuntimeDesktopSequenceWindowTarget({
    args: { action: 'interact_window_ui', target: 'Continue', query: 'Example App' },
    tool: 'execute_desktop_action',
  }),
  'Example App',
  'UI control text must not be used as the post-creation window query',
);
assert.equal(
  getAgentRuntimeDesktopSequenceWindowTarget({
    args: { action: 'invoke_window_ui', name: 'Continue', title: 'Example App' },
    tool: 'execute_desktop_action',
  }),
  'Example App',
  'UI control name must not be used as the post-creation window query',
);
assert.equal(
  getAgentRuntimeDesktopSequenceWindowTarget({
    args: {
      action: 'click',
      expectedForegroundTitle: 'Old Window Title',
      expectedForegroundProcessName: 'old-process',
      sourceQuery: 'Example App',
    },
    tool: 'execute_desktop_input',
  }),
  'Example App',
  'input identity fields must not become stale post-creation window queries',
);
assert.equal(
  resolveAgentRuntimeDesktopSequenceObservedWindow({
    ok: true,
    responseText: 'An unrelated window was observed.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 300, pid: 30, processName: 'other-app', title: 'Other App' },
        status: 'success',
      },
    },
  }, 'Example App'),
  null,
  'a fresh observation must not bind an unrelated sole window to a semantic target',
);
assert.equal(
  resolveAgentRuntimeDesktopSequenceObservedWindow({
    ok: true,
    responseText: 'The requested window was observed.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 400, pid: 40, processName: 'example-app', title: 'Example App' },
        status: 'success',
      },
    },
  }, 'Example App')?.hwnd,
  400,
  'a semantic target should bind only to its matching live HWND/PID pair',
);
assert.equal(
  resolveAgentRuntimeDesktopSequenceObservedWindow({
    ok: true,
    responseText: 'A launched application window was observed.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 500, pid: 50, processName: 'example-app', title: 'Example App' },
        status: 'success',
      },
    },
  }, 'C:\\Apps\\Example App\\Example App.exe')?.hwnd,
  500,
  'a path target should match the executable basename without requiring the full path in the window title',
);

const unrelatedSequence = await resolveAgentApprovedDispatch({
  command: {
    ...sequenceCommand,
    toolCall: {
      ...sequenceCommand.toolCall!,
      input: {
        stepsJson: JSON.stringify([
          { args: { action: 'focus_window', hwnd: 100, pid: 10, query: 'Example App' }, tool: 'execute_desktop_action' },
          { args: { action: 'click', x: 50, y: 60 }, tool: 'execute_desktop_input' },
        ]),
      },
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
const unrelatedSteps = JSON.parse(String(unrelatedSequence.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
}>;
assert.equal(unrelatedSteps[1]?.args.expectedForegroundHwnd, undefined);

const uiSequence = await resolveAgentApprovedDispatch({
  command: {
    ...sequenceCommand,
    toolCall: {
      ...sequenceCommand.toolCall!,
      input: {
        stepsJson: JSON.stringify([
          { args: { action: 'interact_window_ui', hwnd: 100, pid: 10, query: 'Example App', targetText: 'Continue' }, tool: 'execute_desktop_action' },
        ]),
      },
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
const uiSteps = JSON.parse(String(uiSequence.command.toolCall?.input.stepsJson)) as Array<{
  tool: string;
  args: Record<string, unknown>;
}>;
assert.equal(uiSteps[0]?.tool, 'execute_desktop_action');
assert.equal(uiSteps[0]?.args.action, 'interact_window_ui');
assert.equal(uiSteps[0]?.args.hwnd, 200);
assert.equal(uiSteps[0]?.args.pid, 20);

const directUi = await resolveAgentApprovedDispatch({
  command: {
    ...command,
    toolCall: {
      ...command.toolCall!,
      input: {
        action: 'interact_window_ui',
        hwnd: 100,
        pid: 10,
        query: 'Example App',
        targetText: 'Continue',
        uiAction: 'invoke',
      },
      name: 'execute_desktop_action',
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
assert.equal(directUi.command.toolCall?.input.action, 'interact_window_ui');
assert.equal(directUi.command.toolCall?.input.hwnd, 200);
assert.equal(directUi.command.toolCall?.input.pid, 20);

const directUiByIdentityOnly = await resolveAgentApprovedDispatch({
  command: {
    ...command,
    toolCall: {
      ...command.toolCall!,
      input: {
        action: 'interact_window_ui',
        hwnd: 100,
        pid: 10,
        targetText: 'Continue',
        uiAction: 'invoke',
      },
      name: 'execute_desktop_action',
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
assert.equal(directUiByIdentityOnly.command.toolCall?.input.action, 'interact_window_ui');
assert.ok(directUiByIdentityOnly.blockedResult);
assert.equal(directUiByIdentityOnly.blockedResult?.receipt?.status, 'blocked');
assert.equal(directUiByIdentityOnly.command.toolCall?.input.hwnd, 100);
assert.equal(directUiByIdentityOnly.command.toolCall?.input.pid, 10);

const observationFailure = await resolveAgentApprovedDispatch({
  command,
  continuation,
  executeObservation: async () => {
    throw new Error('observation bridge unavailable');
  },
});
assert.ok(observationFailure.blockedResult);
assert.equal(observationFailure.blockedResult?.receipt?.status, 'blocked');
assert.match(observationFailure.blockedResult?.errorText ?? '', /observation bridge unavailable/u);

const directInputAlias = await resolveAgentApprovedDispatch({
  command: {
    ...command,
    toolCall: {
      ...command.toolCall!,
      input: {
        action: 'click',
        hwnd: 100,
        pid: 10,
        title: 'Example App',
        x: 20,
        y: 30,
      },
      name: 'execute_desktop_input',
    },
  },
  continuation,
  executeObservation: async () => observationResult(200, 20),
});
assert.equal(directInputAlias.command.toolCall?.input.expectedForegroundHwnd, 200);
assert.equal(directInputAlias.command.toolCall?.input.expectedForegroundPid, 20);

console.log('agent approved dispatch resolution smoke ok');
