import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  executeAgentChatCommand,
  getAgentToolLifecycleMetadata,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { summarizeAgentVisualSnapshot } from '../src/services/geminiService.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const toolName = 'summarize_visual_snapshot' satisfies AgentToolCallName;
const originalImage = (globalThis as any).Image;
const originalDocument = (globalThis as any).document;

function createVisualToolCommand(input: Record<string, unknown> = {}): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'test visual snapshot summary',
    kind: 'tool-call',
    sourceText: '/agent what is visible on my screen',
    toolCall: {
      goal: 'test visual snapshot summary',
      input,
      name: toolName,
    },
  };
}

function createRuntimeContext(settings = {} as PetConfig['settings']) {
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

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true, 'visual snapshot summary tool should be registered');
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, 'visual snapshot summary should be available in Agent mode');
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.deepEqual(lifecycle.mutates, []);
assert.equal(lifecycle.observes.includes('visual-summary'), true);
assert.equal(lifecycle.verifies.includes('visual-summary'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
assert.equal(schema.some((spec) => spec.key === 'sourceType'), true);
assert.equal(schema.some((spec) => spec.key === 'sourceId'), true);
assert.equal(schema.some((spec) => spec.key === 'query'), true);
assert.equal(schema.some((spec) => spec.key === 'question'), true);
assert.equal(schema.some((spec) => spec.key === 'allowScreenFallback'), true);

const route = buildAgentPermissionRoute(createVisualToolCommand({
  question: 'What is visible?',
  sourceType: 'screen',
}));
assert.equal(route.status, 'notify');
assert.equal(route.routeMode, 'agent');
assert.equal(route.maxRisk, 'visual');
assert.equal(route.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(route), false);
assert.equal(route.plan?.steps.some((step) => step.action.kind === 'capture-screen-context'), true);

const chatCommandSource = readProjectFile('src/agent/agentChatCommand.ts');
const registrySource = readProjectFile('src/agent/agentToolRegistry.ts');
const schemaSource = readProjectFile('src/agent/agentToolInputSchema.ts');
const modeSource = readProjectFile('src/agent/agentModeRouter.ts');
const orchestratorSource = readProjectFile('src/agent/agentOrchestrator.ts');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const planningContextSource = readProjectFile('src/agent/runtime/agentPlanningContextRuntime.ts');
const visualSignalsSource = readProjectFile('src/agent/runtime/agentVisualPlanningSignals.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const visualRuntimeSource = readProjectFile('src/agent/agentRuntimeVisualTools.ts');
const serviceSource = readProjectFile('src/services/geminiService.ts');
const visualSnapshotServiceSource = readProjectFile('src/services/agentVisualSnapshotService.ts');

for (const source of [
  chatCommandSource,
  registrySource,
  schemaSource,
  modeSource,
  orchestratorSource,
  sessionSource,
  runtimeSource,
]) {
  assert.match(source, /summarize_visual_snapshot/u);
}

assert.match(runtimeSource, /executeSummarizeVisualSnapshot/u);
assert.match(visualRuntimeSource, /executeSummarizeVisualSnapshot/u);
assert.match(visualRuntimeSource, /includeCaptureThumbnails: true/u);
assert.match(visualRuntimeSource, /formatCaptureSourceCandidateLines/u);
assert.match(visualRuntimeSource, /Available capture source candidate/u);
assert.match(visualRuntimeSource, /findBestVisualSnapshotSourceMatch/u);
assert.match(visualRuntimeSource, /createVisualSnapshotRecoveryStateSummary/u);
assert.match(visualRuntimeSource, /recommendedRecovery/u);
assert.match(sessionSource, /recommendedRecovery/u);
assert.match(sessionSource, /low confidence/u);
assert.match(planningContextSource, /Recent visual context/u);
assert.match(visualSignalsSource, /createAgentRecentVisualContextText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentVisualPlanningSignals'/u);
assert.match(planningContextSource, /Current visual recovery signal/u);
assert.match(visualSignalsSource, /createAgentVisualRecoveryText/u);
assert.match(serviceSource, /summarizeAgentVisualSnapshot/u);
assert.match(visualSnapshotServiceSource, /summarizeAgentVisualSnapshot/u);
assert.match(visualSnapshotServiceSource, /inlineData/u);
assert.match(visualSnapshotServiceSource, /image_url/u);

let modelCallCount = 0;
const settings = {} as PetConfig['settings'];
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /summarize_visual_snapshot/u);
    assert.match(systemInstruction, /visible inside a screen or window/u);
    assert.match(systemInstruction, /live visual observation test/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'summarize_visual_snapshot',
          question: 'What is visible?',
          sourceType: 'screen',
        },
        reason: 'Need visual evidence before answering what is visible.',
        tool: 'execute_desktop_observation',
        understanding: {
          neededCapability: 'visual desktop observation',
          successCriteria: 'a visual summary is returned as evidence',
          userNeed: 'know what is visible on screen',
        },
      });
    }

    assert.match(userInput, /Recent visual context/u);
    assert.match(userInput, /Visual summary: editor window with Agent code/u);
    assert.match(userInput, /tool=execute_desktop_observation/u);
    assert.match(userInput, /Visual summary: editor window with Agent code/u);
    return JSON.stringify({
      action: 'final_answer',
      message: '我看到了一个正在编辑 Agent 代码的窗口。',
      understanding: {
        successCriteria: 'visual summary was observed',
        userNeed: 'know what is visible on screen',
      },
    });
  },
  settings,
  sourceText: '/agent what is visible on my screen',
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'desktop-observation');
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, toolName);
    assert.equal(command.toolCall?.input.sourceType, 'screen');
    return {
      observations: [
        'Selected visual source: [screen] Screen 1 2560x1440',
        'Visual summary: editor window with Agent code',
      ],
      ok: true,
      responseText: '视觉来源：[screen] Screen 1 2560x1440\neditor window with Agent code',
      verification: 'visual summary smoke',
    };
  },
  userGoal: 'what is visible on my screen',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.name, 'execute_desktop_observation');
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.input.action, toolName);
assert.equal(modelCallCount, 2);

