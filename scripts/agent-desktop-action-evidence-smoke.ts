import assert from 'node:assert/strict';
import {
  createAgentToolStateSummary,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentDesktopActionEvidence,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import {
  executeDesktopInput,
} from '../src/agent/agentRuntimeDesktopTools.ts';
import {
  executeDesktopSequence,
} from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';
import { readModuleProjectFile as readProjectFile } from './projectModuleSource.mjs';

function createToolCommand(
  name: AgentToolCallName,
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'desktop-automation',
    instruction: `test ${name}`,
    kind: 'tool-call',
    sourceText: `/agent test ${name}`,
    toolCall: {
      goal: `test ${name}`,
      input,
      name,
    },
  };
}

function createEvidence(overrides: Partial<AgentDesktopActionEvidence> = {}): AgentDesktopActionEvidence {
  return {
    action: 'send_keys',
    confidence: 0.4,
    diff: {
      changed: null,
      signals: ['unit-test'],
      summary: 'Unit-test action evidence.',
    },
    outcome: 'uncertain',
    targetRef: null,
    timestamp: 123,
    tool: 'execute_desktop_input',
    ...overrides,
  };
}

const chatCommandSource = readProjectFile('src/agent/agentChatCommand.ts');
const desktopToolsSource = readProjectFile('src/agent/agentRuntimeDesktopTools.ts');
const sequenceToolsSource = readProjectFile('src/agent/agentRuntimeDesktopSequenceTools.ts');
const launcherServiceSource = readProjectFile('electron/appLauncherService.cjs');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const assessmentSource = readProjectFile('src/agent/agentResultAssessment.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');

assert.match(chatCommandSource, /export interface AgentDesktopActionEvidence/u);
assert.match(chatCommandSource, /actionEvidence\?: AgentDesktopActionEvidence/u);
assert.match(chatCommandSource, /tool: Extract<AgentToolCallName, 'execute_desktop_action' \| 'execute_desktop_input' \| 'execute_desktop_sequence'>/u);

const actionEvidenceActionSet = desktopToolsSource.match(/const AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS = new Set\(\[([\s\S]*?)\]\);/u)?.[1] ?? '';
assert.match(desktopToolsSource, /const AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS = new Set/u);
assert.match(actionEvidenceActionSet, /'focus_window'/u);
assert.match(actionEvidenceActionSet, /'control_window'/u);
assert.match(actionEvidenceActionSet, /'interact_window_ui'/u);
assert.match(actionEvidenceActionSet, /'open_resource'/u);
assert.doesNotMatch(actionEvidenceActionSet, /'list_running_apps'/u);
assert.doesNotMatch(actionEvidenceActionSet, /'get_default_app_for_uri'/u);
assert.doesNotMatch(actionEvidenceActionSet, /'get_active_window_info'/u);

assert.match(desktopToolsSource, /createDesktopInputActionEvidence/u);
assert.match(desktopToolsSource, /actionEvidence,\s*\n\s*missingEvidence/u);
assert.match(sequenceToolsSource, /getAgentRuntimeDesktopSequenceActionEvidence/u);
assert.match(sequenceToolsSource, /stepActionEvidences\.push/u);
assert.match(sequenceToolsSource, /actionOutcome=\$\{stepActionEvidence\.outcome\}/u);
assert.match(sequenceToolsSource, /createAgentRuntimeDesktopSequenceActionEvidence/u);

assert.match(assessmentSource, /actionEvidence: existing\.actionEvidence \?\? receiptState\.actionEvidence \?\? null/u);
assert.match(plannerSource, /stateSummary\.actionEvidence \? `actionEvidence: \$\{JSON\.stringify\(stateSummary\.actionEvidence\)\}`/u);

assert.match(sessionSource, /prefer stateSummary\.actionEvidence/u);
assert.match(sessionSource, /actionEvidence\.outcome changed/u);
assert.match(sessionSource, /do not follow a fixed tool chain template/u);
assert.match(sessionSource, /actionEvidence\.outcome changed means/u);
assert.match(launcherServiceSource, /for \(\$attempt = 0; \$attempt -lt 5; \$attempt\+\+\)/u);
assert.match(launcherServiceSource, /focusAttempts = \$attempt \+ 1/u);
assert.match(launcherServiceSource, /focusStatus = 'confirmed'/u);
assert.match(launcherServiceSource, /foregroundHwnd -eq 0/u);

