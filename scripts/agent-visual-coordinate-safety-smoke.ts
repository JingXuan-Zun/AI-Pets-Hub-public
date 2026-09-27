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

const sourceResponses = [
  [
    {
      height: 900,
      id: 'window:launcher-no-bounds',
      name: 'Launcher',
      thumbnail: 'data:image/png;base64,aGVsbG8=',
      type: 'window',
      width: 1440,
    },
  ],
  [
    {
      bounds: {
        height: 900,
        width: 1440,
        x: 100,
        y: 50,
      },
      height: 900,
      id: 'window:launcher-with-bounds',
      name: 'Launcher',
      thumbnail: 'data:image/png;base64,aGVsbG8=',
      type: 'window',
      width: 1440,
    },
  ],
  [
    {
      bounds: {
        height: 670,
        width: 1191,
        x: 684,
        y: 355,
      },
      height: 670,
      id: 'window:wegame-login',
      name: 'WeGame',
      thumbnail: 'data:image/png;base64,aGVsbG8=',
      type: 'window',
      width: 1191,
    },
  ],
];

const visualResponses = [
  {
  bounds: {
    coordinateSpace: 'source-ratio',
    height: 0.04,
    width: 0.05,
    x: 0.8,
    y: 0.7,
  },
  confidence: 0.86,
  primaryAction: 'Start',
  relation: 'Start belongs to Example Game',
  summary: 'Launcher shows Example Game and a Start button.',
  targetMatched: 'Example Game',
  visibleAppOrWindow: 'Launcher',
  },
  {
    bounds: {
      coordinateSpace: 'source-ratio',
      height: 0.04,
      width: 0.05,
      x: 0.8,
      y: 0.7,
    },
    confidence: 0.86,
    primaryAction: 'Start',
    relation: 'Start belongs to Example Game',
    summary: 'Launcher shows Example Game and a Start button.',
    targetMatched: 'Example Game',
    visibleAppOrWindow: 'Launcher',
  },
  {
    bounds: {
      coordinateSpace: 'source-ratio',
      height: 0.08,
      width: 0.25,
      x: 0.375,
      y: 0.67,
    },
    confidence: 0.95,
    elementCenter: {
      x: 596,
      y: 476,
    },
    elementCenterRatio: {
      x: 0.5,
      y: 0.71,
    },
    primaryAction: 'Click quick safe login',
    relation: 'The quick safe login button is the main login action.',
    summary: 'WeGame login page shows a quick safe login button.',
    targetMatched: 'Quick safe login',
    visibleAppOrWindow: 'WeGame',
  },
];

(desktopPetShellRuntime as any).listCaptureSources = async () => {
  const response = sourceResponses.shift();
  assert.ok(response, 'expected a queued capture source response');
  return response;
};

globalThis.fetch = (async () => {
  const visualResponse = visualResponses.shift();
  assert.ok(visualResponse, 'expected a queued visual response');
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify(visualResponse),
        },
      },
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

try {
  const noBoundsResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(noBoundsResult.ok, true);
  assert.equal(noBoundsResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(noBoundsResult.stateSummary?.structuredEvidence?.primaryAction, 'Start');
  assert.equal(noBoundsResult.stateSummary?.structuredEvidence?.elementCenter, null);
  assert.equal(noBoundsResult.stateSummary?.structuredEvidence?.elementCenterRatio?.x, 0.825);
  assert.equal(noBoundsResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'needs-coordinate');
  assert.match(noBoundsResult.stateSummary?.missingEvidence?.join('\n') ?? '', /only relative\/approximate location/u);

  const withBoundsResult = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  assert.equal(withBoundsResult.ok, true);
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.primaryAction, 'Start');
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.elementCenter?.x, 1288);
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.elementCenter?.y, 698);
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.elementBounds?.x, 1252);
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.elementBounds?.y, 680);
  assert.equal(withBoundsResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');

  const wegameLoginResult = await executeAgentChatCommand({
    ...createLocateCommand(),
    instruction: 'locate WeGame quick safe login button',
    toolCall: {
      ...createLocateCommand().toolCall,
      goal: 'locate WeGame quick safe login button',
      input: {
        action: 'locate_element',
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetDescription: 'WeGame quick safe login button',
        targetText: 'login',
      },
      name: 'locate_screen_elements',
    },
  }, createRuntimeContext(settings));
  assert.equal(wegameLoginResult.ok, true);
  assert.equal(wegameLoginResult.stateSummary?.structuredEvidence?.targetMatched, 'Quick safe login');
  assert.equal(wegameLoginResult.stateSummary?.structuredEvidence?.elementCenter?.x, 1280);
  assert.equal(wegameLoginResult.stateSummary?.structuredEvidence?.elementCenter?.y, 831);
  assert.equal(wegameLoginResult.stateSummary?.structuredEvidence?.elementCenter?.source, 'elementCenterRatio');
  assert.equal(wegameLoginResult.stateSummary?.structuredEvidence?.coordinateAuditStatus, 'coordinate_ok');
  assert.match(wegameLoginResult.responseText, /Visual coordinate audit: status=coordinate_ok/u);
  assert.doesNotMatch(wegameLoginResult.responseText, /coordinate_out_of_bounds/u);
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  (globalThis as any).Image = originalImage;
  (globalThis as any).document = originalDocument;
}

console.log('agent visual coordinate safety smoke ok');
