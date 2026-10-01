import { type PetConfig } from '../types';
import { normalizeOpenAICompatibleUrl } from '../modelProviderSettings';
import { getGeminiClient } from './geminiClient';
import { requestModelFetch } from './modelTransport';
import {
  applyGeminiVisionModelRequestParams,
  resolveGeminiVisionModelName,
  resolveOpenAICompatibleVisionModelSettings,
  resolveVisionModelRequestParams,
  resolveVisionModelSettings,
} from '../visionModelSettings';

function extractOpenAICompatibleText(payload: any): string | null {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textSegments = content
      .map((item) => (
        typeof item?.text === 'string'
          ? item.text
          : typeof item?.content === 'string'
            ? item.content
            : ''
      ))
      .filter(Boolean);

    if (textSegments.length > 0) {
      return textSegments.join('\n');
    }
  }

  return null;
}

export interface AgentVisualSnapshotSummaryOptions {
  focus?: string | null;
  gameHint?: string | null;
  gameIdentityMetadata?: string | null;
  imageDataUrl: string;
  promptMode?: 'desktop' | 'game';
  question?: string | null;
  settings: PetConfig['settings'];
  sourceLabel?: string | null;
}

function parseVisualSnapshotDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/iu);
  if (!match) {
    throw new Error('视觉快照不是有效的 base64 图片 data URL。');
  }

  return {
    base64: match[2] ?? '',
    mimeType: match[1] ?? 'image/png',
  };
}

function buildAgentVisualSnapshotPrompt(options: AgentVisualSnapshotSummaryOptions) {
  if (options.promptMode === 'game') {
    return [
      'You are analyzing one game screen/window snapshot for a desktop pet Agent.',
      'Return exactly one compact JSON object. Do not return markdown or extra prose.',
    'Use Chinese strings. Keep arrays short. If a field is uncertain, say so in uncertainty instead of inventing.',
    'JSON fields: summary, detectedGameOrGenre, gameIdentityEvidence, sceneState, playerState, hud, visibleText, uncertainty, confidence, companionCue.',
    'confidence must be a number from 0 to 1.',
    'Identify the specific game title when a title, process/executable clue, logo, or distinctive readable UI supports it. Otherwise report only the game/genre and explicitly say identity is uncertain; never invent a game title.',
    'gameIdentityEvidence must briefly state the visual or local-window clue supporting detectedGameOrGenre, or say no reliable identity clue.',
    'Focus on visible gameplay content: likely game or genre, player situation, HUD, health/ammo/score/objective/minimap if readable, notable events, and uncertainty.',
    'Perform an OCR-style pass for readable HUD/menu text. Put exact snippets in visibleText; if text is tiny or partially readable, include the best snippet plus the uncertainty.',
      'Include one short companion-style observation that could help the pet chat naturally, but do not roleplay a long response.',
      'Do not invent hidden content, controls, player intent, off-screen enemies, or frame-by-frame events. If the image is unclear, say what is unclear.',
      options.sourceLabel ? `Source: ${options.sourceLabel}` : '',
      options.gameHint?.trim() ? `Game hint from user/agent: ${options.gameHint.trim()}` : '',
      options.gameIdentityMetadata?.trim() ? `Local game-window metadata: ${options.gameIdentityMetadata.trim()}` : '',
      options.focus?.trim() ? `Analysis focus: ${options.focus.trim()}` : '',
      options.question?.trim() ? `User question: ${options.question.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    'You are summarizing one desktop/window visual snapshot for a model-driven desktop Agent.',
    'Return exactly one compact JSON object. Do not return markdown or extra prose.',
    'Use Chinese strings. Keep arrays short. If a field is uncertain, say so in uncertainty instead of inventing.',
    'JSON fields: summary, visibleAppOrWindow, mainContent, visibleObjects, readableText, visibleTextCandidates, targetMatched, targetCandidates, primaryAction, actionCandidates, elementRegion, elementCenterRatio, elementCenter, elementBounds, relation, postActionState, uncertainty, confidence, companionCue.',
    'confidence must be a number from 0 to 1.',
    'Focus on visible UI state, readable text if any, obvious windows/apps, and uncertainty.',
    'Perform an OCR-style pass over the source, especially focused crops and small labels/buttons. Put exact readable snippets in readableText and likely-but-uncertain snippets in visibleTextCandidates.',
    'For UI location or in-app launch questions, identify the requested target item, the primary open/start/play button associated with that target, their approximate screen region, elementCenterRatio as {x,y} normalized from 0 to 1 within the captured source, optional elementCenter/elementBounds if known, and whether the relation is visually clear.',
    'When multiple similar targets, OCR snippets, or buttons are visible, return short targetCandidates/actionCandidates arrays. Each candidate may include label, description, confidence, region, centerRatio, center, bounds, and relation. Prefer candidate objects over prose when the Agent may need to crop, rank, or click later.',
    'For tiny text/buttons/icons, include approximate centerRatio or bounds for the relevant OCR snippet or button when visible. Do not mark a target/action ready when the text is unreadable, the action relation is unclear, or the coordinate is only a guess.',
    'For post-action verification questions, set postActionState to exactly one of: launched, loading, login_required, updating, error, unchanged, blocked, unknown.',
    'Do not invent hidden content. If text is too small or unclear, say it is unclear.',
    options.sourceLabel ? `Source: ${options.sourceLabel}` : '',
    options.question?.trim() ? `User question: ${options.question.trim()}` : '',
  ].filter(Boolean).join('\n');
}

function getAgentVisualSnapshotSystemInstruction(options: AgentVisualSnapshotSummaryOptions) {
  return options.promptMode === 'game'
    ? 'You analyze game screenshots for a desktop pet Agent. Return compact JSON only, be evidence-focused, and be explicit about uncertainty.'
    : 'You summarize desktop screenshots for an Agent. Return compact JSON only, be evidence-focused, and be explicit about uncertainty.';
}

async function requestOpenAICompatibleVisualSnapshotSummary(options: AgentVisualSnapshotSummaryOptions) {
  const visionModelSettings = resolveOpenAICompatibleVisionModelSettings(options.settings);

  if (visionModelSettings.inherited && !options.settings.customModelCapabilities?.image) {
    throw new Error('当前 OpenAI 兼容模型没有启用图像能力，不能分析屏幕快照。');
  }

  if (!visionModelSettings.apiUrl?.trim()) {
    throw new Error(visionModelSettings.inherited
      ? '还没有填写 OpenAI 兼容接口地址。'
      : '还没有填写视觉 OpenAI 兼容接口地址。');
  }

  if (!visionModelSettings.modelName?.trim()) {
    throw new Error(visionModelSettings.inherited
      ? '还没有填写模型名称。'
      : '还没有填写视觉模型名称。');
  }

  const endpoint = normalizeOpenAICompatibleUrl(visionModelSettings.apiUrl);
  const requestParams = resolveVisionModelRequestParams(options.settings);
  const prompt = buildAgentVisualSnapshotPrompt(options);
  const response = await requestModelFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...requestParams,
      model: visionModelSettings.modelName.trim(),
      messages: [
        {
          role: 'system',
          content: getAgentVisualSnapshotSystemInstruction(options),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: options.imageDataUrl } },
          ],
        },
      ],
      stream: false,
    }),
  }, visionModelSettings.apiKey ?? '', visionModelSettings.inherited ? 'customApiKey' : 'visionCustomApiKey');

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI 兼容视觉请求失败 (${response.status})：${errorText || response.statusText}`);
  }

  const payload = await response.json();
  const text = extractOpenAICompatibleText(payload);
  if (!text) {
    throw new Error('视觉模型请求成功，但没有返回可用文本。');
  }

  return text.trim();
}

