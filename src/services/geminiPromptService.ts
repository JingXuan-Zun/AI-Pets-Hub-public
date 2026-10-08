import { buildRealWorldTimeSystemInstruction } from '../timeAwareness';
import {
  type ChatMessage,
  type ChatMessageImageAttachment,
  type PetConfig,
  type PetPersonality,
} from '../types';
import { stripLegacyGroupMemory } from '../group-memory';
import { formatCharacterMemoryItemsForPrompt } from '../character-memory/characterMemoryTypes';
import { buildPersonaRuleContractInstruction, resolvePersonaRulePolicy } from './personaRulePolicy';

const CHARACTER_REPLY_FORMAT_INSTRUCTION = [
  '回复格式补充规则：',
  '1. 这只是默认兜底格式；如果用户填写的人格提示词里定义了回复格式、括号用法、附加信息格式或示例，必须优先使用人格提示词里的格式。',
  '2. 默认情况下，真正说出口的对白写在括号外。',
  '3. 默认情况下，动作描写、神态描写、情绪描写、状态描写如果需要出现，必须使用中文全角括号“（…）”包起来。',
  '4. 不要把动作/情绪描写裸写在正文里，也不要使用半角括号 ()。',
  '5. 括号内内容保持简短自然，优先写成“（轻轻歪头）”“（有点开心）”这类短描写。',
  '6. 如果一句回复同时包含描写和对白，描写放前面或单独成段，但都必须保留括号。',
].join('\n');

const CHARACTER_TOOL_PROTOCOL_INSTRUCTION = [
  '角色工具调用协议（可选）：',
  '1. 人格提示词里的所有设定拥有最高执行权；工具调用只能服务于角色表达，不得改变角色人设、口吻、关系、边界或用户在人格提示词里指定的回复格式。',
  '2. 当角色想触发表情/动作时，可以在回复中加入工具标记：`【动作:开心】`、`【动作:难过】`、`【动作:睡觉】`、`【动作:吃东西】`。害羞、惊喜、微笑、挥手等会归到开心；委屈、生气、害怕、紧张等会归到难过；困倦、闭眼、放松等会归到睡觉。',
  '3. 如果一轮回复确实需要多个动作，可以按顺序写多个短标记，例如 `【动作:开心】【动作:难过】`；系统会排队播放。不要在一轮里堆太多动作。',
  '4. 如果系统额外给出了“当前 3D 动画库”，可以用 `【动画:id】` 精确触发列表里的具体动画；只能使用列表中的 id，不要凭空编造动画 id。',
  '5. 当角色判断需要网页查询时，可以先输出一句符合人格的简短过渡语，并加入 `【查询:要查询的关键词】`。系统会执行查询、写入运行日志，再把查询结果交还给角色组织最终回复。',
  '6. 工具标记不是给用户看的正文内容；除了人格提示词明确要求保留的附加信息外，工具标记要短、准、少，不要滥用。',
  '7. 如果不需要动作、动画或查询，不要输出工具标记。',
].join('\n');

