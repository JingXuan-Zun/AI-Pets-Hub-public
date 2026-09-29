import assert from 'node:assert/strict';

import {
  createAgentDesktopRecoveryCapabilityAdapter,
  createAgentToolCommand,
  createAgentVisualRefinementCommand,
  proposeAgentRecovery,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

const sourceText = '/agent start Example Game inside Launcher';
const userGoal = 'Start Example Game inside Launcher';

const failedEntry: AgentRuntimeToolResultEntry = {
  command: createAgentToolCommand({
    args: {
      stepsJson: JSON.stringify([
        { args: { action: 'click', x: 800, y: 600 }, tool: 'execute_desktop_input' },
      ]),
    },
    sourceText,
    toolName: 'execute_desktop_sequence',
    userGoal,
  }),
  result: {
    errorText: 'The click returned without verified UI change.',
    ok: false,
    responseText: 'Desktop input failed verification.',
    stateSummary: {
      missingEvidence: ['No verified UI change.'],
    },
  },
};

const recoveryAdapters = createAgentDesktopRecoveryCapabilityAdapter({
  resolvePostActionState: () => 'blocked',
});
const failedRecovery = proposeAgentRecovery({
  adapters: recoveryAdapters,
  request: {
    kind: 'failed-action',
    latestEntry: failedEntry,
    sourceText,
    toolResults: [failedEntry],
    userGoal,
  },
});
assert.equal(failedRecovery.status, 'proposed');
assert.equal(failedRecovery.command?.toolCall?.name, 'execute_desktop_observation');
assert.equal(failedRecovery.command?.toolCall?.input.action, 'inspect_window_ui');

const loadingEntry: AgentRuntimeToolResultEntry = {
  command: createAgentToolCommand({
    args: { action: 'click', x: 800, y: 600 },
    sourceText,
    toolName: 'execute_desktop_input',
    userGoal,
  }),
  result: {
    ok: true,
    responseText: 'The launcher is loading the requested content.',
    stateSummary: {
      structuredEvidence: {
        postActionState: 'loading',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
    },
  },
};
const loadingRecoveryAdapters = createAgentDesktopRecoveryCapabilityAdapter({
  resolvePostActionState: () => 'loading',
});
const loadingRecovery = proposeAgentRecovery({
  adapters: loadingRecoveryAdapters,
  request: {
    kind: 'automatic-observation',
    latestEntry: loadingEntry,
    sourceText,
    toolResults: [loadingEntry],
    userGoal,
  },
});
assert.equal(loadingRecovery.status, 'proposed');
assert.equal(loadingRecovery.command?.toolCall?.name, 'execute_desktop_observation');
assert.equal(loadingRecovery.command?.toolCall?.input.action, 'wait_and_observe');

const visualEntry: AgentRuntimeToolResultEntry = {
  command: createAgentToolCommand({
    args: {
      action: 'locate_element',
      sourceQuery: 'Launcher',
      sourceType: 'window',
      targetDescription: 'Example Game and its primary launch button',
    },
    sourceText,
    toolName: 'locate_screen_elements',
    userGoal,
  }),
  result: {
    ok: true,
    responseText: 'A likely launch candidate needs focused validation.',
    stateSummary: {
      structuredEvidence: {
        actionCandidates: [
          {
            centerRatio: { coordinateSpace: 'source-ratio', x: 0.82, y: 0.76 },
            confidence: 'medium',
            label: 'Launch',
            region: 'lower right',
          },
        ],
        confidence: 'medium',
        status: 'unverified',
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-primary-action',
      },
    },
  },
};
const refinementCommand = createAgentVisualRefinementCommand({
  latestEntry: visualEntry,
  sourceText,
  toolResults: [visualEntry],
  userGoal,
});
assert.equal(refinementCommand?.toolCall?.name, 'locate_screen_elements');
assert.equal(refinementCommand?.toolCall?.input.focusCenterRatioX, 0.82);
assert.equal(refinementCommand?.toolCall?.input.focusCenterRatioY, 0.76);
assert.equal(refinementCommand?.toolCall?.input.focusWidthRatio, 0.28);
assert.equal(refinementCommand?.toolCall?.input.focusHeightRatio, 0.24);

const windowUiEntry: AgentRuntimeToolResultEntry = {
  command: createAgentToolCommand({
    args: {
      action: 'inspect_window_ui',
      hwnd: 12345,
      query: 'Example Launcher',
    },
    sourceText,
    toolName: 'execute_desktop_observation',
    userGoal,
  }),
  result: {
    ok: true,
    responseText: 'Inspected UI controls in the active app. controls=6, matched=0, actionable=0',
    stateSummary: {
      observedState: ['UIA found no actionable control.'],
      structuredEvidence: {
        status: 'success',
        visualActionReadiness: 'not-actionable',
      },
    },
  },
};
const windowUiFallbackCommand = createAgentVisualRefinementCommand({
  latestEntry: windowUiEntry,
  sourceText,
  toolResults: [windowUiEntry],
  userGoal,
});
assert.equal(windowUiFallbackCommand?.toolCall?.name, 'locate_screen_elements');
assert.equal(windowUiFallbackCommand?.toolCall?.input.action, 'locate_element');
assert.equal(windowUiFallbackCommand?.toolCall?.input.sourceType, 'window');
assert.equal(windowUiFallbackCommand?.toolCall?.input.sourceQuery, 'Example Launcher');
assert.equal(windowUiFallbackCommand?.toolCall?.input.hwnd, 12345);
assert.match(String(windowUiFallbackCommand?.toolCall?.input.question), /window UI visual fallback/u);

console.log('agent capability adapters runtime smoke ok');
