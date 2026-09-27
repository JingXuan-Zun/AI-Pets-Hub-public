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
    instruction: 'locate Example Game tiny Start button',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'locate Example Game tiny Start button',
      input: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game tiny Start button',
      },
      name: 'locate_screen_elements',
    },
  };
}

const originalFetch = globalThis.fetch;
const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
const originalImage = (globalThis as any).Image;
const originalDocument = (globalThis as any).document;
const fetchBodies: any[] = [];

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
      x: 0,
      y: 0,
    },
    height: 900,
    id: 'window:launcher',
    name: 'Launcher',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'window',
    width: 1440,
  },
];

globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  fetchBodies.push(body);

  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            actionCandidates: [
              {
                centerRatio: { x: 0.82, y: 0.76 },
                confidence: 'high',
                label: 'Start',
                region: 'lower right button',
                relation: 'Start belongs to Example Game',
              },
            ],
            confidence: 0.78,
            mainContent: 'Launcher library view with a small game tile and action button.',
            primaryAction: 'Start',
            readableText: [
              'Library',
            ],
            relation: 'Start belongs to Example Game',
            summary: 'Launcher shows Example Game with a Start button.',
            targetCandidates: [
              {
                centerRatio: { x: 0.62, y: 0.7 },
                confidence: 'medium',
                label: 'Example Game',
                region: 'small library tile',
              },
            ],
            targetMatched: 'Example Game',
            visibleAppOrWindow: 'Launcher',
            visibleTextCandidates: [
              {
                confidence: 'medium',
                region: 'small library tile',
                text: 'Example Game',
              },
              {
                confidence: 'high',
                region: 'lower right button',
                text: 'Start',
              },
            ],
          }),
        },
      },
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

try {
  const result = await executeAgentChatCommand(createLocateCommand(), createRuntimeContext({
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
  } as PetConfig['settings']));

  const promptText = fetchBodies[0]?.messages?.[1]?.content?.[0]?.text ?? '';
  assert.match(promptText, /OCR-style pass/u);
  assert.match(promptText, /visibleTextCandidates/u);
  assert.match(promptText, /centerRatio or bounds/u);
  assert.equal(result.ok, true);
  assert.match(result.observations?.join('\n') ?? '', /Visual text candidates: Example Game \(confidence=medium, small library tile\) \| Start \(confidence=high, lower right button\)/u);
  assert.match(result.observations?.join('\n') ?? '', /Visual action candidate 1: Start/u);
  assert.deepEqual(result.stateSummary?.structuredEvidence?.visibleTextCandidates, [
    'Example Game (confidence=medium, small library tile)',
    'Start (confidence=high, lower right button)',
  ]);
  assert.equal(result.stateSummary?.structuredEvidence?.targetMatched, 'Example Game');
  assert.equal(result.stateSummary?.structuredEvidence?.primaryAction, 'Start');
  assert.equal(result.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  (globalThis as any).Image = originalImage;
  (globalThis as any).document = originalDocument;
}

console.log('agent visual ocr candidates smoke ok');