const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
(desktopPetShellRuntime as any).listCaptureSources = async () => [
  {
    height: 800,
    id: 'window:other',
    name: 'Other Window',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'window',
    width: 1200,
  },
];

try {
  const noFallbackResult = await executeAgentChatCommand(createVisualToolCommand({
    query: '2345看图王',
    sourceType: 'window',
  }), createRuntimeContext());

  assert.equal(noFallbackResult.ok, false);
  assert.match(noFallbackResult.errorText ?? '', /No matching screen\/window capture source/u);
  assert.match(noFallbackResult.observations?.join('\n') ?? '', /window:other/u);
  assert.match(noFallbackResult.observations?.join('\n') ?? '', /Available capture source candidate/u);
  assert.match(noFallbackResult.stateSummary?.missingEvidence?.join('\n') ?? '', /capture source was not identified/u);
  assert.match(noFallbackResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /list_capture_sources/u);
} finally {
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
}

(desktopPetShellRuntime as any).listCaptureSources = async () => [
  {
    height: 800,
    id: 'window:2345-pic-viewer',
    name: '2345PicViewer',
    type: 'window',
    width: 1200,
  },
];

try {
  const fuzzyMatchResult = await executeAgentChatCommand(createVisualToolCommand({
    query: 'Look at the image currently open in 2345看图王',
    sourceType: 'window',
  }), createRuntimeContext());

  assert.equal(fuzzyMatchResult.ok, false);
  assert.match(fuzzyMatchResult.errorText ?? '', /thumbnail/u);
  assert.match(fuzzyMatchResult.observations?.join('\n') ?? '', /Selected visual source: \[window\] 2345PicViewer/u);
} finally {
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
}

let fallbackFetchCount = 0;
const originalFallbackFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  fallbackFetchCount += 1;
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            confidence: 0.88,
            mainContent: 'WeGame login page is visible on the screen.',
            readableText: ['快速安全登录'],
            summary: 'WeGame 登录页可见，包含快速安全登录按钮。',
            visibleAppOrWindow: 'WeGame',
            visibleObjects: ['login button'],
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
    id: 'screen:1',
    name: 'Screen 1',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'screen',
    width: 2560,
  },
  {
    height: 800,
    id: 'window:other',
    name: 'Other Window',
    thumbnail: 'data:image/png;base64,aGVsbG8=',
    type: 'window',
    width: 1200,
  },
];

