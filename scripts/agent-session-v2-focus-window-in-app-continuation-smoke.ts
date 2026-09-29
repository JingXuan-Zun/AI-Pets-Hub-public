import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { strict as assert } from 'node:assert';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent Open League of Legends inside WeGame';
const userGoal = 'Open League of Legends inside WeGame';

const approvedFocusCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'focus_window',
      reason: 'Bring WeGame to the foreground before locating League of Legends.',
      target: 'WeGame',
    },
    name: 'execute_desktop_action',
  },
};

const approvedFocusResult: AgentChatCommandResult = {
  ok: true,
  observations: [
    'Tool: execute_desktop_action',
    'Desktop action: focus_window',
    'Focus window query: WeGame',
    'Focused process: wegame',
  ],
  receipt: {
    evidenceLines: [
      'Desktop action: focus_window',
      'Focus window query: WeGame',
      'Focused process: wegame',
    ],
    status: 'success',
    summaryLines: ['Bring a matching existing window to the foreground: WeGame'],
    title: 'Focus window',
    toolName: 'execute_desktop_action',
    verification: '窗口已切到前台：wegame',
  },
  responseText: '已唤出匹配窗口：WeGame。',
  stateSummary: {
    observedState: [
      'Focus window query: WeGame',
      'Focused process: wegame',
    ],
    structuredEvidence: {
      postActionState: 'launched',
      status: 'success',
      targetMatched: 'WeGame',
    },
    verificationEvidence: ['窗口已切到前台：wegame'],
  },
  verification: '窗口已切到前台：wegame',
};

const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedFocusCommand,
    result: approvedFocusResult,
  },
  maxSteps: 5,
  modelCaller: async () => {
    throw new Error('focus-window in-app continuation should not need a model turn before locate');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    toolCommands.push(command);

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
      return {
        observations: [
          'Windows/apps query:',
          'Installed app entries: 0',
          'Taskbar pinned entries: 13',
          'Running windows: 9',
          'Active process: AI Desktop Pet',
          'Active title: AI Desktop Pet',
        ],
        ok: true,
        responseText: 'Observed apps/windows: installed=0, taskbarPinned=13, running=9. Active window: AI Desktop Pet - AI Desktop Pet.',
        stateSummary: {
          observedState: [
            'Windows/apps query:',
            'Running windows: 9',
            'Active process: AI Desktop Pet',
          ],
          structuredEvidence: {
            finalWindow: {
              processName: 'AI Desktop Pet',
              title: 'AI Desktop Pet',
            },
            status: 'success',
            targetMatched: 'AI Desktop Pet',
          },
          verificationEvidence: [
            'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
          ],
        },
        verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
    assert.match(String(command.toolCall.input.targetDescription), /League of Legends/u);
    return {
      observations: [
        'Visual target matched: League of Legends',
        'Visual primary action: Start',
        'Visual element center: x=1440 y=920',
      ],
      ok: true,
      responseText: 'Located League of Legends and its Start button in WeGame.',
      stateSummary: {
        observedState: [
          'Visual target matched: League of Legends',
          'Visual primary action: Start',
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
          launcherVerification: {
            detailMatchesTarget: true,
            primaryActionMatchesTarget: true,
            status: 'ready',
            targetSelected: true,
            targetVisible: true,
          },
          primaryAction: 'Start',
          status: 'success',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['League of Legends Start button is ready.'],
      },
      verification: 'League of Legends Start button is ready.',
    };
  },
  userGoal,
});

assert.ok(
  toolCommands.some((command) => (
    command.toolCall?.name === 'locate_screen_elements'
    && command.toolCall.input.sourceQuery === 'WeGame'
    && /League of Legends/u.test(String(command.toolCall.input.targetDescription))
  )),
  `expected in-app locate after focus-window approval, got: ${toolCommands.map((command) => command.toolCall?.name).join(', ')}`,
);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate/u);

const activeWindowObservationCommands: AgentChatCommand[] = [];
const activeWindowObservationResult = await runAgentProductionSession({
  continuation: {
    historyLines: [
      'Previous in-app locate failed before WeGame was focused.',
    ],
    steps: [],
    toolResults: [
      {
        command: {
          capabilityId: 'desktop-observation',
          instruction: 'Locate in-app target',
          kind: 'tool-call',
          sourceText,
          toolCall: {
            goal: userGoal,
            input: {
              action: 'locate_element',
              question: 'AgentSessionV2 in-app target locate Source app/window: WeGame. Target inside that app/window: League of Legends.',
              sourceQuery: 'WeGame',
              targetDescription: 'League of Legends and its primary open/start/play/launch action inside WeGame',
              targetText: 'League of Legends',
            },
            name: 'locate_screen_elements',
          },
        },
        result: {
          errorText: 'No matching screen/window capture source was found.',
          ok: false,
          responseText: 'No matching screen/window capture source was found.',
        },
      },
    ],
  },
  approvedToolResult: {
    command: approvedFocusCommand,
    result: {
      ...approvedFocusResult,
      ok: true,
      responseText: '当前活动窗口：WeGame 进程：wegame PID：2620',
      stateSummary: {
        observedState: [
          'Desktop observation: get_active_window_info',
          'Active process: wegame',
          'Active title: WeGame',
        ],
        structuredEvidence: {
          status: 'success',
          targetMatched: 'WeGame',
        },
        verificationEvidence: [
          'Active process: wegame',
          'Active title: WeGame',
        ],
      },
      verification: '当前前台窗口来自 Windows 原生窗口查询：WeGame',
    },
  },
  maxSteps: 5,
  modelCaller: async () => {
    throw new Error('active-window observation continuation should not need a model turn before locate');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    activeWindowObservationCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
    assert.match(String(command.toolCall.input.targetDescription), /League of Legends/u);
    return {
      observations: ['Visual target matched: League of Legends'],
      ok: true,
      responseText: 'Located League of Legends Start button in WeGame.',
      stateSummary: {
        structuredEvidence: {
          confidence: 'high',
          coordinateAuditStatus: 'coordinate_ok',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1440,
            y: 920,
          },
          launcherVerification: {
            detailMatchesTarget: true,
            primaryActionMatchesTarget: true,
            status: 'ready',
            targetSelected: true,
            targetVisible: true,
          },
          primaryAction: 'Start',
          status: 'success',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['League of Legends Start button is ready.'],
      },
      verification: 'League of Legends Start button is ready.',
    };
  },
  userGoal,
});

assert.ok(
  activeWindowObservationCommands.some((command) => command.toolCall?.name === 'locate_screen_elements'),
  `expected active-window observation to retry locate after earlier failed locate, got: ${activeWindowObservationCommands.map((command) => command.toolCall?.name).join(', ')}`,
);
assert.equal(activeWindowObservationResult.status, 'needs-approval');
assert.equal(activeWindowObservationResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');

console.log('agent session v2 focus-window in-app continuation smoke ok');
