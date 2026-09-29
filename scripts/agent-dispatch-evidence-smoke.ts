import assert from 'node:assert/strict';
import {
  hasAgentRuntimeCommittedDesktopDispatch,
  hasAgentRuntimeCommittedInputDispatch,
  hasAgentRuntimeDesktopDispatch,
  hasAgentRuntimeInAppDispatch,
  hasAgentRuntimeInputDispatch,
} from '../src/agent/runtime/agentDispatchEvidence.ts';

const clickCommand = {
  toolCall: {
    input: { action: 'click' },
    name: 'execute_desktop_input',
  },
};
const inAppClickCommand = {
  toolCall: {
    actionScope: { targetRef: 'requested control' },
    input: { action: 'click' },
    name: 'execute_desktop_input',
  },
};
const genericSequenceCommand = {
  toolCall: {
    input: {
      stepsJson: JSON.stringify([
        { args: { action: 'click', x: 10, y: 20 }, tool: 'execute_desktop_input' },
      ]),
    },
    name: 'execute_desktop_sequence',
  },
};
const directUiActionCommand = {
  toolCall: {
    input: { action: 'select_window_ui', targetText: 'Target item' },
    name: 'execute_desktop_action',
  },
};
const focusCommand = {
  toolCall: {
    input: { action: 'focus_window' },
    name: 'execute_desktop_action',
  },
};

assert.equal(hasAgentRuntimeInputDispatch(clickCommand), true);
assert.equal(hasAgentRuntimeDesktopDispatch(clickCommand), true);
assert.equal(hasAgentRuntimeInAppDispatch(clickCommand), false);
assert.equal(hasAgentRuntimeInAppDispatch(inAppClickCommand), true);
assert.equal(hasAgentRuntimeInAppDispatch(genericSequenceCommand), false);
assert.equal(hasAgentRuntimeInAppDispatch(directUiActionCommand), true);
assert.equal(hasAgentRuntimeCommittedInputDispatch(clickCommand, { ok: true }), false);
assert.equal(hasAgentRuntimeCommittedInputDispatch(clickCommand, {
  ok: true,
  receipt: { status: 'success' },
}), true);
assert.equal(hasAgentRuntimeCommittedInputDispatch(clickCommand, { ok: false }), false);
assert.equal(hasAgentRuntimeCommittedInputDispatch(clickCommand, { ok: true, receipt: { status: 'blocked' } }), false);
assert.equal(hasAgentRuntimeCommittedInputDispatch(clickCommand, {
  ok: true,
  receipt: {
    stateSummary: { actionEvidence: { outcome: 'blocked' } },
  },
}), false);
assert.equal(hasAgentRuntimeCommittedDesktopDispatch(focusCommand, { ok: true }), false);
assert.equal(hasAgentRuntimeCommittedDesktopDispatch(focusCommand, {
  ok: true,
  receipt: { status: 'success' },
}), true);
assert.equal(hasAgentRuntimeCommittedDesktopDispatch(focusCommand, { ok: false }), false);
assert.equal(hasAgentRuntimeInAppDispatch(focusCommand), false);

console.log('agent dispatch evidence smoke ok');