async function requestGeminiVisualSnapshotSummary(options: AgentVisualSnapshotSummaryOptions) {
  const { base64, mimeType } = parseVisualSnapshotDataUrl(options.imageDataUrl);
  const aiClient = await getGeminiClient(options.settings.geminiApiKey);
  const config: Record<string, unknown> = {
    systemInstruction: getAgentVisualSnapshotSystemInstruction(options),
  };
  applyGeminiVisionModelRequestParams(config, options.settings);

  const result = await aiClient.models.generateContent({
    model: resolveGeminiVisionModelName(options.settings),
    config,
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildAgentVisualSnapshotPrompt(options) },
          {
            inlineData: {
              data: base64,
              mimeType,
            },
          },
        ],
      },
    ],
  });
  const text = typeof result?.text === 'string' ? result.text.trim() : '';
  if (!text) {
    throw new Error('Gemini 视觉请求成功，但没有返回可用文本。');
  }

  return text;
}

export async function summarizeAgentVisualSnapshot(options: AgentVisualSnapshotSummaryOptions) {
  if (!options.imageDataUrl.trim()) {
    throw new Error('视觉快照为空，无法分析。');
  }

  const resolvedVisionModel = resolveVisionModelSettings(options.settings);
  if (resolvedVisionModel.disabled) {
    throw new Error('Vision model is disabled. Enable visual analysis before analyzing screen or game snapshots.');
  }

  if (resolvedVisionModel.provider === 'openai') {
    return requestOpenAICompatibleVisualSnapshotSummary(options);
  }

  return requestGeminiVisualSnapshotSummary(options);
}

export async function analyzeAgentGameSnapshot(options: Omit<AgentVisualSnapshotSummaryOptions, 'promptMode'>) {
  return summarizeAgentVisualSnapshot({
    ...options,
    promptMode: 'game',
  });
}
