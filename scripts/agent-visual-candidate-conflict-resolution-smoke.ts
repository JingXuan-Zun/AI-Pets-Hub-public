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
    instruction: 'locate the Start button that belongs to Example Game',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'locate the Start button that belongs to Example Game',
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

globalThis.fetch = (async () => new Response(JSON.stringify({
  choices: [
    {
      message: {
        content: JSON.stringify({
          actionCandidates: [
            {
              centerRatio: { x: 0.78, y: 0.26 },
              confidence: 'high',
              label: 'Start',
              relation: 'Start button is in the same row as Other Game',
            },
            {
              centerRatio: { x: 0.78, y: 0.66 },
              confidence: 'medium',
              label: 'Start',
              relation: 'Start button is in the same row as Example Game',
            },
          ],
          confidence: 0.82,
          summary: 'Launcher shows two game rows. Other Game is on top and Example Game is below. Each row has a Start button.',
          targetCandidates: [
            {
              centerRatio: { x: 0.26, y: 0.26 },
              confidence: 'high',
              label: 'Other Game',
              region: 'top row',
            },
            {
              centerRatio: { x: 0.26, y: 0.66 },
              confidence: 'medium',
              label: 'Example Game',
              region: 'bottom row',
            },
          ],
          visibleAppOrWindow: 'Launcher',
        }),
      },
    },
  ],
}), {
  headers: { 'Content-Type': 'application/json' },
  status: 200,
})) as typeof fetch;

try {
  const result = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext(settings));
  const evidence = result.stateSummary?.structuredEvidence;

  assert.equal(result.ok, true);
  assert.equal(evidence?.targetMatched, 'Example Game');
  assert.equal(evidence?.primaryAction, 'Start');
  assert.equal(evidence?.visualActionReadiness, 'ready');
  assert.equal(evidence?.relation, 'Start button is in the same row as Example Game');
  assert.equal(evidence?.elementCenter?.x, 1223);
  assert.equal(evidence?.elementCenter?.y, 644);
  assert.match(result.observations?.join('\n') ?? '', /Visual target\/action relation: Start button is in the same row as Example Game/u);
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  (globalThis as any).Image = originalImage;
  (globalThis as any).document = originalDocument;
}

console.log('agent visual candidate conflict resolution smoke ok');
