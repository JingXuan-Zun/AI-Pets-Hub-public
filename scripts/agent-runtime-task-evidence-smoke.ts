import assert from 'node:assert/strict';

import { appendAgentRuntimeToolEvidence } from '../src/agent/runtime/agentRuntimeTaskEvidence';
import { transitionAgentTaskRuntimeState } from '../src/agent/runtime/agentTaskRuntime';

const state = transitionAgentTaskRuntimeState({
  event: { phase: 'collecting_evidence', type: 'progress' },
  now: 100,
  sourceText: 'interact with an application',
  userGoal: 'Interact with an application',
});

const enriched = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-action',
      instruction: 'click target',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: {
        input: { action: 'click' },
        name: 'execute_desktop_input',
      },
    },
    result: {
      assessment: {
        evidence: ['visible state changed'],
        status: 'completed',
        summary: 'Target changed after input.',
      },
      ok: true,
      responseText: 'Input dispatched.',
      stateSummary: {
        actionEvidence: {
          action: 'click',
          confidence: 0.9,
          diff: { changed: true, summary: 'Target state changed.' },
          outcome: 'changed',
          targetRef: { confidence: 'high', kind: 'uia-control', label: 'Continue' },
          timestamp: 120,
          tool: 'execute_desktop_input',
        },
        structuredEvidence: {
          appExecutionProfile: 'unknown',
          captureAvailable: true,
          desktopTargetPresence: 'present_interactable',
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          interactionReady: true,
          windowPresent: true,
        },
        verificationEvidence: ['Target state changed after input.'],
      },
      verification: 'Target state changed after input.',
    },
    timing: {
      durationMs: 10,
      endedAt: 130,
      id: 'tool-call-1',
      kind: 'tool',
      label: 'execute_desktop_input',
      startedAt: 120,
      status: 'success',
      stepIndex: 1,
    },
  }],
  now: 130,
  state,
});

assert.equal(enriched.surface?.presence, 'present_interactable');
assert.equal(enriched.surface?.profile, 'unknown');
assert.equal(enriched.surface?.owner.hwnd, 42);
assert.equal(enriched.evidence?.length, 1);
assert.equal(enriched.evidence?.[0]?.surfaceGeneration, enriched.surface?.generation);
assert.equal(enriched.targetBinding?.surfaceId, enriched.surface?.surfaceId);
assert.equal(enriched.targetBinding?.surfaceGeneration, enriched.surface?.generation);
assert.equal(enriched.completedActions?.length, 1);
assert.equal(enriched.completedActions?.[0]?.status, 'executed');
assert.equal(enriched.completedActions?.[0]?.toolCallId, 'tool-call-1');
assert.equal(enriched.verification?.status, 'verified_success');

const reprocessed = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-action',
      instruction: 'click target',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: {
        input: { action: 'click' },
        name: 'execute_desktop_input',
      },
    },
    result: {
      assessment: {
        evidence: ['visible state changed'],
        status: 'completed',
        summary: 'Target changed after input.',
      },
      ok: true,
      responseText: 'Input dispatched.',
      stateSummary: {
        actionEvidence: {
          action: 'click',
          confidence: 0.9,
          diff: { changed: true, summary: 'Target state changed.' },
          outcome: 'changed',
          targetRef: { confidence: 'high', kind: 'uia-control', label: 'Continue' },
          timestamp: 120,
          tool: 'execute_desktop_input',
        },
        structuredEvidence: {
          appExecutionProfile: 'unknown',
          captureAvailable: true,
          desktopTargetPresence: 'present_interactable',
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          interactionReady: true,
          windowPresent: true,
        },
        verificationEvidence: ['Target state changed after input.'],
      },
      verification: 'Target state changed after input.',
    },
    timing: {
      durationMs: 10,
      endedAt: 130,
      id: 'tool-call-1',
      kind: 'tool',
      label: 'execute_desktop_input',
      startedAt: 120,
      status: 'success',
      stepIndex: 1,
    },
  }],
  now: 130,
  state: enriched,
});
assert.equal(reprocessed.surface?.generation, enriched.surface?.generation);
assert.equal(reprocessed.evidence?.length, enriched.evidence?.length);
assert.equal(reprocessed.completedActions?.length, enriched.completedActions?.length);

const deduped = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Covered duplicate observation',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { action: 'get_active_window_info' }, name: 'execute_desktop_observation' },
    },
    result: {
      ok: true,
      responseText: 'Covered by aggregate observation.',
      stateSummary: {
        structuredEvidence: {
          finalWindow: { hwnd: 999, pid: 999, processName: 'unrelated-app', title: 'Unrelated App' },
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 0,
      id: 'deduped-observation',
      kind: 'tool',
      label: 'execute_desktop_observation',
      startedAt: 140,
      status: 'deduped',
      stepIndex: 2,
    },
  }],
  now: 140,
  state: enriched,
});
assert.equal(deduped.evidence?.length, enriched.evidence?.length, 'deduped coverage must not add duplicate evidence');
assert.equal(deduped.completedActions?.length, enriched.completedActions?.length, 'deduped coverage must not add an action receipt');
assert.equal(deduped.surface?.owner.hwnd, enriched.surface?.owner.hwnd, 'deduped coverage must not replace the live surface');

