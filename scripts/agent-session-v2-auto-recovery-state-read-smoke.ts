import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start the visible app from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1440,
              y: 920,
            },
            reason: 'Click the visible Start control.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createDoubleClickSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start the visible app from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'double_click',
              x: 1440,
              y: 920,
            },
            reason: 'Double-click the visible Start control after single click did not advance.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createUnverifiedSequenceResult(postActionState: 'blocked' | 'unchanged'): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`Post-action visual state: ${postActionState}`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', `Post-action visual state: ${postActionState}`],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: `Post-sequence visual state is ${postActionState}.`,
    },
    responseText: `Clicked the launcher area, but the visible UI is ${postActionState}.`,
    stateSummary: {
      missingEvidence: ['The requested app was not confirmed launched.'],
      observedState: [`Post-action visual state: ${postActionState}`],
      structuredEvidence: {
        postActionState,
        status: 'unverified',
        targetMatched: 'Example Game',
      },
    },
    verification: `Post-sequence visual state is ${postActionState}.`,
  };
}

function createAdjustedTargetResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Start',
      'Visual element center: x=1460 y=930',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Fallback recovery read found an adjusted Start coordinate at 1460,930.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: adjusted target found'],
      title: 'Post-action recovery state read',
      toolName: 'locate_screen_elements',
      verification: 'An adjusted Start control coordinate is visible.',
    },
    responseText: 'Fallback recovery read found a clear adjusted Start control for Example Game.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1460 y=930',
      ],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1460,
          y: 930,
        },
        primaryAction: 'Start',
        relation: 'Start control belongs to Example Game',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Fallback recovery read found an adjusted Start coordinate at 1460,930.'],
    },
    verification: 'An adjusted Start control coordinate is visible.',
  };
}

function createSameCoordinateTargetResult(candidateState?: {
  actions?: string[];
  enabled?: boolean;
  hasKeyboardFocus?: boolean;
  keyboardFocusable?: boolean;
  offscreen?: boolean;
}): AgentChatCommandResult {
  const candidate = candidateState
    ? {
        actions: candidateState.actions ?? [],
        automationId: 'example-game-start',
        center: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1440,
          y: 920,
        },
        confidence: 'high' as const,
        controlType: 'Button',
        description: [
          'Example Game Start button',
          typeof candidateState.enabled === 'boolean' ? `enabled=${candidateState.enabled}` : '',
          typeof candidateState.keyboardFocusable === 'boolean' ? `keyboardFocusable=${candidateState.keyboardFocusable}` : '',
          candidateState.hasKeyboardFocus ? 'focused=true' : '',
          candidateState.offscreen ? 'offscreen=true' : '',
        ].filter(Boolean).join(' '),
        enabled: candidateState.enabled ?? null,
        hasKeyboardFocus: candidateState.hasKeyboardFocus ?? null,
        keyboardFocusable: candidateState.keyboardFocusable ?? null,
        label: 'Example Game Start',
        offscreen: candidateState.offscreen ?? null,
        source: 'ui-automation',
      }
    : null;

  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Start',
      'Visual element center: x=1440 y=920',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Fallback recovery read found the same Start coordinate at 1440,920.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: same target found'],
      title: 'Post-action recovery state read',
      toolName: 'locate_screen_elements',
      verification: 'The same Start control coordinate is still visible.',
    },
    responseText: 'Fallback recovery read found the same clear Start control for Example Game.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1440 y=920',
      ],
      structuredEvidence: {
        actionCandidates: candidate ? [candidate] : null,
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1440,
          y: 920,
        },
        primaryAction: 'Start',
        relation: 'Start control still belongs to Example Game',
        status: 'success',
        targetCandidates: candidate ? [candidate] : null,
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Fallback recovery read found the same Start coordinate at 1440,920.'],
    },
    verification: 'The same Start control coordinate is still visible.',
  };
}

function createCandidateOnlyInvokableUiResult(): AgentChatCommandResult {
  return {
    observations: [
      'Window UI query: Launcher',
      'Matched controls: Example Game id=example-game-start type=Button center=1440,920 actions=invoke',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['UI Automation found an invokable Example Game control at 1440,920.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: candidate-only UIA control found'],
      title: 'Post-action recovery state read',
      toolName: 'locate_screen_elements',
      verification: 'An invokable UIA control is visible, but top-level target/action fields are incomplete.',
    },
    responseText: 'Recovery read found an invokable UI Automation control for Example Game.',
    stateSummary: {
      observedState: [
        'UI Automation candidate: Example Game Start Button',
      ],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['invoke'],
            automationId: 'example-game-start',
            bounds: {
              coordinateSpace: 'native-screen',
              height: 44,
              source: 'ui-automation',
              width: 150,
              x: 1365,
              y: 898,
            },
            center: {
              coordinateSpace: 'native-screen',
              source: 'ui-automation',
              x: 1440,
              y: 920,
            },
            confidence: 'high',
            controlType: 'Button',
            description: 'Example Game Start button actions=invoke enabled=true',
            enabled: true,
            keyboardFocusable: true,
            label: 'Example Game Start',
            name: 'Example Game',
            offscreen: false,
            relation: 'UI Automation reports this control as actionable or focusable.',
            source: 'ui-automation',
            window: {
              hwnd: 1001,
              processName: 'Launcher.exe',
              title: 'Launcher',
            },
          },
        ],
        confidence: 'medium',
        coordinateConfidence: 'medium',
        relation: 'Candidate-only UIA evidence; top-level target/action fields were not populated.',
        status: 'success',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['UIA candidate evidence is enabled, onscreen, and invokable.'],
    },
    verification: 'An invokable UIA control was returned as candidate evidence.',
  };
}

