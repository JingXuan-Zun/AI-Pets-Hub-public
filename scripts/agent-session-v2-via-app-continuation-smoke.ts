import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent Open League of Legends via WeGame';
const userGoal = 'Open League of Legends via WeGame';

const approvedOpenCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'launch_local_app',
      target: 'WeGame',
    },
    name: 'execute_desktop_action',
  },
};

const approvedOpenResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [
      'Launch status: launched-new-process',
      'Window process: browser, title: WeGame',
    ],
    status: 'success',
    summaryLines: ['Call: execute_desktop_action launch_local_app'],
    title: 'Open app',
    toolName: 'execute_desktop_action',
    verification: 'After launch, WeGame window was detected.',
  },
  responseText: 'Opened WeGame and detected its window.',
  stateSummary: {
    observedState: ['Window title: WeGame'],
    structuredEvidence: {
      postActionState: 'launched',
      status: 'success',
      targetMatched: 'WeGame',
    },
    verificationEvidence: ['WeGame window is open.'],
  },
  verification: 'After launch, WeGame window was detected.',
};

const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedOpenCommand,
    result: approvedOpenResult,
  },
  maxSteps: 4,
  modelCaller: async () => {
    throw new Error('via-app continuation should locate the in-app target without another model turn');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    toolCommands.push(command);
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

assert.equal(toolCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /taskFlow=continuation-required/u);
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate/u);

console.log('agent session v2 via app continuation smoke ok');
