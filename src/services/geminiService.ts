import {
  type ChatMessage,
  type ChatMessageImageAttachment,
  type PetAutoSpeechTrigger,
  type PetConfig,
  type PetPersonality,
} from '../types';
import {
  COGNITION_REQUEST_VERSION,
  createCloudTextCognitionProvider,
  createCognitionRequestId,
  requireCognitionOutputText,
  runCognitionProvider,
  type CognitionTaskKind,
} from '../cognition';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { getGeminiClient } from './geminiClient';
import { requestModelFetch } from './modelTransport';
import { readOpenAITextStream } from './openAITextStream';
import {
  applyGeminiModelRequestParams,
  normalizeOpenAICompatibleUrl,
  resolveModelRequestParams,
} from '../modelProviderSettings';
import { summarizeAgentVisualSnapshot } from './agentVisualSnapshotService';
import {
  buildExternalWebSearchInstruction,
  type BrowserSearchMode,
} from './geminiWebSearchService';
import {
  buildCharacterReplySystemInstruction,
  buildChatMessagePromptText,
  buildHistoryMessagePromptText,
  buildPersonaBeginDialogMessages,
  limitHistoryForPrompt,
  normalizeChatImageAttachments,
  resolveRoleKnowledgeAttachment,
} from './geminiPromptService';
import { buildTriggeredSpeechPrompt } from './triggeredSpeechPrompt';
import {
  extractOpenAICompatibleText,
  summarizeOpenAICompatibleResponse,
} from './openAICompatibleResponseText';

export {
  analyzeAgentGameSnapshot,
  summarizeAgentVisualSnapshot,
  type AgentVisualSnapshotSummaryOptions,
} from './agentVisualSnapshotService';
export {
  buildExternalWebSearchInstruction,
  buildWebSearchQuery,
  shouldUseExternalWebSearch,
  type BrowserSearchMode,
  type ExternalWebSearchSource,
} from './geminiWebSearchService';
export {
  buildCharacterReplySystemInstruction,
  buildPersonaBeginDialogMessages,
  resolveRoleKnowledgeAttachment,
} from './geminiPromptService';

function mapOpenAICompatibleRole(role: ChatMessage['role']) {
  return role === 'model' ? 'assistant' : 'user';
}

function parseChatImageAttachmentDataUrl(attachment: ChatMessageImageAttachment) {
  const match = attachment.dataUrl.match(/^data:([^;,]+);base64,(.+)$/u);
  if (!match) {
    return null;
  }

  return {
    data: match[2],
    mimeType: attachment.mimeType || match[1] || 'image/png',
  };
}

function buildOpenAICompatibleMessageContent(
  text: string,
  attachments: ChatMessageImageAttachment[] = [],
  includeImages = false,
) {
  const imageAttachments = includeImages ? normalizeChatImageAttachments(attachments) : [];
  const promptText = buildChatMessagePromptText(
    text,
    imageAttachments,
    '请看这张图片。',
  );

  if (imageAttachments.length === 0) {
    return promptText || text;
  }

  return [
    { type: 'text', text: promptText || '请看这张图片。' },
    ...imageAttachments.map((attachment) => ({
      type: 'image_url',
      image_url: {
        url: attachment.dataUrl,
      },
    })),
  ];
}

function resolveCognitionRequestParams(settings: PetConfig['settings'], maxTokensOverride?: number) {
  const params = resolveModelRequestParams(settings);
  return Number.isFinite(maxTokensOverride) && Number(maxTokensOverride) > 0
    ? { ...params, max_tokens: Math.floor(Number(maxTokensOverride)) }
    : params;
}

function buildGeminiMessageParts(
  text: string,
  attachments: ChatMessageImageAttachment[] = [],
  includeImages = false,
) {
  const imageAttachments = includeImages ? normalizeChatImageAttachments(attachments) : [];
  const promptText = buildChatMessagePromptText(
    text,
    imageAttachments,
    '请看这张图片。',
  );
  const parts: Array<Record<string, unknown>> = [];

  if (promptText) {
    parts.push({ text: promptText });
  }

  if (includeImages) {
    imageAttachments.forEach((attachment) => {
      const parsedAttachment = parseChatImageAttachmentDataUrl(attachment);
      if (!parsedAttachment) {
        return;
      }

      parts.push({
        inlineData: {
          data: parsedAttachment.data,
          mimeType: parsedAttachment.mimeType,
        },
      });
    });
  }

  return parts.length > 0 ? parts : [{ text: text || '请继续。' }];
}