async function runCase(postActionState: 'blocked' | 'unchanged') {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createSequenceCommand(),
      result: createUnverifiedSequenceResult(postActionState),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called when state fallback read finds an adjusted action');
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(
        command.toolCall.input.action,
        postActionState === 'unchanged' ? 'locate_element' : 'describe_elements',
      );
      assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
      assert.match(String(command.toolCall.input.question), /do not click anything/iu);
      assert.equal(command.toolCall.input.recoveryPostActionState, postActionState);
      return createAdjustedTargetResult();
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0, JSON.stringify(result, null, 2));
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1460/u);
  assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /930/u);
  assert.doesNotMatch(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440[^]*920/u);
  assert.match(result.continuation.historyLines.join('\n'), /automatic recovery loop continued/u);
  assert.match(result.continuation.historyLines.join('\n'), /visual-action approval after auto recovery/u);
}

async function runSameCoordinateEscalationCase() {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createSequenceCommand(),
      result: createUnverifiedSequenceResult('unchanged'),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called when same-coordinate recovery can escalate');
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return createSameCoordinateTargetResult();
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0, JSON.stringify(result, null, 2));
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
  assert.match(stepsJson, /"action":"double_click"/u);
  assert.match(stepsJson, /1440/u);
  assert.match(stepsJson, /920/u);
  assert.doesNotMatch(stepsJson, /"action":"click"/u);
  assert.match(result.finalAnswer, /double-click \(1440, 920\)/iu);
}

async function runKeyboardConfirmEscalationCase() {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createDoubleClickSequenceCommand(),
      result: createUnverifiedSequenceResult('unchanged'),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called when keyboard confirmation fallback can be prepared');
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return createSameCoordinateTargetResult({
        enabled: true,
        hasKeyboardFocus: true,
        keyboardFocusable: true,
        offscreen: false,
      });
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0);
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
  assert.match(stepsJson, /"action":"click"/u);
  assert.match(stepsJson, /"action":"hotkey"/u);
  assert.match(stepsJson, /"hotkey":"Enter"/u);
  assert.doesNotMatch(stepsJson, /"action":"double_click"/u);
  assert.match(result.finalAnswer, /Enter/u);
}

async function runCandidateOnlyInvokableUiRecoveryCase() {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createSequenceCommand(),
      result: createUnverifiedSequenceResult('unchanged'),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called when candidate-only UIA recovery can be approved');
    },
    settings,
    sourceText: '/agent start Example Game from launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return createCandidateOnlyInvokableUiResult();
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0);
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
  assert.match(stepsJson, /interact_window_ui/u);
  assert.match(stepsJson, /"uiAction":"invoke"/u);
  assert.match(stepsJson, /example-game-start/u);
  assert.match(stepsJson, /1440/u);
  assert.match(stepsJson, /920/u);
  assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
}

async function runKeyboardConfirmBlockedByDisabledUiEvidenceCase() {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createDoubleClickSequenceCommand(),
      result: createUnverifiedSequenceResult('unchanged'),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called while the deterministic recovery fallback is being evaluated');
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return createSameCoordinateTargetResult({
        enabled: false,
        hasKeyboardFocus: false,
        keyboardFocusable: true,
        offscreen: false,
      });
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0);
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
  assert.doesNotMatch(stepsJson, /"action":"hotkey"/u);
  assert.doesNotMatch(stepsJson, /Enter|Space/u);
}

async function runDisabledInvokableUiCandidateAvoidsUiaCase() {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: createSequenceCommand(),
      result: createUnverifiedSequenceResult('unchanged'),
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error('model should not be called while disabled UIA candidate fallback is evaluated');
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return createSameCoordinateTargetResult({
        actions: ['invoke'],
        enabled: false,
        hasKeyboardFocus: false,
        keyboardFocusable: true,
        offscreen: false,
      });
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0);
  assert.equal(recoveryCommands.length, 1);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
  assert.doesNotMatch(stepsJson, /interact_window_ui/u);
  assert.match(stepsJson, /"action":"double_click"/u);
}

await runCase('blocked');
await runCase('unchanged');
await runSameCoordinateEscalationCase();
await runKeyboardConfirmEscalationCase();
await runCandidateOnlyInvokableUiRecoveryCase();
await runKeyboardConfirmBlockedByDisabledUiEvidenceCase();
await runDisabledInvokableUiCandidateAvoidsUiaCase();

console.log('agent session v2 auto recovery state read smoke ok');
