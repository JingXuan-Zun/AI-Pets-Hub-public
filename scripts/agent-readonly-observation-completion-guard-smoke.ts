import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  createAgentDecisionSummary,
  resolveAgentResultFollowUpActions,
} from '../src/agent/agentResultAssessment';
import type { AgentChatCommand, AgentChatCommandResult } from '../src/agent/agentChatCommand';

const openWeGameCommand: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: '帮我在 WeGame 中打开英雄联盟',
  kind: 'tool-call',
  sourceText: '帮我在 WeGame 中打开英雄联盟',
  toolCall: {
    goal: '帮我在 WeGame 中打开英雄联盟',
    input: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeInstalledApps: true,
      includeRunningApps: true,
      includeTaskbarPinned: true,
      query: 'WeGame',
    },
    name: 'observe_windows_and_apps',
  },
};

const genericObservationResult: AgentChatCommandResult = {
  ok: true,
  observations: [
    'Tool: observe_windows_and_apps',
    'Windows/apps query: WeGame',
    'Running windows: 3',
    'Running 1. Codex pid=26060 hwnd=461648 title="Codex"',
    'Running 2. chrome pid=8600 hwnd=462660 title="Google Chrome"',
    'Running 3. QQ pid=14932 hwnd=197460 title="QQ"',
  ],
  receipt: {
    evidenceLines: [
      'Windows/apps query: WeGame',
      'Running windows: 3',
      'Running 1. Codex pid=26060 hwnd=461648 title="Codex"',
    ],
    status: 'success',
    summaryLines: ['Call: observe_windows_and_apps', 'Running: 3'],
    title: 'Execution receipt',
    toolName: 'observe_windows_and_apps',
    verification: 'Observed current app/window/taskbar/display state through Electron main process services.',
  },
  responseText: 'Observed apps/windows: installed=40, taskbarPinned=13, running=3. Active window: Codex - Codex.',
  stateSummary: {
    observedState: [
      'Windows/apps query: WeGame',
      'Running windows: 3',
      'Running 1. Codex pid=26060 hwnd=461648 title="Codex"',
    ],
    structuredEvidence: {
      finalWindow: {
        processName: 'Codex',
        title: 'Codex',
      },
      status: 'success',
      targetMatched: 'Codex',
    },
    verificationEvidence: [
      'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
    ],
  },
  verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
};

const assessedGenericObservation = assessAgentCommandResult(openWeGameCommand, genericObservationResult);
assert.equal(
  assessedGenericObservation.assessment?.status,
  'unverified',
  'generic observe_windows_and_apps output must not verify a direct open/launch request when the target is not matched',
);
assert.notEqual(
  createAgentDecisionSummary(assessedGenericObservation, resolveAgentResultFollowUpActions(assessedGenericObservation)),
  'Result verified; ready for character reply',
  'unmatched observation must not advance to character reply',
);
assert.ok(
  assessedGenericObservation.stateSummary?.missingEvidence?.some((item) => item.includes('action-completion-evidence')),
  'unmatched observation should expose missing action completion evidence',
);

const matchedObservationResult = assessAgentCommandResult(openWeGameCommand, {
  ...genericObservationResult,
  observations: [
    'Windows/apps query: WeGame',
    'Running windows: 1',
    'Running 1. WeGame pid=1234 hwnd=5678 title="WeGame"',
  ],
  responseText: 'Observed apps/windows: installed=40, taskbarPinned=13, running=1. Running sample: WeGame.',
  stateSummary: {
    observedState: [
      'Windows/apps query: WeGame',
      'Running windows: 1',
      'Running 1. WeGame pid=1234 hwnd=5678 title="WeGame"',
    ],
    structuredEvidence: {
      finalWindow: {
        processName: 'WeGame',
        title: 'WeGame',
      },
      status: 'success',
      targetCandidates: [{
        confidence: 'high',
        label: 'WeGame',
        source: 'observe_windows_and_apps',
        window: {
          processName: 'WeGame',
          title: 'WeGame',
        },
      }],
      targetMatched: 'WeGame',
    },
    verificationEvidence: [
      'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
    ],
  },
});

assert.equal(
  matchedObservationResult.assessment?.status,
  'completed',
  'target-matched observation may verify the launch/open precondition',
);

console.log('agent readonly observation completion guard smoke ok');