function buildGeminiHistoryContent(message: ChatMessage) {
  return {
    role: message.role,
    parts: buildGeminiMessageParts(buildHistoryMessagePromptText(message)),
  };
}

async function buildChatImageVisionPromptAttachment(options: {
  attachment: ChatMessageImageAttachment;
  index: number;
  settings: PetConfig['settings'];
  userInput: string;
}) {
  const {
    attachment,
    index,
    settings,
    userInput,
  } = options;
  const question = userInput.trim() || '请描述这张用户在聊天中发送的图片。';
  const summary = await summarizeAgentVisualSnapshot({
    imageDataUrl: attachment.dataUrl,
    question,
    settings,
    sourceLabel: `chat image ${index + 1}: ${attachment.name}`,
  });

  return [
    `图片 ${index + 1}${attachment.name ? `（${attachment.name}）` : ''}：`,
    summary,
  ].join('\n');
}

async function buildChatImageVisionPrompt(options: {
  attachments: ChatMessageImageAttachment[];
  settings: PetConfig['settings'];
  userInput: string;
}) {
  const imageAttachments = normalizeChatImageAttachments(options.attachments);
  if (imageAttachments.length === 0) {
    return '';
  }

  try {
    const summaries = await Promise.all(
      imageAttachments.map((attachment, index) => buildChatImageVisionPromptAttachment({
        attachment,
        index,
        settings: options.settings,
        userInput: options.userInput,
      })),
    );

    return [
      '用户本轮聊天发送了图片。以下是已配置视觉模型对图片内容的观察摘要，请把它当作图片证据来回答用户：',
      ...summaries,
      '如果摘要里有不确定信息，回答时也要保留不确定性，不要编造图片里没有的内容。',
    ].join('\n\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`聊天图片视觉分析失败：${message}`);
  }
}

function buildVisionEnrichedUserInput(userInput: string, imageVisionPrompt: string) {
  if (!imageVisionPrompt.trim()) {
    return userInput;
  }

  return [
    userInput.trim() || '请看这张图片。',
    imageVisionPrompt,
  ].filter(Boolean).join('\n\n');
}

function shouldSendAttachmentsToChatModel(settings: PetConfig['settings']) {
  return settings.llmProvider === 'gemini'
    || Boolean(settings.customModelCapabilities?.image);
}

async function requestOpenAICompatibleResponse(
  history: ChatMessage[],
  userInput: string,
  systemInstruction: string,
  settings: PetConfig['settings'],
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal | null,
  allowReasoningContentFallback = false,
  includeReasoningContentWhenPresent = false,
  maxTokensOverride?: number,
) {
  if (!settings.customApiUrl.trim()) {
    throw new Error('还没有填写 OpenAI 兼容接口地址。');
  }

  if (!settings.customModelName.trim()) {
    throw new Error('还没有填写模型名称。');
  }

  const endpoint = normalizeOpenAICompatibleUrl(settings.customApiUrl);
  const requestParams = resolveCognitionRequestParams(settings, maxTokensOverride);

  const response = await requestModelFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...requestParams,
      model: settings.customModelName.trim(),
      messages: [
        { role: 'system', content: systemInstruction },
        ...history.map((msg) => ({
          role: mapOpenAICompatibleRole(msg.role),
          content: buildOpenAICompatibleMessageContent(buildHistoryMessagePromptText(msg)),
        })),
        {
          role: 'user',
          content: buildOpenAICompatibleMessageContent(userInput, userAttachments, true),
        },
      ],
      stream: false,
    }),
    signal: signal ?? undefined,
  }, settings.customApiKey);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI 兼容接口请求失败 (${response.status})：${errorText || response.statusText}`);
  }

  const payload = await response.json();
  const text = extractOpenAICompatibleText(payload, {
    allowReasoningContentFallback,
    includeReasoningContentWhenPresent,
  });

  if (!text) {
    pushFrontendRuntimeLog(
      '设置窗/兼容模型响应',
      '接口成功但没有可用文本',
      summarizeOpenAICompatibleResponse(payload),
    );
    throw new Error('接口返回成功，但没有读取到可用的回复文本。');
  }

  return text;
}

async function* requestOpenAICompatibleResponseStream(
  history: ChatMessage[],
  userInput: string,
  systemInstruction: string,
  settings: PetConfig['settings'],
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal,
  maxTokensOverride?: number,
) {
  if (!settings.customApiUrl.trim() || !settings.customModelName.trim()) throw new Error('请先配置模型名称和接口地址。');
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timeout = setTimeout(() => controller.abort(new Error('流式请求超时，请重试。')), 300_000);
  try {
    const response = await requestModelFetch(normalizeOpenAICompatibleUrl(settings.customApiUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ ...resolveCognitionRequestParams(settings, maxTokensOverride),
        model: settings.customModelName.trim(), stream: true,
        messages: [{ role: 'system', content: systemInstruction },
          ...history.map((msg) => ({ role: mapOpenAICompatibleRole(msg.role), content: buildOpenAICompatibleMessageContent(buildHistoryMessagePromptText(msg)) })),
          { role: 'user', content: buildOpenAICompatibleMessageContent(userInput, userAttachments, true) }],
      }),
      signal: combined,
    }, settings.customApiKey);
    yield* readOpenAITextStream(response);
  } finally { clearTimeout(timeout); controller.abort(); }
}

async function requestGeminiResponse(
  history: ChatMessage[],
  userInput: string,
  systemInstruction: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal | null,
  maxTokensOverride?: number,
) {
  const aiClient = await getGeminiClient(settings.geminiApiKey);
  const config: Record<string, unknown> = {
    systemInstruction,
  };
  applyGeminiModelRequestParams(config, settings);
  if (signal) config.abortSignal = signal;
  if (Number.isFinite(maxTokensOverride) && Number(maxTokensOverride) > 0) {
    config.maxOutputTokens = Math.floor(Number(maxTokensOverride));
  }

  if (
    settings.webSearchEnabled
    && settings.llmProvider === 'gemini'
    && settings.webSearchProvider === 'gemini'
  ) {
    config.tools = [{ googleSearch: {} }];
  }

  void personality;

  const result = await aiClient.models.generateContent({
    model: settings.llmModel,
    config,
    contents: [
      ...history.map((msg) => buildGeminiHistoryContent(msg)),
      {
        role: 'user',
        parts: buildGeminiMessageParts(userInput, userAttachments, true),
      },
    ],
  });

  return result.text;
}

async function* requestGeminiResponseStream(
  history: ChatMessage[],
  userInput: string,
  systemInstruction: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal,
  maxTokensOverride?: number,
) {
  const aiClient = await getGeminiClient(settings.geminiApiKey);
  const config: Record<string, unknown> = {
    systemInstruction,
  };
  applyGeminiModelRequestParams(config, settings);
  if (signal) config.abortSignal = signal;
  if (maxTokensOverride) config.maxOutputTokens = maxTokensOverride;

  if (
    settings.webSearchEnabled
    && settings.llmProvider === 'gemini'
    && settings.webSearchProvider === 'gemini'
  ) {
    config.tools = [{ googleSearch: {} }];
  }

  void personality;

  const response = await aiClient.models.generateContentStream({
    model: settings.llmModel,
    config,
    contents: [
      ...history.map((msg) => buildGeminiHistoryContent(msg)),
      {
        role: 'user',
        parts: buildGeminiMessageParts(userInput, userAttachments, true),
      },
    ],
  });

  for await (const chunk of response) {
    const text = typeof chunk?.text === 'string' ? chunk.text : '';
    if (text) {
      yield text;
    }
  }
}

const AGENT_PLANNER_PERSONALITY: PetPersonality = {
  beginDialogs: [],
  chatAvatarUrl: '',
  chatHistoryMemory: '',
  customErrorMessage: '',
  greeting: '',
  knowledgeBase: '',
  dialogueCompletionPreset: '',
  neuralPersonaChatEnabled: false,
  name: 'Agent planner',
  systemInstruction: '',
  traits: [],
  userMemory: '',
  webLearningEnabled: false,
  webSearchEnabled: false,
};

export async function getConfiguredCognitionResponse(
  userInput: string,
  systemInstruction: string,
  settings: PetConfig['settings'],
  options: {
    allowReasoningContentFallback?: boolean;
    includeReasoningContentWhenPresent?: boolean;
    maxTokensOverride?: number;
    signal?: AbortSignal | null;
    task: CognitionTaskKind;
    timeoutMs?: number | null;
  },
) {
  const plannerSettings: PetConfig['settings'] = {
    ...settings,
    webSearchEnabled: false,
  };
  const provider = createCloudTextCognitionProvider({
    execute: async (request) => {
      if (plannerSettings.llmProvider === 'openai') {
        return requestOpenAICompatibleResponse(
          [],
          request.input.text,
          request.input.systemInstruction ?? '',
          plannerSettings,
          [],
          request.signal,
          options.allowReasoningContentFallback ?? false,
          options.includeReasoningContentWhenPresent ?? false,
          options.maxTokensOverride,
        );
      }

      return requestGeminiResponse(
        [],
        request.input.text,
        request.input.systemInstruction ?? '',
        AGENT_PLANNER_PERSONALITY,
        plannerSettings,
        [],
        request.signal,
        options.maxTokensOverride,
      );
    },
    id: `cloud-model.${plannerSettings.llmProvider}`,
    tasks: [options.task],
  });
  const result = await runCognitionProvider(provider, {
    input: {
      systemInstruction,
      text: userInput,
    },
    requestId: createCognitionRequestId(options.task),
    signal: options.signal ?? undefined,
    task: options.task,
    timeoutMs: options.timeoutMs,
    version: COGNITION_REQUEST_VERSION,
  });

  return requireCognitionOutputText(result);
}

/** Stream only user-facing prose. Structured plans keep the JSON request path. */
export async function* getConfiguredTextResponseStream(
  userInput: string, systemInstruction: string, settings: PetConfig['settings'],
  options: { signal?: AbortSignal; maxTokens?: number; timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('正文生成超时，请重试。')), options.timeoutMs ?? 300_000);
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const proseSettings = { ...settings, webSearchEnabled: false };
  try {
    if (settings.llmProvider === 'openai') {
      yield* requestOpenAICompatibleResponseStream([], userInput, systemInstruction, proseSettings, [], signal, options.maxTokens);
    } else {
      yield* requestGeminiResponseStream([], userInput, systemInstruction, AGENT_PLANNER_PERSONALITY, proseSettings, [], signal, options.maxTokens);
    }
  } finally { clearTimeout(timer); controller.abort(); }
}

export function getAgentPlannerResponse(
  userInput: string,
  systemInstruction: string,
  settings: PetConfig['settings'],
  signal?: AbortSignal | null,
) {
  return getConfiguredCognitionResponse(userInput, systemInstruction, settings, {
    signal, task: 'agent-decision',
  });
}

async function requestPetResponseInternal(
  history: ChatMessage[],
  userInput: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal | null,
) {
  const imageVisionPrompt = await buildChatImageVisionPrompt({
    attachments: userAttachments,
    settings,
    userInput,
  });
  const modelUserInput = buildVisionEnrichedUserInput(userInput, imageVisionPrompt);
  const roleKnowledgeAttachment = resolveRoleKnowledgeAttachment(personality, userInput);
  pushFrontendRuntimeLog('角色知识库', roleKnowledgeAttachment
    ? `角色知识库已挂接：${roleKnowledgeAttachment.triggerReason}`
    : '角色知识库未挂接', {
    petName: personality.name,
    knowledgeBaseLength: personality.knowledgeBase.trim().length,
    matchCount: roleKnowledgeAttachment?.matchCount ?? 0,
    strongMatchCount: roleKnowledgeAttachment?.strongMatchCount ?? 0,
    selectedChunkCount: roleKnowledgeAttachment?.selectedChunkCount ?? 0,
    totalContentLength: roleKnowledgeAttachment?.totalContentLength ?? personality.knowledgeBase.trim().length,
  });

  const systemInstruction = buildCharacterReplySystemInstruction(personality, settings, history, userInput);
  const customWebSearchInstruction = await buildExternalWebSearchInstruction(
    userInput,
    personality,
    settings,
    browserSearchMode,
  );
  const enrichedSystemInstruction = [
    systemInstruction,
    customWebSearchInstruction,
  ].filter(Boolean).join('\n\n');
  const promptHistory = [
    ...buildPersonaBeginDialogMessages(personality),
    ...limitHistoryForPrompt(history, settings.memoryDepth),
  ];
  const chatModelAttachments = shouldSendAttachmentsToChatModel(settings) ? userAttachments : [];

  if (settings.llmProvider === 'openai') {
    return requestOpenAICompatibleResponse(
      promptHistory,
      modelUserInput,
      enrichedSystemInstruction,
      settings,
      chatModelAttachments,
      signal,
    );
  }

  return requestGeminiResponse(
    promptHistory,
    modelUserInput,
    enrichedSystemInstruction,
    personality,
    settings,
    chatModelAttachments,
    signal,
  );
}

async function* requestPetResponseStreamInternal(
  history: ChatMessage[],
  userInput: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal,
) {
  const imageVisionPrompt = await buildChatImageVisionPrompt({
    attachments: userAttachments,
    settings,
    userInput,
  });
  const modelUserInput = buildVisionEnrichedUserInput(userInput, imageVisionPrompt);
  const roleKnowledgeAttachment = resolveRoleKnowledgeAttachment(personality, userInput);
  pushFrontendRuntimeLog('角色知识库', roleKnowledgeAttachment
    ? `角色知识库已挂接：${roleKnowledgeAttachment.triggerReason}`
    : '角色知识库未挂接', {
    petName: personality.name,
    knowledgeBaseLength: personality.knowledgeBase.trim().length,
    matchCount: roleKnowledgeAttachment?.matchCount ?? 0,
    strongMatchCount: roleKnowledgeAttachment?.strongMatchCount ?? 0,
    selectedChunkCount: roleKnowledgeAttachment?.selectedChunkCount ?? 0,
    totalContentLength: roleKnowledgeAttachment?.totalContentLength ?? personality.knowledgeBase.trim().length,
  });

  const systemInstruction = buildCharacterReplySystemInstruction(personality, settings, history, userInput);
  const customWebSearchInstruction = await buildExternalWebSearchInstruction(
    userInput,
    personality,
    settings,
    browserSearchMode,
  );
  const enrichedSystemInstruction = [
    systemInstruction,
    customWebSearchInstruction,
  ].filter(Boolean).join('\n\n');
  const promptHistory = [
    ...buildPersonaBeginDialogMessages(personality),
    ...limitHistoryForPrompt(history, settings.memoryDepth),
  ];
  const chatModelAttachments = shouldSendAttachmentsToChatModel(settings) ? userAttachments : [];

  if (settings.llmProvider === 'openai') {
    yield* requestOpenAICompatibleResponseStream(
      promptHistory,
      modelUserInput,
      enrichedSystemInstruction,
      settings,
      chatModelAttachments,
      signal,
    );
    return;
  }

  yield* requestGeminiResponseStream(
    promptHistory,
    modelUserInput,
    enrichedSystemInstruction,
    personality,
    settings,
    chatModelAttachments,
    signal,
  );
}

export async function getPetTriggeredResponse(
  history: ChatMessage[],
  trigger: PetAutoSpeechTrigger,
  personality: PetPersonality,
  settings: PetConfig['settings'],
) {
  const prompt = buildTriggeredSpeechPrompt(trigger, personality);
  const response = await requestPetResponseInternal(history, prompt, personality, settings);

  return response.trim();
}

/**
 * Strict version of the normal chat request for internal flows that must be
 * able to distinguish a real model response from the chat error fallback.
 */
export async function getPetResponseStrict(
  history: ChatMessage[],
  userInput: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal | null,
) {
  const response = await requestPetResponseInternal(
    history,
    userInput,
    personality,
    settings,
    browserSearchMode,
    userAttachments,
    signal,
  );

  return response.trim();
}

export async function* getPetResponseStream(
  history: ChatMessage[],
  userInput: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  userAttachments: ChatMessageImageAttachment[] = [],
  signal?: AbortSignal,
) {
  try {
    if (settings.chatStreamingEnabled === false) {
      const response = await requestPetResponseInternal(history, userInput, personality, settings, browserSearchMode, userAttachments, signal);
      if (!signal?.aborted && response) yield response;
      return;
    }
    yield* requestPetResponseStreamInternal(history, userInput, personality, settings, browserSearchMode, userAttachments, signal);
  } catch (error) {
    if (signal?.aborted) return;
    console.error('Chat API Error:', error);
    const customErrorMessage = personality.customErrorMessage.trim();
    if (customErrorMessage) {
      yield customErrorMessage;
      return;
    }

    yield error instanceof Error ? `聊天请求失败：${error.message}` : '聊天请求失败，请稍后再试。';
  }
}

export async function getPetResponse(
  history: ChatMessage[],
  userInput: string,
  personality: PetPersonality,
  settings: PetConfig['settings'],
  browserSearchMode: BrowserSearchMode = 'allow',
  userAttachments: ChatMessageImageAttachment[] = [],
) {
  let response = '';
  for await (const chunk of getPetResponseStream(history, userInput, personality, settings, browserSearchMode, userAttachments)) {
    response += chunk;
  }

  return response.trim();
}

