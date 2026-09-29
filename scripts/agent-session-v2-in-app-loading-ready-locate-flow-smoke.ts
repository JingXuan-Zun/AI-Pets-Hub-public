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

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'desktop-observation' : 'app-launcher',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input,
      name,
    },
  };
}

const approvedOpenCommand = createToolCommand('execute_desktop_action', {
  action: 'launch_local_app',
  target: 'Example Launcher',
});

const approvedOpenResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['Window opened: Example Launcher'],
    status: 'success',
    summaryLines: ['Call: execute_desktop_action launch_local_app'],
    title: 'Open app',
    toolName: 'execute_desktop_action',
    verification: 'Example Launcher window is open.',
  },
  responseText: 'Opened Example Launcher.',
  stateSummary: {
    observedState: ['Window opened: Example Launcher'],
    structuredEvidence: {
      finalWindow: {
        hwnd: 100,
        processName: 'example-launcher',
        title: 'Example Launcher',
      },
      status: 'success',
      targetMatched: 'Example Launcher',
    },
    verificationEvidence: ['Example Launcher window is open.'],
  },
  verification: 'Example Launcher window is open.',
};

function createLauncherStateResult(state: 'loading' | 'ready', label: string): AgentChatCommandResult {
  const ready = state === 'ready';
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Example Launcher state=${state}`],
      status: ready ? 'success' : 'unverified',
      summaryLines: ['Call: execute_desktop_observation', `State: ${state}`],
      title: `${label} launcher observation`,
      toolName: 'execute_desktop_observation',
      verification: ready
        ? 'Example Launcher is ready, but Example Game has not been started.'
        : 'Example Launcher is still loading.',
    },
    responseText: ready
      ? `${label}: Example Launcher is ready; Example Game start action is not complete.`
      : `${label}: Example Launcher is still loading.`,
    stateSummary: {
      missingEvidence: ready
        ? ['Example Game start/play action has not been clicked.']
        : ['Example Launcher is not ready for internal target location yet.'],
      observedState: [
        `${label}: Example Launcher state=${state}`,
        ready ? 'No Example Game start confirmation is visible.' : 'Loading spinner is visible.',
      ],
      recommendedRecovery: ready
        ? ['tool:locate_screen_elements target=Example Game primary action']
        : ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        finalWindow: {
          hwnd: 100,
          processName: 'example-launcher',
          title: 'Example Launcher',
        },
        postActionState: ready ? 'unknown' : 'loading',
        status: ready ? 'success' : 'loading',
        targetMatched: 'Example Launcher',
      },
      verificationEvidence: ready
        ? ['Example Launcher is ready.']
        : ['Example Launcher is still loading.'],
    },
    verification: ready
      ? 'Only the launcher is ready; the internal Example Game action remains incomplete.'
      : 'Post-action state is loading.',
  };
}

function createLocatedGameResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Play button',
      'Visual element center: x=1440 y=920',
      'Visual action readiness: ready',
    ],
    ok: true,
    responseText: 'Located Example Game and its Play button inside Example Launcher.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual primary action: Play button',
        'Visual element center: x=1440 y=920',
      ],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1440,
          y: 920,
        },
        primaryAction: 'Play button',
        relation: 'Play button belongs to Example Game',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Example Game Play button is visible at x=1440 y=920.'],
    },
    verification: 'The in-app launch control is visible and actionable.',
  };
}

const toolCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedOpenCommand,
    result: approvedOpenResult,
  },
  maxSteps: 5,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called for loading -> ready -> locate in-app flow');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    toolCommands.push(command);
    if (toolCommands.length === 1) {
      assert.ok(
        command.toolCall?.name === 'observe_windows_and_apps'
          || command.toolCall?.name === 'execute_desktop_observation',
        `expected generic post-approval verification, got ${command.toolCall?.name ?? command.kind}`,
      );
      assert.match(String(command.toolCall.input.query), /Example Launcher/);
      return createLauncherStateResult('loading', 'verification');
    }

    if (toolCommands.length === 2) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'wait_and_observe');
      assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
      return createLauncherStateResult('ready', 'wait 1');
    }

    assert.ok(
      command.toolCall?.name === 'locate_screen_elements'
        || command.toolCall?.name === 'execute_desktop_observation',
      `expected a generic visual locate/read tool, got ${command.toolCall?.name ?? command.kind}`,
    );
    return createLocatedGameResult();
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440/u);
assert.ok(
  toolCommands.length >= 3,
  `expected verification, wait, and generic visual locate/read tools; got ${toolCommands.map((command) => command.toolCall?.name).join(',')}`,
);
const history = result.continuation.historyLines.join('\n');
assert.match(history, /ActionRuntime current action/u);
assert.match(history, /postActionState=loading/u);
assert.match(history, /automatic recovery observation result/u);
assert.match(history, /prepared visual-action approval/u);

console.log('agent session v2 in-app loading ready locate flow smoke ok');