const secondAction = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-action',
      instruction: 'click another target',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: {
        input: { action: 'click', x: 99, y: 101 },
        name: 'execute_desktop_input',
      },
    },
    result: {
      ok: true,
      responseText: 'Second input dispatched.',
      stateSummary: {
        actionEvidence: {
          action: 'click',
          outcome: 'changed',
          timestamp: 120,
          tool: 'execute_desktop_input',
        },
      },
    },
    timing: {
      durationMs: 10,
      endedAt: 130,
      id: 'tool-call-2',
      kind: 'tool',
      label: 'execute_desktop_input',
      startedAt: 120,
      status: 'success',
      stepIndex: 2,
    },
  }],
  now: 130,
  state: enriched,
});
assert.equal(secondAction.evidence?.length, 2, 'different same-time action inputs must not share an evidence ID');
assert.equal(secondAction.completedActions?.length, 2, 'different same-time action inputs must not share an action ID');

const sameInputRetry = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-action',
      instruction: 'retry the same click',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: {
        input: { action: 'click' },
        name: 'execute_desktop_input',
      },
    },
    result: {
      ok: true,
      responseText: 'Same click retry dispatched.',
      stateSummary: {
        actionEvidence: {
          action: 'click',
          outcome: 'changed',
          timestamp: 120,
          tool: 'execute_desktop_input',
        },
      },
    },
    timing: {
      durationMs: 10,
      endedAt: 130,
      id: 'tool-call-3',
      kind: 'tool',
      label: 'execute_desktop_input',
      startedAt: 120,
      status: 'success',
      stepIndex: 3,
    },
  }],
  now: 130,
  state: enriched,
});
assert.equal(sameInputRetry.evidence?.length, 2, 'same-input retries with distinct transaction IDs must remain distinct');
assert.equal(sameInputRetry.completedActions?.length, 2, 'same-input retries must not collapse into one action receipt');

const staleFallback = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe stale fallback',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Different App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      assessment: { evidence: ['fallback'], status: 'completed', summary: 'Fallback snapshot.' },
      ok: true,
      responseText: 'Fallback window snapshot.',
      stateSummary: {
        structuredEvidence: {
          finalWindow: { hwnd: 999, pid: 99, processName: 'different-app', title: 'Different App' },
          observationCapturedAt: 130,
          observationFreshness: 'stale-fallback',
          status: 'success',
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 130,
      id: 'fallback-observation',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 130,
      status: 'success',
      stepIndex: 3,
    },
  }],
  now: 130,
  state: enriched,
});
assert.equal(staleFallback.surface?.owner.hwnd, enriched.surface?.owner.hwnd, 'stale fallback must not replace live surface ownership');
assert.equal(staleFallback.targetBinding?.label, enriched.targetBinding?.label, 'stale fallback must not replace live target binding');
assert.equal(staleFallback.verification?.status, enriched.verification?.status, 'stale fallback must not replace live verification');

function freshSurfaceState(options: {
  hwnd: number;
  pid: number;
  presence: 'absent' | 'present_unreadable' | 'starting';
  timingId: string;
}) {
  return appendAgentRuntimeToolEvidence({
    entries: [{
      command: {
        capabilityId: 'desktop-observation',
        instruction: 'Refresh current application state',
        kind: 'tool-call',
        sourceText: state.sourceText,
        toolCall: {
          input: { forceRefresh: true, query: 'Example App' },
          name: 'observe_windows_and_apps',
        },
      },
      result: {
        assessment: { evidence: ['fresh state'], status: 'can-continue', summary: 'state refreshed' },
        ok: true,
        responseText: 'Fresh application state.',
        stateSummary: {
          structuredEvidence: {
            desktopTargetPresence: options.presence === 'starting'
              ? undefined
              : options.presence,
            finalWindow: {
              hwnd: options.hwnd,
              pid: options.pid,
              processName: 'example-app',
              title: 'Example App',
            },
            processPresent: true,
            windowPresent: options.presence !== 'starting' && options.presence !== 'absent',
          },
        },
      },
      timing: {
        durationMs: 1,
        endedAt: 200 + options.hwnd,
        id: options.timingId,
        kind: 'tool',
        label: 'observe_windows_and_apps',
        startedAt: 199 + options.hwnd,
        status: 'success',
        stepIndex: 4,
      },
    }],
    now: 200 + options.hwnd,
    state: enriched,
  });
}

const absentSurface = freshSurfaceState({
  hwnd: 42,
  pid: 7,
  presence: 'absent',
  timingId: 'absent-surface',
});
assert.equal(absentSurface.surface?.presence, 'absent');
assert.equal(absentSurface.targetBinding, null, 'fresh absent evidence must clear the old target binding');
assert.equal(absentSurface.verification?.status, 'needs_recovery', 'fresh absent evidence must replace old verification with current recovery evidence');

