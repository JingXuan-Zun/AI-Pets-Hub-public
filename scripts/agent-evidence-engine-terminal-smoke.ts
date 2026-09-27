import assert from 'node:assert/strict';
import {
  evaluateAgentEvidenceTerminal,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

function entry(options: {
  assessmentStatus?: 'can-continue' | 'completed' | 'failed' | 'needs-user' | 'unverified';
  ok?: boolean;
  postActionState?: string;
  receiptStatus?: 'blocked' | 'failed' | 'success' | 'unverified';
  verification?: string;
}): AgentRuntimeToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      sourceText: '/agent evidence smoke',
      toolCall: {
        input: {},
        name: 'execute_desktop_action',
      },
    },
    result: {
      assessment: options.assessmentStatus
        ? {
            evidence: [],
            nextStep: null,
            status: options.assessmentStatus,
            summary: 'Tool-level assessment only',
          }
        : null,
      ok: options.ok ?? true,
      receipt: options.receiptStatus
        ? {
            status: options.receiptStatus,
            summaryLines: [],
            title: 'Evidence smoke receipt',
          }
        : null,
      responseText: 'Evidence smoke result',
      stateSummary: options.postActionState
        ? {
            structuredEvidence: {
              postActionState: options.postActionState,
            },
          }
        : null,
      verification: options.verification ?? null,
    },
  };
}

const verified = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ postActionState: 'launched', receiptStatus: 'success' }),
  readOnlyOnly: false,
});
assert.equal(verified.status, 'completed');
assert.equal(verified.verified, true);

const dispatchedOnly = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ receiptStatus: 'success' }),
  readOnlyOnly: false,
});
assert.equal(dispatchedOnly.status, 'insufficient');
assert.match(dispatchedOnly.reason, /no user-level outcome evidence/u);

const unverified = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ postActionState: 'launched', receiptStatus: 'unverified' }),
  readOnlyOnly: false,
});
assert.equal(unverified.status, 'insufficient');

const noOpAction = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: {
    command: {
      toolCall: { name: 'execute_desktop_input', input: { action: 'click' } },
    },
    result: {
      ok: true,
      receipt: {
        status: 'success',
        stateSummary: {
          actionEvidence: { outcome: 'no-op' },
        },
      },
    },
  },
});
assert.equal(noOpAction.status, 'insufficient');
assert.match(noOpAction.reason, /no verified successful outcome/u);

const noOpWithVerifiedTarget = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: {
    command: {
      toolCall: { name: 'execute_desktop_input', input: { action: 'click' } },
    },
    result: {
      ok: true,
      receipt: {
        status: 'success',
        stateSummary: {
          actionEvidence: { outcome: 'no-op' },
        },
      },
    },
  },
  verifiedTargetState: true,
});
assert.equal(noOpWithVerifiedTarget.status, 'completed');
assert.equal(unverified.verified, false);

const verifiedTargetOutranksGenericAssessment = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ assessmentStatus: 'unverified', receiptStatus: 'success' }),
  readOnlyOnly: false,
  verifiedTargetState: true,
});
assert.equal(verifiedTargetOutranksGenericAssessment.status, 'completed');
assert.equal(verifiedTargetOutranksGenericAssessment.verified, true);

const verifiedTargetCannotOverrideUnverifiedReceipt = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ assessmentStatus: 'unverified', receiptStatus: 'unverified' }),
  readOnlyOnly: false,
  verifiedTargetState: true,
});
assert.equal(verifiedTargetCannotOverrideUnverifiedReceipt.status, 'insufficient');
assert.equal(verifiedTargetCannotOverrideUnverifiedReceipt.verified, false);

const readOnly = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ receiptStatus: 'success' }),
  readOnlyOnly: true,
});
assert.equal(readOnly.status, 'insufficient');

const incomplete = evaluateAgentEvidenceTerminal({
  coverageComplete: false,
  directActionIntent: true,
  latestEntry: entry({ postActionState: 'launched', receiptStatus: 'success' }),
  readOnlyOnly: false,
});
assert.equal(incomplete.status, 'insufficient');

const assessmentOnly = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ assessmentStatus: 'completed' }),
  readOnlyOnly: false,
});
assert.equal(assessmentOnly.status, 'insufficient');
assert.equal(assessmentOnly.verified, false);

const negativeVerificationText = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ verification: 'Target state was not verified.' }),
  readOnlyOnly: false,
});
assert.equal(negativeVerificationText.status, 'insufficient');

const failed = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ ok: false, receiptStatus: 'failed' }),
  readOnlyOnly: false,
});
assert.equal(failed.status, 'needs-user');

const blocked = evaluateAgentEvidenceTerminal({
  coverageComplete: true,
  directActionIntent: true,
  latestEntry: entry({ receiptStatus: 'blocked', verification: 'A modal is visible.' }),
  readOnlyOnly: false,
});
assert.equal(blocked.status, 'needs-user');
assert.equal(blocked.verified, false);

console.log('agent evidence engine terminal smoke ok');