try {
  const fallbackResult = await executeAgentChatCommand(createVisualToolCommand({
    allowScreenFallback: true,
    query: 'WeGame',
    question: 'Verify visible post-action state for WeGame.',
    sourceType: 'all',
  }), createRuntimeContext({
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
  } as PetConfig['settings']));

  assert.equal(fallbackResult.ok, true, JSON.stringify({
    errorText: fallbackResult.errorText,
    observations: fallbackResult.observations,
    stateSummary: fallbackResult.stateSummary,
    verification: fallbackResult.verification,
  }, null, 2));
  assert.equal(fallbackFetchCount, 1);
  assert.match(fallbackResult.observations?.join('\n') ?? '', /Selected visual source: \[screen\] Screen 1/u);
  assert.match(fallbackResult.observations?.join('\n') ?? '', /fell back to a screen source for recovery verification/u);
  assert.match(fallbackResult.responseText, /WeGame/u);
} finally {
  globalThis.fetch = originalFallbackFetch;
  (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
}

let recoveryModelCallCount = 0;
const recoveryModelInputs: string[] = [];
const recoveryResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    recoveryModelInputs.push(userInput);
    recoveryModelCallCount += 1;

    if (recoveryModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'summarize_visual_snapshot',
          query: 'unclear target window',
          sourceType: 'window',
        },
        reason: 'Need to inspect the named window before answering.',
        tool: 'execute_desktop_observation',
        understanding: {
          neededCapability: 'visual desktop observation',
          successCriteria: 'the correct visual source is identified and summarized',
          userNeed: 'know what is visible in a target window',
        },
      });
    }

    assert.match(userInput, /Current visual recovery signal/u);
    assert.match(userInput, /candidateSources=.*window:target/u);
    assert.match(userInput, /ask one short confirmation question/u);
    return JSON.stringify({
      action: 'ask_user',
      message: '我找到了几个可能的窗口，你要我看 Target Window 吗？',
      understanding: {
        neededCapability: 'confirm visual source before retrying',
        userNeed: 'know what is visible in a target window',
      },
    });
  },
  settings,
  sourceText: '/agent look at the unclear target window',
  toolExecutor: async () => ({
    errorText: 'No matching screen/window capture source was found.',
    observations: [
      'Requested source query: unclear target window',
      'Available capture source candidate 1. [window] Target Window id="window:target" 1200x800 thumbnail=yes',
    ],
    ok: false,
    responseText: '没有找到匹配的屏幕或窗口快照来源。',
    stateSummary: {
      missingEvidence: ['Visual capture source was not identified confidently.'],
      observedState: [
        'Visual requested source: type=window, query=unclear target window',
        'Available capture source candidate 1. [window] Target Window id="window:target" 1200x800 thumbnail=yes',
      ],
      recommendedRecovery: [
        'Use list_capture_sources or get_active_window_info to identify the exact capture source before retrying visual analysis.',
        'If candidate sources are ambiguous, ask one short question asking which screen/window to inspect.',
      ],
    },
    verification: 'No capture source matched the requested visual snapshot target.',
  }),
  userGoal: 'look at the unclear target window',
});

assert.equal(recoveryResult.status, 'needs-user');
assert.equal(recoveryModelInputs.length, 2);
assert.match(recoveryResult.finalAnswer, /Target Window/u);

const originalFetch = globalThis.fetch;
const visualFetchCalls: Array<{ body: any; headers: HeadersInit | undefined; url: string }> = [];
const visualFetchResponses = [
  '独立视觉模型摘要',
  JSON.stringify({
    companionCue: '这张图像看起来可以继续细问细节。',
    confidence: 0.42,
    mainContent: '图片查看器中打开了一张风景图。',
    readableText: ['没有清晰可读的大段文字'],
    summary: '图片查看器正在显示一张风景照片。',
    uncertainty: ['工具栏小字不清楚'],
    visibleAppOrWindow: '2345PicViewer',
    visibleObjects: ['风景照片', '图片查看器工具栏'],
  }),
];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  visualFetchCalls.push({
    body,
    headers: init?.headers,
    url: String(input),
  });

  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: visualFetchResponses.shift() ?? '视觉模型摘要',
        },
      },
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

