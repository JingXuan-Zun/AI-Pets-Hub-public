import assert from 'node:assert/strict';
import { executeInspectWindowUi } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { type AgentToolCallCommand } from '../src/agent/index.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

const originalInspectWindowUi = desktopPetShellRuntime.inspectWindowUi;

try {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = async (request: Record<string, unknown>) => {
    assert.equal(request.query, 'Launcher');
    assert.equal(request.targetText, 'Example Game');

    return {
      controlCount: 5,
      controls: [
        {
          actions: [],
          automationId: 'game-title',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 36,
            source: 'ui-automation',
            width: 210,
            x: 1160,
            y: 780,
          },
          centerX: 1265,
          centerY: 798,
          controlType: 'Text',
          depth: 5,
          enabled: true,
          index: 1,
          matchScore: 100,
          name: 'Example Game',
          offscreen: false,
        },
        {
          actions: ['invoke'],
          automationId: 'primary-start',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 52,
            source: 'ui-automation',
            width: 180,
            x: 1210,
            y: 868,
          },
          centerX: 1300,
          centerY: 894,
          controlType: 'Button',
          depth: 5,
          enabled: true,
          index: 2,
          keyboardFocusable: true,
          matchScore: 0,
          name: 'Start',
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
          index: 3,
          matchScore: 0,
          name: 'Settings',
          offscreen: false,
        },
        {
          actions: ['invoke'],
          automationId: 'help',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 32,
            source: 'ui-automation',
            width: 80,
            x: 1640,
            y: 120,
          },
          centerX: 1680,
          centerY: 136,
          controlType: 'Button',
          depth: 2,
          enabled: true,
          index: 4,
          matchScore: 0,
          name: 'Help',
          offscreen: false,
        },
      ],
      matchedControls: [
        {
          actions: [],
          automationId: 'game-title',
          bounds: {
            coordinateSpace: 'native-screen',
            height: 36,
            source: 'ui-automation',
            width: 210,
            x: 1160,
            y: 780,
          },
          centerX: 1265,
          centerY: 798,
          controlType: 'Text',
          depth: 5,
          enabled: true,
          index: 1,
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
      maxDepth: 8,
      query: 'Launcher',
      targetText: 'Example Game',
    },
    name: 'execute_desktop_observation',
  } satisfies AgentToolCallCommand);

  assert.equal(result.ok, true);
  assert.equal(result.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(result.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(result.stateSummary?.structuredEvidence?.primaryAction, 'Start id=primary-start type=Button');
  assert.equal(result.stateSummary?.structuredEvidence?.elementCenter?.x, 1300);
  assert.equal(result.stateSummary?.structuredEvidence?.elementCenter?.y, 894);
  assert.match(result.stateSummary?.structuredEvidence?.relation ?? '', /matched the requested target as a non-action control/u);
  assert.equal(result.stateSummary?.structuredEvidence?.targetCandidates?.[0]?.controlType, 'Text');
  assert.equal(result.stateSummary?.structuredEvidence?.actionCandidates?.[0]?.automationId, 'primary-start');
} finally {
  (desktopPetShellRuntime as { inspectWindowUi?: unknown }).inspectWindowUi = originalInspectWindowUi;
}

console.log('agent runtime window ui associated action smoke ok');