const reappearedSurface = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe the application after it reappeared',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Example App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      ok: true,
      responseText: 'Application reappeared.',
      stateSummary: {
        structuredEvidence: {
          captureAvailable: true,
          desktopTargetPresence: 'present_interactable',
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          interactionReady: true,
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 260,
      id: 'reappeared-surface',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 259,
      status: 'success',
      stepIndex: 5,
    },
  }],
  now: 260,
  state: absentSurface,
});
assert.equal(reappearedSurface.surface?.owner.hwnd, 42);
assert.equal(reappearedSurface.surface?.generation, (absentSurface.surface?.generation ?? 0) + 1, 'a surface that reappears must get a new generation even if HWND/PID are reused');
assert.equal(reappearedSurface.targetBinding, null, 'a reappeared surface must require fresh target resolution');

const unreadableSurface = freshSurfaceState({
  hwnd: 42,
  pid: 7,
  presence: 'present_unreadable',
  timingId: 'unreadable-surface',
});
assert.equal(unreadableSurface.surface?.presence, 'present_unreadable');
assert.equal(unreadableSurface.targetBinding, null, 'fresh unreadable evidence must clear the old target binding');
assert.equal(unreadableSurface.verification?.status, 'needs_recovery', 'fresh unreadable evidence must replace old verification with current recovery evidence');

const rebuiltSurface = freshSurfaceState({
  hwnd: 84,
  pid: 14,
  presence: 'present_unreadable',
  timingId: 'rebuilt-surface',
});
assert.equal(rebuiltSurface.surface?.owner.hwnd, 84);
assert.equal(rebuiltSurface.surface?.generation, (enriched.surface?.generation ?? 0) + 1);
assert.equal(rebuiltSurface.targetBinding, null, 'a rebuilt surface must not inherit the old target binding');
assert.equal(rebuiltSurface.verification?.status, 'needs_recovery');

const startingSurface = freshSurfaceState({
  hwnd: 42,
  pid: 7,
  presence: 'starting',
  timingId: 'starting-surface',
});
assert.equal(startingSurface.surface?.presence, 'starting');
assert.equal(startingSurface.targetBinding, null, 'a starting surface must not inherit the old target binding');
assert.equal(startingSurface.surface?.capabilities.desktopInput, false, 'a starting surface must not advertise desktop input');

const interactableRefresh = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Refresh interactable application state',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Example App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      ok: true,
      responseText: 'Interactable state.',
      stateSummary: {
        structuredEvidence: {
          appExecutionProfile: 'direct_window_app',
          captureAvailable: true,
          desktopTargetPresence: 'present_interactable',
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          interactionReady: true,
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 250,
      id: 'interactable-refresh',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 249,
      status: 'success',
      stepIndex: 5,
    },
  }],
  now: 250,
  state: enriched,
});
assert.equal(interactableRefresh.surface?.capabilities.desktopInput, true);

const profilePreserved = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe the same application again',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Example App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      ok: true,
      responseText: 'Same application state.',
      stateSummary: {
        structuredEvidence: {
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 265,
      id: 'same-surface-profile-refresh',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 264,
      status: 'success',
      stepIndex: 5,
    },
  }],
  now: 265,
  state: interactableRefresh,
});
assert.equal(profilePreserved.surface?.profile, 'direct_window_app', 'an omitted profile on the same surface must not erase the known profile');

const plainWindowObservation = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe the application window',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Example App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      ok: true,
      responseText: 'Application window observed.',
      stateSummary: {
        structuredEvidence: {
          captureAvailable: true,
          finalWindow: { hwnd: 42, pid: 7, processName: 'example-app', title: 'Example App' },
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 275,
      id: 'plain-window-observation',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 274,
      status: 'success',
      stepIndex: 5,
    },
  }],
  now: 275,
  state: interactableRefresh,
});
assert.equal(plainWindowObservation.targetBinding, null, 'window observation alone must not create a control target binding');

const newIdentityWithoutInputEvidence = appendAgentRuntimeToolEvidence({
  entries: [{
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe another application',
      kind: 'tool-call',
      sourceText: state.sourceText,
      toolCall: { input: { query: 'Another App' }, name: 'observe_windows_and_apps' },
    },
    result: {
      ok: true,
      responseText: 'Another application state.',
      stateSummary: {
        structuredEvidence: {
          desktopTargetPresence: 'present_interactable',
          finalWindow: { hwnd: 84, pid: 14, processName: 'another-app', title: 'Another App' },
          windowPresent: true,
        },
      },
    },
    timing: {
      durationMs: 1,
      endedAt: 300,
      id: 'new-identity-refresh',
      kind: 'tool',
      label: 'observe_windows_and_apps',
      startedAt: 299,
      status: 'success',
      stepIndex: 6,
    },
  }],
  now: 300,
  state: interactableRefresh,
});
assert.equal(newIdentityWithoutInputEvidence.surface?.capabilities.desktopInput, false, 'a new identity must not inherit input capability from the previous surface');

console.log('agent runtime task evidence smoke passed');
