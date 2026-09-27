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
        targetText: 'Example Game',
      },
      name: 'locate_screen_elements',
    },
  };
}

const originalFetch = globalThis.fetch;
const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;

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

globalThis.fetch = (async () => new Response(JSON.stringify({
  choices: [
    {
      message: {
        content: JSON.stringify({
          confidence: 0.86,
          mainContent: 'Launcher library view with Example Game and a Start text button.',
          readableText: ['Library', 'Example Game', 'Start'],
          summary: 'Launcher shows Example Game with a Start button.',
          targetMatched: 'Example Game',
          visibleAppOrWindow: 'Launcher',
          visibleTextCandidates: [
            {
              bounds: {
                height: 0.08,
                width: 0.18,
                x: 0.45,
                y: 0.66,
              },
              confidence: 'high',
              region: 'library tile title',
              text: 'Example Game',
            },
            {
              bounds: {
                height: 0.052,
                width: 0.09,
                x: 0.72,
                y: 0.60,
              },
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
})) as typeof fetch;

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

  assert.equal(result.ok, true);
  const evidence = result.stateSummary?.structuredEvidence;
  assert.equal(evidence?.targetMatched, 'Example Game');
  assert.equal(evidence?.primaryAction, 'Start');
  assert.equal(evidence?.visualActionReadiness, 'ready');
  assert.equal(evidence?.targetCandidates?.[0]?.label, 'Example Game');
  assert.equal(evidence?.targetCandidates?.[0]?.source, 'visual-ocr');
  assert.equal(evidence?.actionCandidates?.[0]?.label, 'Start');
  assert.equal(evidence?.actionCandidates?.[0]?.source, 'visual-ocr');
  assert.equal(evidence?.actionCandidates?.[0]?.bounds?.coordinateSpace, 'source-ratio');
  assert.deepEqual(evidence?.visibleTextCandidates, [
    'Example Game (confidence=high, library tile title)',
    'Start (confidence=high, lower right button)',
  ]);
  assert.match(result.observations?.join('\n') ?? '', /Visual action candidate 1: Start/u);
} finally {
  globalThis.fetch = originalFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
}

console.log('agent visual OCR text candidate normalization smoke ok');
