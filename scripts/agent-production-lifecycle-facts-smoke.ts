import assert from 'node:assert/strict';
import { collectAgentRuntimeLifecycleFacts } from '../src/agent/runtime/agentProductionLifecycleFacts.ts';
import { isAgentPostApprovalVerificationCommand } from '../src/agent/runtime/agentCommandEvidencePredicates.ts';
import { type AgentRuntimeToolResultEntry } from '../src/agent/runtime/agentRuntimeContract.ts';

function dispatchedInput(target: string): AgentRuntimeToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: { action: 'click', sourceQuery: target },
        name: 'execute_desktop_input',
      },
    },
    result: {
      ok: true,
      receipt: { status: 'success' },
      stateSummary: { actionEvidence: { outcome: 'changed' } },
    },
  };
}

function verification(target: string): AgentRuntimeToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {
          action: 'summarize_visual_snapshot',
          query: target,
          question: 'AgentRuntime post-action verification inspect current state.',
        },
        name: 'execute_desktop_observation',
      },
    },
    result: {
      assessment: { evidence: ['target visible'], status: 'completed', summary: 'verified' },
      ok: true,
      receipt: { status: 'success' },
      stateSummary: {
        structuredEvidence: { postActionState: 'launched' },
        verificationEvidence: ['target visible'],
      },
    },
  };
}

function targetlessVerification(): AgentRuntimeToolResultEntry {
  const entry = verification('Example App');
  const input = entry.command.toolCall!.input;
  delete input.query;
  return entry;
}

function outerDispatch(target: string): AgentRuntimeToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: { action: 'focus_window', query: target },
        name: 'execute_desktop_action',
      },
    },
    result: {
      ok: true,
      receipt: { status: 'success' },
      stateSummary: { actionEvidence: { outcome: 'changed' } },
    },
  };
}

function failedInput(target: string): AgentRuntimeToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: { action: 'click', sourceQuery: target },
        name: 'execute_desktop_input',
      },
    },
    result: {
      errorText: 'input backend rejected the attempt',
      ok: false,
      receipt: { status: 'blocked' },
    },
  };
}

const unrelated = collectAgentRuntimeLifecycleFacts({
  entries: [dispatchedInput('Example App A'), verification('Example App B')],
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
});
assert.deepEqual(
  unrelated.map((fact) => fact.kind),
  ['action-dispatched'],
  'verification for a different semantic target must not verify the latest input dispatch',
);

const related = collectAgentRuntimeLifecycleFacts({
  entries: [dispatchedInput('Example App A'), verification('Example App A')],
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
});
assert.deepEqual(related.map((fact) => fact.kind), ['action-dispatched', 'outcome-verified']);
assert.equal(related[0]?.target, 'Example App A');
assert.equal(related[1]?.target, 'Example App A');

const missingVerificationTarget = collectAgentRuntimeLifecycleFacts({
  entries: [dispatchedInput('Example App A'), targetlessVerification()],
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
});
assert.deepEqual(
  missingVerificationTarget.map((fact) => fact.kind),
  ['action-dispatched'],
  'a targeted dispatch requires a verification command that retains compatible target semantics',
);

const supersededByOuterDispatch = collectAgentRuntimeLifecycleFacts({
  entries: [
    dispatchedInput('Example App A'),
    outerDispatch('Example App B'),
    verification('Example App A'),
  ],
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
});
assert.deepEqual(
  supersededByOuterDispatch.map((fact) => fact.kind),
  ['action-dispatched', 'outer-dispatch'],
  'an outer desktop dispatch must invalidate older input context before later verification',
);

const supersededByFailedInput = collectAgentRuntimeLifecycleFacts({
  entries: [
    dispatchedInput('Example App A'),
    failedInput('Example App B'),
    verification('Example App A'),
  ],
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
});
assert.deepEqual(
  supersededByFailedInput.map((fact) => fact.kind),
  ['action-dispatched'],
  'a later failed input attempt must invalidate older input context before later verification',
);

console.log('agent production lifecycle facts smoke ok');
