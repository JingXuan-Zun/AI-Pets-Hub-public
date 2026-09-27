import assert from 'node:assert/strict';
import { executeInspectWindowUi } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { type AgentToolCallCommand } from '../src/agent/index.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

const originalInspectWindowUi = desktopPetShellRuntime.inspectWindowUi;

try {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = async (request: Record<string, unknown>) => {
    assert.equal(request.query, 'Launcher');
    assert.equal(request.targetText, 'Example Game');
    assert.equal(request.maxDepth, 6);

    return {
      controlCount: 3,
      controls: [
        {
          actions: [],
          automationId: 'root',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 720,
            source: 'ui-automation',
            width: 1280,
            x: 100,
            y: 80,
          },
          centerX: 740,
          centerY: 440,
          controlType: 'Window',
          depth: 0,
          enabled: true,
          index: 0,
          matchScore: 0,
          name: 'Launcher',
        },
        {
          actions: ['invoke'],
          automationId: 'game-launch',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 48,
            source: 'ui-automation',
            width: 180,
            x: 740,
            y: 540,
          },
          centerX: 830,
          centerY: 564,
          controlType: 'Button',
          depth: 3,
          enabled: true,
          hasKeyboardFocus: true,
          index: 1,
          keyboardFocusable: true,
          matchScore: 100,
          name: 'Example Game',
          offscreen: false,
        },
        {
          actions: ['invoke'],
          automationId: 'settings',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 36,
            source: 'ui-automation',
            width: 120,
            x: 180,
            y: 120,
          },
          centerX: 240,
          centerY: 138,
          controlType: 'Button',
          depth: 2,
          enabled: true,
          index: 2,
          matchScore: 0,
          name: 'Settings',
        },
      ],
      matchedControls: [
        {
          actions: ['invoke'],
          automationId: 'game-launch',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 48,
            source: 'ui-automation',
            width: 180,
            x: 740,
            y: 540,
          },
          centerX: 830,
          centerY: 564,
          controlType: 'Button',
          depth: 3,
          enabled: true,
          hasKeyboardFocus: true,
          index: 1,
          keyboardFocusable: true,
          matchScore: 100,
          name: 'Example Game',
          offscreen: false,
        },
      ],
      ok: true,
      query: 'Launcher',
      targetText: 'Example Game',
      window: {
        hwnd: 1234,
        processName: 'Launcher',
        title: 'Launcher',
      },
    };
  };

  const result = await executeInspectWindowUi({
    capabilityId: 'desktop-observation',
    goal: 'inspect Launcher controls',
    input: {
      action: 'inspect_window_ui',
      maxDepth: 6,
      query: 'Launcher',
      targetText: 'Example Game',
    },
    name: 'execute_desktop_observation',
  } satisfies AgentToolCallCommand);

  assert.equal(result.ok, true);
  assert.match(result.responseText, /controls=3/u);
  assert.equal(result.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(result.stateSummary?.structuredEvidence?.launcherVerification?.status, 'ready');
  assert.equal(result.stateSummary?.structuredEvidence?.launcherVerification?.primaryActionMatchesTarget, true);
  assert.equal(result.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(result.stateSummary?.structuredEvidence?.primaryAction, 'Example Game id=game-launch type=Button');
  assert.equal(result.stateSummary?.structuredEvidence?.elementCenter?.x, 830);
  assert.equal(result.stateSummary?.structuredEvidence?.elementCenter?.y, 564);
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.center?.x, 830);
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.enabled, true);
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.hasKeyboardFocus, true);
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.keyboardFocusable, true);
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.offscreen, false);
  assert.match(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.description ?? '', /keyboardFocusable=true/u);
} finally {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = originalInspectWindowUi;
}

console.log('agent runtime window ui inspection smoke ok');
