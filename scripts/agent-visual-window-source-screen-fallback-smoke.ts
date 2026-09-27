import assert from 'node:assert/strict';
import { executeAgentChatCommand, type AgentChatCommand } from '../src/agent/index.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';

const originalFetch = globalThis.fetch;
const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
const originalImage = (globalThis as any).Image;
const originalDocument = (globalThis as any).document;

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
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            data[offset] = 40 + ((x * 7 + y * 3) % 180);
            data[offset + 1] = 50 + ((x * 5 + y * 11) % 170);
            data[offset + 2] = 60 + ((x * 13 + y * 2) % 160);
            data[offset + 3] = 255;
          }
        }
        return { data };
      },
    }),
    toDataURL: () => 'data:image/png;base64,mock',
    width: 1,
  }),
};

function createRuntimeContext() {
  return {
    configRef: {
      current: {
        settings: {
          customApiKey: 'vision-key',
          customApiUrl: 'https://vision.example.com/v1',
          customModelCapabilities: {
            image: true,
            reasoning: false,
            text: true,
            tools: false,
          },
          customModelName: 'vision-model',
          llmProvider: 'openai',
        } satisfies PetConfig['settings'],
      },
    },
    desktopOrganizationRef: { current: null },
    lastDesktopOrganizationPlanRef: { current: null },
    lastLocalProjectInspectionRef: { current: null },
    onUpdateConfig: () => undefined,
    startDesktopIconPlacementRef: { current: null },
    voiceInputControllerRef: { current: null },
  } as any;
}

function createLocateCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'locate launcher target',
    kind: 'tool-call',
    sourceText: '/agent locate League of Legends in WeGame',
    toolCall: {
      goal: 'locate League of Legends in WeGame',
      input,
      name: 'locate_screen_elements',
    },
  };
}

let fetchCount = 0;
globalThis.fetch = (async () => {
  fetchCount += 1;
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            actionCandidates: [],
            confidence: 0.72,
            mainContent: 'WeGame is visible on the screen.',
            readableText: ['WeGame', 'League of Legends'],
            summary: 'WeGame launcher content is visible.',
            targetMatched: 'League of Legends',
            visibleAppOrWindow: 'WeGame',
            visibleObjects: ['League of Legends tile'],
          }),
        },
      },
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

(desktopPetShellRuntime as any).listCaptureSources = async () => [
  {
    height: 1440,
    id: 'screen:0:0',
    name: 'Screen 1',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'screen',
    width: 2560,
  },
  {
    height: 800,
    id: 'window:other:0',
    name: 'Other Window',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'window',
    width: 1200,
  },
];

try {
  const result = await executeAgentChatCommand(createLocateCommand({
    action: 'locate_element',
    allowScreenFallback: true,
    question: 'Locate League of Legends inside WeGame.',
    sourceQuery: 'WeGame',
    sourceType: 'window',
    targetText: 'League of Legends',
  }), createRuntimeContext());

  assert.equal(result.ok, true, JSON.stringify({
    errorText: result.errorText,
    observations: result.observations,
    stateSummary: result.stateSummary,
    verification: result.verification,
  }, null, 2));
  assert.equal(fetchCount, 1);
  assert.match(result.observations?.join('\n') ?? '', /Selected visual source: \[screen\] Screen 1/u);
  assert.match(result.observations?.join('\n') ?? '', /Visual source selection: rawSourceId=<absent>/u);
  assert.match(result.observations?.join('\n') ?? '', /Visual source selection: queryBestMatch=<none>/u);
  assert.match(result.observations?.join('\n') ?? '', /Visual source selection: allowScreenFallback=true/u);
  assert.match(
    result.observations?.join('\n') ?? '',
    /fell back to a screen source for recovery verification/u,
  );

  const defaultLocateFallbackResult = await executeAgentChatCommand(createLocateCommand({
    action: 'locate_element',
    question: 'Locate League of Legends inside WeGame.',
    sourceQuery: 'WeGame',
    sourceType: 'window',
    targetText: 'League of Legends',
  }), createRuntimeContext());

  assert.equal(defaultLocateFallbackResult.ok, false, JSON.stringify({
    errorText: defaultLocateFallbackResult.errorText,
    observations: defaultLocateFallbackResult.observations,
    stateSummary: defaultLocateFallbackResult.stateSummary,
    verification: defaultLocateFallbackResult.verification,
  }, null, 2));
  assert.equal(fetchCount, 1);
  assert.doesNotMatch(defaultLocateFallbackResult.observations?.join('\n') ?? '', /Selected visual source: \[screen\] Screen 1/u);
  assert.match(defaultLocateFallbackResult.errorText ?? '', /No matching screen\/window capture source was found/u);

  const staleSourceIdFallbackResult = await executeAgentChatCommand(createLocateCommand({
    action: 'locate_element',
    question: 'Locate League of Legends inside WeGame with a stale source id.',
    sourceId: 'window:2952540:0',
    sourceQuery: 'WeGame',
    sourceType: 'window',
    targetText: 'League of Legends',
  }), createRuntimeContext());

  assert.equal(staleSourceIdFallbackResult.ok, false, JSON.stringify({
    errorText: staleSourceIdFallbackResult.errorText,
    observations: staleSourceIdFallbackResult.observations,
    stateSummary: staleSourceIdFallbackResult.stateSummary,
    verification: staleSourceIdFallbackResult.verification,
  }, null, 2));
  assert.equal(fetchCount, 1);
  assert.match(staleSourceIdFallbackResult.errorText ?? '', /No matching screen\/window capture source was found/u);
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  (globalThis as any).Image = originalImage;
  (globalThis as any).document = originalDocument;
}

console.log('agent visual window source screen fallback smoke ok');