try {
  const visualSummary = await summarizeAgentVisualSnapshot({
    imageDataUrl: 'data:image/png;base64,aGVsbG8=',
    question: 'What is visible?',
    settings: {
      customApiKey: 'chat-key',
      customApiUrl: 'https://chat.example.com/v1',
      customModelName: 'chat-model',
      customModelCapabilities: {
        image: false,
        reasoning: false,
        text: true,
        tools: false,
      },
      customModelRequestParams: [],
      llmModel: 'gemini-1.5-flash',
      llmProvider: 'gemini',
      visionCustomApiKey: 'vision-key',
      visionCustomApiUrl: 'https://vision.example.com/v1',
      visionCustomModelName: 'vision-model',
      visionCustomModelRequestParams: [
        { id: 'vision-temperature', key: 'temperature', value: '0.2', valueType: 'number' },
      ],
      visionModelProvider: 'openai',
    } as PetConfig['settings'],
    sourceLabel: '[screen] Test screen 100x100',
  });

  assert.equal(visualSummary, '独立视觉模型摘要');
  assert.equal(visualFetchCalls.length, 1);
  assert.equal(visualFetchCalls[0]?.url, 'https://vision.example.com/v1/chat/completions');
  assert.equal(visualFetchCalls[0]?.body.model, 'vision-model');
  assert.equal(visualFetchCalls[0]?.body.temperature, 0.2);
  assert.equal(visualFetchCalls[0]?.body.messages[1]?.content[1]?.type, 'image_url');
  assert.deepEqual(visualFetchCalls[0]?.headers, {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: 'Bearer vision-key',
  });

  (desktopPetShellRuntime as any).listCaptureSources = async () => [
    {
      height: 800,
      id: 'screen:1',
      name: 'Screen 1',
      thumbnail: 'data:image/png;base64,aGVsbG8=',
      type: 'screen',
      width: 1200,
    },
  ];

  try {
    const structuredResult = await executeAgentChatCommand(createVisualToolCommand({
      question: 'What is visible?',
      sourceType: 'screen',
    }), createRuntimeContext({
      customApiKey: 'chat-key',
      customApiUrl: 'https://chat.example.com/v1',
      customModelName: 'chat-model',
      customModelCapabilities: {
        image: false,
        reasoning: false,
        text: true,
        tools: false,
      },
      customModelRequestParams: [],
      llmModel: 'gemini-1.5-flash',
      llmProvider: 'gemini',
      visionCustomApiKey: 'vision-key',
      visionCustomApiUrl: 'https://vision.example.com/v1',
      visionCustomModelName: 'vision-model',
      visionCustomModelRequestParams: [],
      visionModelProvider: 'openai',
    } as PetConfig['settings']));

    assert.equal(structuredResult.ok, true);
    assert.equal(visualFetchCalls.length, 2);
    assert.match(visualFetchCalls[1]?.body.messages[1]?.content[0]?.text ?? '', /JSON object/u);
    assert.match(structuredResult.observations?.join('\n') ?? '', /Visual app\/window: 2345PicViewer/u);
    assert.match(structuredResult.observations?.join('\n') ?? '', /Visual readable text: 没有清晰可读的大段文字/u);
    assert.match(structuredResult.observations?.join('\n') ?? '', /Visual confidence: 0.42/u);
    assert.match(structuredResult.stateSummary?.observedState?.join('\n') ?? '', /Visual main content/u);
    assert.match(structuredResult.stateSummary?.missingEvidence?.join('\n') ?? '', /工具栏小字不清楚/u);
    assert.match(structuredResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /Low visual confidence/u);
    assert.match(structuredResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /short clarification/u);
  } finally {
    (desktopPetShellRuntime as any).listCaptureSources = originalListCaptureSources;
  }
} finally {
  globalThis.fetch = originalFetch;
}

(globalThis as any).Image = originalImage;
(globalThis as any).document = originalDocument;

console.log('agent visual snapshot summary smoke ok');