const standardSummaryEvidence = createEvidence({
  outcome: 'no-op',
  tool: 'execute_desktop_sequence',
});
const standardSummary = createAgentToolStateSummary(
  createToolCommand('execute_desktop_sequence', { stepsJson: '[]' }),
  {
    ok: true,
    responseText: 'Sequence completed with no visible change.',
    stateSummary: {
      actionEvidence: standardSummaryEvidence,
    },
  },
);
assert.equal(standardSummary?.actionEvidence?.outcome, 'no-op');
assert.equal(standardSummary?.actionEvidence?.tool, 'execute_desktop_sequence');

const originalExecuteDesktopInput = desktopPetShellRuntime.executeDesktopInput;
try {
  desktopPetShellRuntime.executeDesktopInput = async (payload?: unknown) => ({
    action: (payload as { action?: string } | null)?.action ?? 'send_keys',
    keys: 'Enter',
    ok: true,
  });

  const inputResult = await executeDesktopInput({
    goal: 'send Enter',
    input: {
      action: 'send_keys',
      keys: 'Enter',
    },
    name: 'execute_desktop_input',
  });

  assert.equal(inputResult.ok, true);
  assert.equal(inputResult.stateSummary?.actionEvidence?.tool, 'execute_desktop_input');
  assert.equal(inputResult.stateSummary?.actionEvidence?.action, 'send_keys');
  assert.equal(inputResult.stateSummary?.actionEvidence?.outcome, 'uncertain');
  assert.equal(inputResult.receipt?.stateSummary?.actionEvidence?.outcome, 'uncertain');

  const sequenceResult = await executeDesktopSequence({} as any, {
    goal: 'run input step',
    input: {
      postVerify: false,
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'send_keys',
            keys: 'Enter',
          },
          reason: 'Send Enter to the already-focused target.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  });

  assert.equal(sequenceResult.ok, true);
  assert.equal(sequenceResult.receipt?.status, 'unverified');
  assert.equal(sequenceResult.stateSummary?.actionEvidence?.tool, 'execute_desktop_sequence');
  assert.equal(sequenceResult.stateSummary?.actionEvidence?.outcome, 'uncertain');
  assert.match(sequenceResult.stateSummary?.actionEvidence?.diff?.signals?.join('\n') ?? '', /step1=uncertain/u);
  assert.match(sequenceResult.receipt?.evidenceLines?.join('\n') ?? '', /actionOutcome=uncertain/u);
} finally {
  desktopPetShellRuntime.executeDesktopInput = originalExecuteDesktopInput;
}

let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            x: 100,
            y: 200,
          },
          tool: 'execute_desktop_input',
        },
      ]),
    }),
    result: {
      ok: true,
      receipt: {
        evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok actionOutcome=no-op'],
        status: 'success',
        summaryLines: ['Call: execute_desktop_sequence'],
        title: 'Agent desktop sequence',
        toolName: 'execute_desktop_sequence',
      },
      responseText: 'Desktop sequence completed, but no visible state change was detected.',
      stateSummary: {
        actionEvidence: createEvidence({
          action: 'sequence',
          diff: {
            changed: false,
            signals: ['step1=no-op'],
            summary: 'Sequence completed, but no state change was detected.',
          },
          outcome: 'no-op',
          tool: 'execute_desktop_sequence',
        }),
      },
    },
  },
  maxSteps: 2,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /stateSummary\.actionEvidence/u);
    assert.match(systemInstruction, /do not follow a fixed tool chain template/u);
    assert.match(userInput, /actionOutcome=no-op/u);
    assert.match(userInput, /actionEvidence=outcome=no-op/u);
    assert.match(userInput, /changed=false/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Action was sent, but there is no evidence that the target state changed.',
      understanding: {
        blockedGoals: ['Target state has no change evidence.'],
        completedGoals: ['Action request was executed.'],
        remainingGoals: [],
        successCriteria: 'State-change evidence is required before completion.',
        userNeed: 'execute desktop action',
        verificationEvidence: ['actionEvidence outcome=no-op'],
        verificationGaps: ['Missing state-change evidence.'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: '/agent click the known button',
  toolExecutor: async () => {
    throw new Error('No further tool should be needed for this smoke.');
  },
  userGoal: 'click the known button',
});

assert.equal(modelCallCount, 2);
assert.equal(sessionResult.status, 'max-steps');
assert.match(sessionResult.finalAnswer ?? '', /(?:no evidence|stopped to avoid looping|Last blocked tool)/iu);

console.log('agent desktop action evidence smoke ok');
