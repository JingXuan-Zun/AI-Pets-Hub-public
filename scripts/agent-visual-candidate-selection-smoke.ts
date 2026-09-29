import assert from 'node:assert/strict';
import {
  executeAgentChatCommand,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';

function createRuntimeContext(settings: PetConfig['settings']) {
  return {
    configRef: { current: { settings } },
    desktopOrganizationRef: { current: null },
    lastDesktopOrganizationPlanRef: { current: null },
    lastLocalProjectInspectionRef: { current: null },
    onUpdateConfig: () => undefined,
    startDesktopIconPlacementRef: { current: null },
    voiceInputControllerRef: { current: null },
  } as any;
}

function createLocateCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'locate Example Game Start button',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'locate Example Game Start button',
      input: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game Start button',
      },
      name: 'locate_screen_elements',
    },
  };
}

const settings = {
  customApiKey: 'chat-key',
  customApiUrl: 'https://chat.example.com/v1',
  customModelCapabilities: {
    image: false,
    reasoning: false,
    text: true,
    tools: false,
  },
  customModelName: 'chat-model',
  customModelRequestParams: [],
  llmModel: 'gemini-1.5-flash',
  llmProvider: 'gemini',
  visionCustomApiKey: 'vision-key',
  visionCustomApiUrl: 'https://vision.example.com/v1',
  visionCustomModelName: 'vision-model',
  visionCustomModelRequestParams: [],
  visionModelProvider: 'openai',
} as PetConfig['settings'];