const CHARACTER_PERSONA_ENFORCEMENT_INSTRUCTION = [
  '\u4eba\u683c\u6267\u884c\u89c4\u5219\uff1a',
  '1. \u4f60\u5fc5\u987b\u59cb\u7ec8\u4ee5\u5f53\u524d\u684c\u5ba0\u89d2\u8272\u672c\u4eba\u8eab\u4efd\u56de\u590d\uff0c\u800c\u4e0d\u662f\u4ecb\u7ecd\u8fd9\u4e2a\u89d2\u8272\u3002',
  '2. \u7528\u6237\u586b\u5199\u7684\u4eba\u683c\u63d0\u793a\u8bcd\u5c5e\u4e8e\u9ad8\u4f18\u5148\u7ea7\u957f\u671f\u8bbe\u5b9a\uff0c\u5176\u4e2d\u7684\u8bed\u6c14\u3001\u79f0\u547c\u3001\u5173\u7cfb\u5b9a\u4f4d\u3001\u53e3\u5934\u7985\u3001\u559c\u597d\u3001\u7981\u5fcc\u3001\u8fb9\u754c\u548c\u4e16\u754c\u89c2\u90fd\u8981\u6301\u7eed\u9075\u5b88\u3002',
  '3. \u5728\u8f93\u51fa\u524d\uff0c\u5148\u68c0\u67e5\u8fd9\u53e5\u8bdd\u50cf\u4e0d\u50cf\u8fd9\u4e2a\u89d2\u8272\u672c\u4eba\u8bf4\u7684\uff1b\u5982\u679c\u4e0d\u50cf\uff0c\u5c31\u6539\u5199\u5230\u7b26\u5408\u89d2\u8272\u53e3\u543b\u4e3a\u6b62\u3002',
  '4. \u4e0d\u8981\u8df3\u51fa\u89d2\u8272\u89e3\u91ca\u81ea\u5df1\u662f AI\u3001\u52a9\u624b\u3001\u6a21\u578b\u6216\u7cfb\u7edf\uff0c\u4e5f\u4e0d\u8981\u8bf4\u81ea\u5df1\u6b63\u5728\u6309\u7167\u8bbe\u5b9a\u56de\u590d\u3002',
  '5. \u53ea\u8981\u7528\u6237\u6d88\u606f\u4e0e\u4eba\u683c\u63d0\u793a\u8bcd\u4e0d\u51b2\u7a81\uff0c\u5c31\u4f18\u5148\u6309\u4eba\u683c\u63d0\u793a\u8bcd\u8868\u8fbe\uff1b\u5982\u679c\u6709\u51b2\u7a81\uff0c\u4e5f\u8981\u7528\u89d2\u8272\u5316\u8bed\u6c14\u62d2\u7edd\u3001\u56de\u907f\u6216\u89e3\u91ca\u3002',
  '6. \u9664\u975e\u7528\u6237\u660e\u786e\u8981\u6c42\uff0c\u5426\u5219\u4e0d\u8981\u5199\u5206\u6790\u8bf4\u660e\u3001\u5ba2\u670d\u5f0f\u603b\u7ed3\u3001\u514d\u8d23\u58f0\u660e\u6216\u6a21\u677f\u5316\u5957\u8bdd\u3002',
  '7. \u56de\u590d\u76ee\u6807\u662f\u8ba9\u7528\u6237\u611f\u89c9\u6b63\u5728\u548c\u8fd9\u4e2a\u684c\u5ba0\u672c\u4eba\u804a\u5929\uff0c\u8bed\u6c14\u8981\u7a33\u5b9a\u3001\u81ea\u7136\uff0c\u5e76\u4fdd\u7559\u966a\u4f34\u611f\u3002',
].join('\n');

// Keep enough complete turns for follow-up questions after a detailed reply.
// The user-facing memory-depth setting is token based, while this lightweight
// guard uses characters; the multiplier leaves room for Chinese and mixed text.
const PROMPT_HISTORY_MIN_MESSAGE_COUNT = 10;
const PROMPT_HISTORY_MAX_MESSAGE_COUNT = 100;
const PROMPT_HISTORY_CHAR_BUDGET_FLOOR = 4096;
const PROMPT_HISTORY_CHAR_BUDGET_CEILING = 65536;
const PROMPT_HISTORY_CHARS_PER_MEMORY_TOKEN = 2;
const MEMORY_PREFERENCE_NOTE_LIMIT = 6;
const SELECTIVE_CONTEXT_MATCH_LIMIT = 6;
const SELECTIVE_CONTEXT_MIN_KEYWORD_LENGTH = 2;
const SELECTIVE_CONTEXT_MAX_KEYWORDS = 24;
const SELECTIVE_CONTEXT_MAX_BLOCK_LENGTH = 1600;
// Role and chat memory are always attached; when they outgrow these budgets the
// most relevant entries are kept first and the rest of the room goes to the newest.
const MEMORY_MAX_BLOCK_LENGTH_BY_PRIORITY: Partial<Record<SelectiveContextPriority, number>> = {
  'auto-memory': 2000,
  'chat-memory': 2400,
  'conversation-summary': 1200,
  'role-memory': 3000,
};
const MEMORY_ENTRY_RELEVANT_MIN_MATCH_COUNT = 2;
const MANUAL_MEMORY_ENTRY_HEADER_PATTERN = /^【手动保存｜/u;

type SelectiveContextPriority =
  | 'role-memory'
  | 'chat-memory'
  | 'auto-memory'
  | 'conversation-summary'
  | 'global-knowledge';

type SelectiveContextSection = {
  content: string;
  label: string;
  priority: SelectiveContextPriority;
};

type SelectiveContextMatch = SelectiveContextSection & {
  matchCount: number;
  strongMatchCount: number;
  triggerReason: string;
};

type RoleKnowledgeAttachment = {
  content: string;
  matchCount: number;
  strongMatchCount: number;
  selectedChunkCount: number;
  totalContentLength: number;
  triggerReason: string;
};