const originalFetch = globalThis.fetch;
const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
const originalImage = (globalThis as any).Image;
const originalDocument = (globalThis as any).document;
const visionResponses: unknown[] = [
  {
    actionCandidates: [
      {
        centerRatio: { x: 0.88, y: 0.94 },
        confidence: 'high',
        label: '启动',
        relation: '启动 button belongs to Example Game current detail panel.',
      },
    ],
    confidence: 0.9,
    elementCenterRatio: { x: 0.46, y: 0.5 },
    primaryAction: '启动',
    relation: '启动 button belongs to Example Game current detail panel.',
    summary: 'Launcher shows Example Game, but the main action button is at the lower right.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
  {
    actionCandidates: [
      {
        bounds: {
          coordinateSpace: 'source-ratio',
          height: 0.34,
          width: 0.42,
          x: 0.31,
          y: 0.42,
        },
        confidence: 'high',
        label: '启动',
        relation: 'Large content card mentions starting Example Game.',
      },
      {
        bounds: {
          coordinateSpace: 'source-ratio',
          height: 0.06,
          width: 0.18,
          x: 0.79,
          y: 0.91,
        },
        confidence: 'high',
        label: '启动',
        relation: '启动 button belongs to Example Game current detail panel.',
      },
    ],
    confidence: 0.9,
    primaryAction: '启动',
    relation: '启动 button belongs to Example Game current detail panel.',
    summary: 'Launcher shows a large content card and a compact lower-right launch button.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
  {
    actionCandidates: [
      {
        centerRatio: { x: 0.25, y: 0.76 },
        confidence: 'high',
        label: 'News',
        relation: 'News card is unrelated to Example Game',
      },
      {
        centerRatio: { x: 0.82, y: 0.76 },
        confidence: 'medium',
        label: 'Start',
        relation: 'Start belongs to Example Game',
      },
    ],
    confidence: 0.82,
    summary: 'Launcher shows Example Game and a nearby Start button.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
  {
    actionCandidates: [
      {
        centerRatio: { x: 0.42, y: 0.76 },
        confidence: 'high',
        label: 'Start',
        relation: 'Start button is near a visible game tile',
      },
      {
        centerRatio: { x: 0.62, y: 0.76 },
        confidence: 'high',
        label: 'Start',
        relation: 'Start button is near a visible game tile',
      },
    ],
    confidence: 0.82,
    summary: 'Launcher shows Example Game and two similar Start buttons.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
  {
    actionCandidates: [
      {
        centerRatio: { x: 0.82, y: 0.76 },
        confidence: 'high',
        label: 'Start',
        relation: 'Start belongs to the current detail panel, but the current detail panel is Another Game.',
      },
    ],
    confidence: 0.86,
    currentSelection: 'Another Game',
    selectionEvidence: [
      'Example Game is visible in the list.',
      'The detail title still shows Another Game.',
    ],
    selectionVerificationStatus: 'mismatch',
    summary: 'Launcher shows Example Game in a list, but Another Game is still selected in the detail panel.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
];

function createMockUiImageData(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const accent = (x * 7 + y * 11) % 160;
      data[offset] = 38 + (accent % 80);
      data[offset + 1] = 48 + ((accent + x) % 90);
      data[offset + 2] = 62 + ((accent + y) % 100);
      data[offset + 3] = 255;
    }
  }
  return data;
}

(globalThis as any).Image = class MockImage {
  height = 900;
  naturalHeight = 900;
  naturalWidth = 1440;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  width = 1440;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
};

(globalThis as any).document = {
  createElement: () => ({
    height: 1,
    getContext: () => ({
      drawImage: () => undefined,
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: createMockUiImageData(width, height),
      }),
    }),
    toDataURL: () => 'data:image/png;base64,mock',
    width: 1,
  }),
};

(desktopPetShellRuntime as any).listCaptureSources = async () => [
  {
    bounds: {
      height: 900,
      width: 1440,
      x: 100,
      y: 50,
    },
    height: 900,
    id: 'window:launcher',
    name: 'Launcher',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'window',
    width: 1440,
  },
];

globalThis.fetch = (async () => {
  const response = visionResponses.shift();
  assert.ok(response, 'expected a queued vision response');

  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify(response),
        },
      },
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

try {
  const actionCandidateOverridesTopLevelPointResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(actionCandidateOverridesTopLevelPointResult.ok, true);
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.primaryAction, '启动');
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.launcherVerification?.status, 'ready');
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.launcherVerification?.primaryActionMatchesTarget, true);
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.elementCenter?.x, 1367);
  assert.equal(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.elementCenter?.y, 896);
  assert.notEqual(actionCandidateOverridesTopLevelPointResult.stateSummary?.structuredEvidence?.elementCenter?.x, 762);

  const compactButtonBeatsLargeCardResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(compactButtonBeatsLargeCardResult.ok, true);
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.primaryAction, '启动');
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.elementCenterRatio?.x, 0.88);
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.elementCenterRatio?.y, 0.94);
  assert.ok(
    Math.abs(Number(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.elementCenter?.x) - 1367) <= 1,
    'compact launch button x should be selected instead of the large content card',
  );
  assert.equal(compactButtonBeatsLargeCardResult.stateSummary?.structuredEvidence?.elementCenter?.y, 896);

  const decisiveResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(decisiveResult.ok, true);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.primaryAction, 'Start');
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.launcherVerification?.status, 'ready');
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.launcherVerification?.targetVisible, true);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.launcherVerification?.targetSelected, true);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.launcherVerification?.detailMatchesTarget, true);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.launcherVerification?.primaryActionMatchesTarget, true);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.elementCenter?.x, 1281);
  assert.equal(decisiveResult.stateSummary?.structuredEvidence?.elementCenter?.y, 734);
  assert.match(decisiveResult.observations?.join('\n') ?? '', /Visual primary action: Start/u);

  const ambiguousResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(ambiguousResult.ok, true);
  assert.equal(ambiguousResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(Boolean(ambiguousResult.stateSummary?.structuredEvidence?.primaryAction), false);
  assert.equal(ambiguousResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'needs-primary-action');
  assert.equal(ambiguousResult.stateSummary?.structuredEvidence?.launcherVerification?.status, 'needs-primary-action');
  assert.equal(ambiguousResult.stateSummary?.structuredEvidence?.launcherVerification?.primaryActionMatchesTarget, null);
  assert.match(ambiguousResult.stateSummary?.missingEvidence?.join('\n') ?? '', /no single primary/u);

  const mismatchResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(mismatchResult.ok, true);
  assert.equal(mismatchResult.receipt?.status, 'unverified');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.currentSelection, 'Another Game');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.selectionVerificationStatus, 'mismatch');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'needs-target-selection');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.launcherVerification?.status, 'needs-target-selection');
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.launcherVerification?.targetVisible, true);
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.launcherVerification?.targetSelected, false);
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.launcherVerification?.detailMatchesTarget, false);
  assert.equal(mismatchResult.stateSummary?.structuredEvidence?.launcherVerification?.primaryActionMatchesTarget, false);
  assert.match(mismatchResult.stateSummary?.missingEvidence?.join('\n') ?? '', /current selected\/detail item does not match/u);
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  (globalThis as any).Image = originalImage;
  (globalThis as any).document = originalDocument;
}

console.log('agent visual candidate selection smoke ok');