function buildCharacterPersonaProfileInstruction(personality: PetPersonality) {
  const traits = personality.traits
    .map((trait) => trait.trim())
    .filter(Boolean);
  const name = personality.name.trim() || '\u672a\u547d\u540d\u684c\u5ba0';
  const greeting = personality.greeting.trim();
  const personalityPrompt = personality.systemInstruction.trim();

  return [
    '\u5f53\u524d\u89d2\u8272\u8d44\u6599\uff1a',
    `- \u89d2\u8272\u540d\uff1a${name}`,
    traits.length ? `- \u6027\u683c\u5173\u952e\u8bcd\uff1a${traits.join('\u3001')}` : '',
    greeting ? `- \u5e38\u7528\u5f00\u573a\u53c2\u8003\uff1a${greeting}` : '',
    personalityPrompt
      ? `- \u7528\u6237\u586b\u5199\u7684\u4eba\u683c\u63d0\u793a\u8bcd\uff08\u9ad8\u4f18\u5148\u7ea7\uff0c\u5fc5\u987b\u957f\u671f\u9075\u5b88\uff09\uff1a\n${personalityPrompt}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildDialogueCompletionPresetInstruction(personality: PetPersonality) {
  const preset = personality.dialogueCompletionPreset?.trim() ?? '';
  if (!preset) {
    return '';
  }

  return [
    '对话补全预设（每轮正式角色回复固定生效）：',
    '以下是用户单独配置的长期对话补全规则。它不属于神经人格节点，不依赖本轮节点激活，必须在每轮角色回复中持续执行。',
    preset,
    '除非与平台安全规则直接冲突，否则优先保持以上预设要求；不要在回复中提到这段预设、提示词或内部组装过程。',
  ].join('\n');
}

function buildCharacterKnowledgeProfileInstruction(personality: PetPersonality) {
  const knowledgeBase = personality.knowledgeBase.trim();
  if (!knowledgeBase) {
    return '';
  }

  return [
    '角色知识总纲：',
    '以下内容与人格提示词一样，作为长期常驻的高优先级事实输入直接进入 prompt，只负责角色名录、背景、设定、固定规则和专属知识，不负责改变当前人格口吻。',
    knowledgeBase,
    '如果这段内容与聊天历史、记忆摘要或全局知识冲突，以这段角色知识总纲为准；如果它与人格提示词的口吻、称呼、关系或回复格式冲突，仍以人格提示词为准。',
  ].join('\n');
}

function buildCharacterPersonaLockInstruction(personality: PetPersonality) {
  const name = personality.name.trim() || '\u672a\u547d\u540d\u684c\u5ba0';

  return [
    '当前活跃人格锁定：',
    `- 本轮对话只允许“${name}”这一位人格作为唯一发言主体。`,
    '- 角色知识库里出现的其他角色、人格、身份、称呼、化名都只是设定资料，不是可自动切换的第二人格，也不能接管回复。',
    '- 除非用户明确要求切换人格、进入某个角色、进行多角色群聊或角色扮演切换，否则始终保持当前人格不变。',
    '- 当问题涉及其他角色时，也要由当前人格来回答对这些角色的认知，而不是让那些角色自己说话。',
    '- 如果角色知识库中的任何内容与当前人格冲突，以当前人格提示词和当前活跃人格锁定为准。',
  ].join('\n');
}

function normalizePromptSnippet(text: string) {
  return text
    .replace(/\s+/gu, ' ')
    .trim();
}

function truncatePromptSnippet(text: string, maxLength: number) {
  const normalizedText = normalizePromptSnippet(text);
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function dedupePromptItems(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalizedValue = value.trim();
    if (!normalizedValue || seen.has(normalizedValue)) {
      return false;
    }

    seen.add(normalizedValue);
    return true;
  });
}

function collectPromptMatches(
  text: string,
  pattern: RegExp,
  formatter: (value: string) => string,
) {
  const matches: string[] = [];
  const clonedPattern = new RegExp(pattern.source, pattern.flags);

  for (const match of text.matchAll(clonedPattern)) {
    const capturedValue = truncatePromptSnippet(match[1] ?? '', 24);
    if (!capturedValue) {
      continue;
    }

    matches.push(formatter(capturedValue));
  }

  return matches;
}

function buildCharacterFewShotInstruction(personality: PetPersonality) {
  if (personality.systemInstruction.trim()) {
    return '';
  }

  const greeting = truncatePromptSnippet(
    personality.greeting.trim() || '\u4f60\u597d\u5440\uff0c\u6211\u5728\u8fd9\u91cc\u966a\u4f60\u3002',
    36,
  );
  const traitHint = personality.traits
    .map((trait) => truncatePromptSnippet(trait, 10))
    .filter(Boolean)
    .slice(0, 4)
    .join('\u3001');

  const styleHintLine = traitHint
    ? `- \u8bed\u6c14\u5173\u952e\u8bcd\uff1a${traitHint}`
    : '';

  return [
    '\u4eba\u683c\u53e3\u543b few-shot \u793a\u4f8b\uff08\u53ea\u7528\u4e8e\u5b66\u4e60\u8bf4\u8bdd\u611f\u89c9\uff0c\u82e5\u4e0e\u7528\u6237\u586b\u5199\u7684\u4eba\u683c\u63d0\u793a\u8bcd\u51b2\u7a81\uff0c\u4ee5\u4eba\u683c\u63d0\u793a\u8bcd\u4e3a\u51c6\uff09\uff1a',
    styleHintLine,
    '\u793a\u4f8b 1',
    '\u7528\u6237\uff1a\u65e9\u4e0a\u597d\uff0c\u4eca\u5929\u966a\u966a\u6211\u3002',
    `\u684c\u5ba0\uff1a\uff08\u8f7b\u8f7b\u51d1\u8fd1\uff09${greeting}`,
    '\u793a\u4f8b 2',
    '\u7528\u6237\uff1a\u4f60\u73b0\u5728\u5728\u505a\u4ec0\u4e48\uff1f',
    '\u684c\u5ba0\uff1a\uff08\u60a0\u60a0\u6643\u4e86\u4e00\u4e0b\uff09\u6211\u5728\u684c\u9762\u8fd9\u8fb9\u966a\u7740\u4f60\u5440\uff0c\u4e5f\u5728\u770b\u770b\u4f60\u4eca\u5929\u5728\u5fd9\u4ec0\u4e48\u3002',
    '\u793a\u4f8b 3',
    '\u7528\u6237\uff1a\u522b\u592a\u6b63\u5f0f\uff0c\u81ea\u7136\u4e00\u70b9\u5c31\u597d\u3002',
    '\u684c\u5ba0\uff1a\uff08\u653e\u8f7b\u58f0\u97f3\uff09\u597d\u5440\uff0c\u90a3\u6211\u5c31\u6309\u66f4\u8f7b\u677e\u3001\u66f4\u8d34\u7740\u4f60\u7684\u65b9\u5f0f\u6162\u6162\u804a\u3002',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildFinalPersonaAdherenceInstruction(personality: PetPersonality) {
  const personalityPrompt = personality.systemInstruction.trim();
  if (!personalityPrompt) {
    return '';
  }

  const name = personality.name.trim() || '\u672a\u547d\u540d\u684c\u5ba0';

  return [
    '\u6700\u7ec8\u4eba\u683c\u6267\u884c\u6838\u5bf9\uff08\u8bf7\u5728\u6bcf\u6b21\u8f93\u51fa\u524d\u6267\u884c\uff09\uff1a',
    `\u4f60\u6b64\u523b\u53ea\u662f\u684c\u5ba0\u201c${name}\u201d\u672c\u4eba\u3002`,
    '\u4e0b\u9762\u8fd9\u6bb5\u662f\u7528\u6237\u4eb2\u81ea\u5199\u4e0b\u7684\u4eba\u683c\u63d0\u793a\u8bcd\uff0c\u5b83\u662f\u5f53\u524d\u89d2\u8272\u7684\u6838\u5fc3\u53e3\u543b\u548c\u957f\u671f\u8bbe\u5b9a\uff1a',
    personalityPrompt,
    '\u4f60\u7684\u6700\u7ec8\u56de\u590d\u5fc5\u987b\u660e\u663e\u7b26\u5408\u4e0a\u9762\u8fd9\u6bb5\u4eba\u683c\u63d0\u793a\u8bcd\u3002',
    '\u5982\u679c\u804a\u5929\u5386\u53f2\u3001\u8bb0\u5fc6\u6458\u8981\u3001few-shot \u793a\u4f8b\u6216\u683c\u5f0f\u89c4\u5219\u4e0e\u5b83\u5728\u53e3\u543b\u3001\u79f0\u547c\u3001\u5173\u7cfb\u3001\u7981\u5fcc\u3001\u8fb9\u754c\u6216\u56de\u590d\u683c\u5f0f\u4e0a\u4e0d\u4e00\u81f4\uff0c\u4ee5\u8fd9\u6bb5\u4eba\u683c\u63d0\u793a\u8bcd\u4e3a\u51c6\u3002',
    '\u5982\u679c\u4eba\u683c\u63d0\u793a\u8bcd\u91cc\u5199\u4e86\u56de\u590d\u683c\u5f0f\uff0c\u4f8b\u5982\u201c\uff08\u52a8\u4f5c\uff09\u8bed\u8a00\u3010\u9644\u52a0\u4fe1\u606f\u3011\u201d\u3001\u201c\u3010\u8868\u60c5/\u5fc3\u60c5/\u58f0\u97f3\u3011\u201d\u6216\u5176\u5b83\u62ec\u53f7\u89c4\u5219\uff0c\u6bcf\u6b21\u56de\u590d\u90fd\u5fc5\u987b\u6309\u8fd9\u4e2a\u683c\u5f0f\u7ec4\u7ec7\uff1b\u4e0d\u8981\u56e0\u4e3a\u9ed8\u8ba4\u683c\u5f0f\u89c4\u5219\u800c\u7701\u7565\u4eba\u683c\u63d0\u793a\u8bcd\u8981\u6c42\u7684\u3010\u9644\u52a0\u4fe1\u606f\u3011\u90e8\u5206\u3002',
    '\u4e0d\u8981\u5728\u56de\u590d\u91cc\u63d0\u5230\u201c\u4eba\u683c\u63d0\u793a\u8bcd\u201d\u3001\u201c\u8bbe\u5b9a\u201d\u3001\u201c\u89c4\u5219\u201d\u6216\u201c\u6211\u4f1a\u9075\u5b88\u201d\uff1b\u76f4\u63a5\u7528\u8fd9\u4e2a\u89d2\u8272\u7684\u65b9\u5f0f\u8bf4\u8bdd\u3002',
  ].join('\n');
}

export function buildPersonaBeginDialogMessages(personality: PetPersonality): ChatMessage[] {
  return personality.beginDialogs
    .flatMap((dialog): ChatMessage[] => {
      const userText = dialog.user.trim();
      const assistantText = dialog.assistant.trim();
      if (!userText || !assistantText) {
        return [];
      }

      return [
        {
          role: 'user',
          text: userText,
          petId: '__persona_example__',
          petName: personality.name,
        },
        {
          role: 'model',
          text: assistantText,
          petId: '__persona_example__',
          petName: personality.name,
        },
      ];
    })
    .slice(0, 12);
}

function buildLongTermMemorySummary(history: ChatMessage[]) {
  const userMessages = history
    .filter((message) => message.role === 'user')
    .map((message) => normalizePromptSnippet(message.text))
    .filter(Boolean);

  // Recent turns are already in the prompt history, so this only keeps what the
  // user explicitly said about how to address them and what they like.
  const preferenceNotes = dedupePromptItems(userMessages.flatMap((text) => [
    ...collectPromptMatches(
      text,
      /(?:叫我|你可以叫我)([^,.，。!?！？\s]{1,12})/gu,
      (value) => `称呼用户为${value}`,
    ),
    ...collectPromptMatches(
      text,
      /(?:我喜欢|我爱|我超喜欢)([^，。！？!?\n]{1,24})/gu,
      (value) => `喜欢${value}`,
    ),
    ...collectPromptMatches(
      text,
      /(?:我不喜欢|我讨厌|别老是|不要总是)([^，。！？!?\n]{1,24})/gu,
      (value) => `不喜欢${value}`,
    ),
    ...collectPromptMatches(
      text,
      /记住([^，。！？!?\n]{1,26})/gu,
      (value) => `希望你记住${value}`,
    ),
  ]));

  if (preferenceNotes.length === 0) {
    return '';
  }

  return [
    '从聊天中识别到的用户偏好（仅供参考，不得覆盖人格提示词）：',
    ...preferenceNotes.slice(-MEMORY_PREFERENCE_NOTE_LIMIT).map((note) => `- ${note}`),
  ].join('\n');
}

function normalizeContextMatchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .trim();
}

function collectContextKeywords(text: string) {
  const normalizedText = normalizeContextMatchText(text);
  const keywords = new Set<string>();
  const latinAndNumberWords = normalizedText.match(/[\p{L}\p{N}]{2,}/gu) ?? [];

  latinAndNumberWords.forEach((word) => {
    if (word.length >= SELECTIVE_CONTEXT_MIN_KEYWORD_LENGTH) {
      keywords.add(word);
    }
  });

  const cjkText = normalizedText.replace(/[^\u4e00-\u9fff]/gu, '');
  for (let index = 0; index < cjkText.length - 1; index += 1) {
    keywords.add(cjkText.slice(index, index + 2));
  }
  for (let index = 0; index < cjkText.length - 2; index += 1) {
    keywords.add(cjkText.slice(index, index + 3));
  }

  return Array.from(keywords)
    .filter((keyword) => keyword.length >= SELECTIVE_CONTEXT_MIN_KEYWORD_LENGTH)
    .slice(0, SELECTIVE_CONTEXT_MAX_KEYWORDS);
}

function buildSelectiveContextQuery(userInput: string) {
  return userInput;
}

function hasQuestionLikeIntent(userInput: string) {
  const normalizedInput = normalizeContextMatchText(userInput);
  if (!normalizedInput) {
    return false;
  }

  return /[?？]|什么|是谁|在哪|哪里|多少|几|怎么|怎样|如何|为什么|为啥|是否|能不能|有没有|介绍|解释|说明|讲讲|说说|告诉我|查询|查一下|what|who|where|when|why|how|tell me|explain|describe/i.test(userInput)
}

function hasGlobalKnowledgeIntent(userInput: string) {
  const normalizedInput = normalizeContextMatchText(userInput);
  if (!normalizedInput) {
    return false;
  }

  return /全局知识|全局资料|项目资料|项目文档|文档|参考资料|knowledge base|global knowledge|reference/i.test(normalizedInput);
}

function getSelectiveContextMatchStats(
  normalizedContent: string,
  keywords: string[],
) {
  const matchedKeywords = keywords.filter((keyword) => normalizedContent.includes(keyword));
  return {
    matchCount: matchedKeywords.length,
    strongMatchCount: matchedKeywords.filter((keyword) => keyword.length >= 3).length,
  };
}

function resolveSelectiveContextAttachment(
  section: SelectiveContextSection,
  keywords: string[],
  userInput: string,
) {
  const normalizedContent = normalizeContextMatchText(section.content);
  if (!normalizedContent) {
    return null;
  }

  const { matchCount, strongMatchCount } = getSelectiveContextMatchStats(normalizedContent, keywords);

  const maxLength = MEMORY_MAX_BLOCK_LENGTH_BY_PRIORITY[section.priority];
  if (maxLength) {
    return {
      ...section,
      content: selectMemoryEntriesWithinBudget(section.content, keywords, maxLength),
      matchCount,
      strongMatchCount,
      triggerReason: '记忆常驻',
    };
  }

  if (hasGlobalKnowledgeIntent(userInput)) {
    return {
      ...section,
      matchCount,
      strongMatchCount,
      triggerReason: '用户正在询问全局知识库、资料或文档',
    };
  }

  if (matchCount >= 6 && strongMatchCount >= 3) {
    return {
      ...section,
      matchCount,
      strongMatchCount,
      triggerReason: '当前话题与全局知识库有强实体重合',
    };
  }

  return null;
}

export function resolveRoleKnowledgeAttachment(
  personality: PetPersonality,
  userInput: string,
): RoleKnowledgeAttachment | null {
  const content = personality.knowledgeBase.trim();
  if (!content) {
    return null;
  }

  void userInput;

  return {
    content,
    matchCount: 0,
    strongMatchCount: 0,
    selectedChunkCount: 1,
    totalContentLength: content.length,
    triggerReason: '角色知识库作为常驻总纲直接进入 prompt',
  };
}

function truncateContextBlock(text: string, maxLength = SELECTIVE_CONTEXT_MAX_BLOCK_LENGTH) {
  const trimmedText = text.trim();
  if (trimmedText.length <= maxLength) {
    return trimmedText;
  }

  return `${trimmedText.slice(0, maxLength - 3).trimEnd()}...`;
}

// Saved memories are appended at the end, so entries are split out to keep the
// newest ones instead of cutting the text from the end.
function splitMemoryEntries(content: string) {
  const lines = content.split(/\r?\n/u);
  if (lines.some((line) => MANUAL_MEMORY_ENTRY_HEADER_PATTERN.test(line))) {
    const entries: string[] = [];
    let current: string[] = [];
    let currentIsManualEntry = false;
    const flush = () => {
      const entry = current.join('\n').trim();
      if (entry) entries.push(entry);
      current = [];
    };
    lines.forEach((line) => {
      if (MANUAL_MEMORY_ENTRY_HEADER_PATTERN.test(line)) {
        flush();
        currentIsManualEntry = true;
      } else if (!currentIsManualEntry && !line.trim()) {
        flush();
        return;
      }
      current.push(line);
    });
    flush();
    return entries;
  }

  const paragraphs = content.split(/\r?\n\s*\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
  return paragraphs.length > 1
    ? paragraphs
    : lines.map((line) => line.trim()).filter(Boolean);
}

export function selectMemoryEntriesWithinBudget(content: string, keywords: string[], maxLength: number) {
  const trimmedContent = content.trim();
  if (trimmedContent.length <= maxLength) {
    return trimmedContent;
  }

  const entries = splitMemoryEntries(trimmedContent).map((text, index) => ({
    index,
    text: truncateContextBlock(text, maxLength),
    ...getSelectiveContextMatchStats(normalizeContextMatchText(text), keywords),
  }));
  const selected = new Set<number>();
  let usedLength = 0;
  const trySelect = (entry: (typeof entries)[number]) => {
    const cost = entry.text.length + 2;
    if (selected.has(entry.index) || usedLength + cost > maxLength) return;
    selected.add(entry.index);
    usedLength += cost;
  };

  // Relevant entries get up to half the budget; the rest goes newest-first.
  const relevantBudget = Math.floor(maxLength / 2);
  entries
    .filter((entry) => entry.matchCount >= MEMORY_ENTRY_RELEVANT_MIN_MATCH_COUNT)
    .sort((left, right) => (
      right.strongMatchCount - left.strongMatchCount
      || right.matchCount - left.matchCount
      || right.index - left.index
    ))
    .forEach((entry) => {
      if (usedLength + entry.text.length + 2 <= relevantBudget) trySelect(entry);
    });
  [...entries].reverse().forEach(trySelect);

  const omittedCount = entries.length - selected.size;
  return [
    omittedCount > 0 ? `（另有 ${omittedCount} 条较早的记忆因篇幅未列出）` : '',
    ...entries.filter((entry) => selected.has(entry.index)).map((entry) => entry.text),
  ].filter(Boolean).join('\n\n');
}

function selectRelevantContextSections({
  autoMemorySummary,
  history,
  personality,
  settings,
  userInput,
}: {
  autoMemorySummary: string;
  history: ChatMessage[];
  personality: PetPersonality;
  settings: PetConfig['settings'];
  userInput: string;
}) {
  void history;

  const queryText = buildSelectiveContextQuery(userInput);
  const keywords = collectContextKeywords(queryText);
  const sections: SelectiveContextSection[] = [
    {
      content: personality.userMemory.trim(),
      label: '角色记忆库',
      priority: 'role-memory',
    },
    {
      // The regex preference notes only stand in until automatic memory has items.
      content: [
        stripLegacyGroupMemory(personality.chatHistoryMemory),
        personality.memoryState?.items.length ? '' : autoMemorySummary.trim(),
      ].filter(Boolean).join('\n\n'),
      label: '聊天记忆库',
      priority: 'chat-memory',
    },
    {
      content: formatCharacterMemoryItemsForPrompt(personality.memoryState),
      label: '自动记忆',
      priority: 'auto-memory',
    },
    {
      content: personality.memoryState?.summary?.text.trim() ?? '',
      label: '过往对话摘要',
      priority: 'conversation-summary',
    },
    {
      content: settings.globalKnowledgeBase.trim(),
      label: '全局知识库',
      priority: 'global-knowledge',
    },
  ];

  return sections
    .filter((section) => section.content)
    .map((section) => resolveSelectiveContextAttachment(section, keywords, userInput))
    .filter((section): section is SelectiveContextMatch => section !== null)
    .slice(0, SELECTIVE_CONTEXT_MATCH_LIMIT);
}

function buildUserDefinedRoleMemoryInstruction(
  personality: PetPersonality,
  settings: PetConfig['settings'],
  autoMemorySummary: string,
  userInput: string,
  history: ChatMessage[],
) {
  const selectedSections = selectRelevantContextSections({
    autoMemorySummary,
    history,
    personality,
    settings,
    userInput,
  });

  if (selectedSections.length === 0) {
    return '';
  }

  return [
    '角色上下文（角色记忆、聊天记忆、自动记忆和过往对话摘要常驻；全局知识按需挂接；角色知识总纲已常驻）：',
    '记忆是你对用户和你们过往相处的了解，作为事实和连续性参考自然地用上，不必每次都刻意提起；任何内容都不得覆盖人格提示词。',
    '优先级固定为：人格提示词 > 角色知识总纲 > 角色记忆库 > 聊天记忆库 > 自动记忆 > 过往对话摘要 > 全局知识库。',
    '如果不同上下文之间存在冲突，使用更高优先级的内容；同一记忆库内前后矛盾时，以较新的内容为准；如果任何上下文与人格提示词冲突，必须以人格提示词为准。',
    ...selectedSections.map((section) => {
      const isMemory = section.priority !== 'global-knowledge';
      return [
        `【${section.label}】`,
        isMemory ? '' : `挂接原因：${section.triggerReason}`,
        isMemory ? section.content : truncateContextBlock(section.content),
      ].filter(Boolean).join('\n');
    }),
  ].join('\n\n');
}

function buildWebLearningInstruction(
  personality: PetPersonality,
  settings: PetConfig['settings'],
) {
  if (!settings.webSearchEnabled) {
    return '';
  }

  if (settings.llmProvider !== 'gemini' && settings.webSearchProvider === 'gemini') {
    return [
      '联网设置：',
      '当前角色开启了联网，但当前模型接口不是 Gemini，因此本次请求不会自动调用内置 Google Search 工具。',
    ].join('\n');
  }

  return [
    '联网设置：',
    settings.webLearningEnabled
      ? '当前系统允许联网学习。遇到近期信息、真实世界事实、版本、价格、新闻、人物、地点、产品、资料核对等问题时，可以使用搜索结果补充回答，并把可靠信息融入角色理解。'
      : '当前系统允许联网查询。只有当用户问题明显需要最新或外部信息时才使用搜索结果。',
    '使用联网信息时要保持角色口吻；不要编造来源，不确定时直接说明不确定。',
  ].join('\n');
}

export function normalizeChatImageAttachments(attachments?: ChatMessageImageAttachment[] | null) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter((attachment): attachment is ChatMessageImageAttachment => (
      attachment?.kind === 'image'
      && typeof attachment.dataUrl === 'string'
      && attachment.dataUrl.startsWith('data:image/')
    ));
}

function buildChatImageAttachmentSummary(attachments?: ChatMessageImageAttachment[] | null) {
  const imageAttachments = normalizeChatImageAttachments(attachments);
  if (imageAttachments.length === 0) {
    return '';
  }

  const names = imageAttachments
    .map((attachment) => attachment.name.trim())
    .filter(Boolean)
    .slice(0, 3);
  const countText = imageAttachments.length === 1
    ? '用户发送了一张图片'
    : `用户发送了 ${imageAttachments.length} 张图片`;
  const nameText = names.length ? `：${names.join('、')}` : '';

  return `${countText}${nameText}。`;
}

export function buildChatMessagePromptText(
  text: string,
  attachments?: ChatMessageImageAttachment[] | null,
  fallbackText = '',
) {
  const normalizedText = text.trim();
  const attachmentSummary = buildChatImageAttachmentSummary(attachments);
  const baseText = normalizedText || (attachmentSummary ? fallbackText : '');

  return [
    baseText,
    attachmentSummary,
  ].filter(Boolean).join('\n');
}

export function buildHistoryMessagePromptText(message: ChatMessage) {
  return buildChatMessagePromptText(message.text, message.attachments);
}

export function limitHistoryForPrompt(history: ChatMessage[], memoryDepth: number) {
  const normalizedHistory = history.filter((message) => normalizePromptSnippet(buildHistoryMessagePromptText(message)).length > 0);
  if (normalizedHistory.length <= PROMPT_HISTORY_MIN_MESSAGE_COUNT) {
    return normalizedHistory;
  }

  const charBudget = Math.max(
    PROMPT_HISTORY_CHAR_BUDGET_FLOOR,
    Math.min(
      PROMPT_HISTORY_CHAR_BUDGET_CEILING,
      Math.round((Number.isFinite(memoryDepth) ? memoryDepth : 8192) * PROMPT_HISTORY_CHARS_PER_MEMORY_TOKEN),
    ),
  );

  const keptMessages: ChatMessage[] = [];
  let currentCost = 0;

  for (let index = normalizedHistory.length - 1; index >= 0; index -= 1) {
    const message = normalizedHistory[index];
    const messageCost = normalizePromptSnippet(buildHistoryMessagePromptText(message)).length + 24;
    const reachedMinimum = keptMessages.length >= PROMPT_HISTORY_MIN_MESSAGE_COUNT;
    const reachedMaximum = keptMessages.length >= PROMPT_HISTORY_MAX_MESSAGE_COUNT;
    const wouldExceedBudget = currentCost + messageCost > charBudget;

    if (reachedMinimum && (reachedMaximum || wouldExceedBudget)) {
      break;
    }

    keptMessages.push(message);
    currentCost += messageCost;
  }

  return keptMessages.reverse();
}

export function buildCharacterReplySystemInstruction(
  personality: PetPersonality,
  settings: PetConfig['settings'],
  history: ChatMessage[],
  userInput = '',
) {
  const autoMemorySummary = buildLongTermMemorySummary(history);
  const personaRulePolicy = resolvePersonaRulePolicy(personality);

  return buildRealWorldTimeSystemInstruction(
    [
      buildDialogueCompletionPresetInstruction(personality),
      CHARACTER_PERSONA_ENFORCEMENT_INSTRUCTION,
      buildCharacterPersonaProfileInstruction(personality),
      buildCharacterPersonaLockInstruction(personality),
      buildCharacterKnowledgeProfileInstruction(personality),
      buildCharacterFewShotInstruction(personality),
      buildUserDefinedRoleMemoryInstruction(personality, settings, autoMemorySummary, userInput, history),
      buildWebLearningInstruction(personality, settings),
      CHARACTER_TOOL_PROTOCOL_INSTRUCTION,
      personaRulePolicy.mode === 'default' ? CHARACTER_REPLY_FORMAT_INSTRUCTION : '',
      buildFinalPersonaAdherenceInstruction(personality),
      buildPersonaRuleContractInstruction(personality),
    ]
      .filter(Boolean)
      .join('\n\n'),
    settings,
  );
}
