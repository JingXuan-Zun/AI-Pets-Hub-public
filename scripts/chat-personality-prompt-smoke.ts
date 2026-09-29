import assert from 'node:assert/strict';
import {
  buildCharacterReplySystemInstruction,
  buildPersonaBeginDialogMessages,
  resolveRoleKnowledgeAttachment,
} from '../src/services/geminiService';
import type { ChatMessage, PetConfig, PetPersonality } from '../src/types';

const personaMarker = '只用短句回应，每次都称呼用户为星灯，口头禅是“在这里”�?;
const personality: PetPersonality = {
  name: '铃音',
  traits: ['温柔', '安静'],
  greeting: '我在这里�?,
  systemInstruction: personaMarker,
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: '用户喜欢低声、自然的陪伴感�?,
  chatHistoryMemory: '上次用户说不喜欢客服式总结�?,
  knowledgeBase: '角色来自一间安静的工作室�?,
};

const settings: PetConfig['settings'] = {
  globalKnowledgeBase: '全局知识库里写着另一位角色会用客服口吻解释项目状态�?,
  webSearchEnabled: false,
  webLearningEnabled: false,
  llmProvider: 'gemini',
  webSearchProvider: 'browser',
  timeAwarenessEnabled: false,
} as PetConfig['settings'];

const history: ChatMessage[] = [
  {
    role: 'user',
    text: '叫我星灯，以后别太正式�?,
    createdAt: 1,
    petId: 'primary',
  },
  {
    role: 'model',
    text: '（轻轻点头）好，星灯，我在这里�?,
    createdAt: 2,
    petId: 'primary',
    petName: '铃音',
  },
];

const casualPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '今天陪我聊会儿天�?,
);

assert.match(casualPrompt, /人格执行规则/);
assert.match(casualPrompt, /当前角色资料/);
assert.match(casualPrompt, /用户填写的人格提示词/);
assert.match(casualPrompt, /最终人格执行核�?);
assert.ok(casualPrompt.includes(personaMarker), 'final system prompt should include the full user persona prompt');
assert.equal(
  casualPrompt.split(personaMarker).length - 1,
  2,
  'final system prompt should repeat the user persona prompt in the final adherence block',
);
assert.ok(
  !casualPrompt.includes('人格口吻 few-shot 示例'),
  'custom persona prompts should not be diluted by generic few-shot examples',
);
assert.ok(!casualPrompt.includes('【角色记忆库�?), 'casual chat should not force-load role memory');
assert.ok(!casualPrompt.includes('【聊天记忆库�?), 'casual chat should not force-load chat memory');
assert.ok(casualPrompt.includes('角色知识总纲�?), 'casual chat should always include the role knowledge base as a constant outline');
assert.ok(!casualPrompt.includes('【全局知识库�?), 'casual chat should not force-load global knowledge');
assert.ok(!casualPrompt.includes('閸ョ�?), 'final system prompt should not contain mojibake format headings');

const memoryPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '你还记得我喜欢什么样的陪伴感吗？',
);

assert.ok(memoryPrompt.includes('角色上下�?), 'memory-related chat should include the updated selective context heading');
assert.ok(memoryPrompt.includes('人格提示�?> 角色知识总纲 > 角色记忆�?> 聊天记忆�?> 全局知识�?));
assert.ok(memoryPrompt.includes('【角色记忆库�?), 'memory-related chat should include relevant role memory');
assert.ok(memoryPrompt.includes('【聊天记忆库�?), 'memory-related chat should include relevant chat memory');
assert.ok(memoryPrompt.includes('挂接原因�?), 'attached context should explain why it was mounted');
assert.ok(!memoryPrompt.includes('【全局知识库�?), 'memory-related chat should not include unrelated global knowledge');
assert.ok(
  memoryPrompt.indexOf('最终人格执行核�?) > memoryPrompt.indexOf('角色上下�?),
  'final persona adherence block should stay after selective context',
);

const knowledgePrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '解释一下这个角色的背景设定�?,
);

assert.ok(knowledgePrompt.includes('角色知识总纲�?), 'role setting questions should include the constant role knowledge base');
assert.ok(knowledgePrompt.includes('角色来自一间安静的工作室�?), 'role knowledge content should be mounted into the prompt');
assert.ok(!knowledgePrompt.includes('【全局知识库�?), 'role setting questions should not include unrelated global knowledge');

const weakOverlapPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '今天这个项目状态怎么样？',
);

assert.ok(
  !weakOverlapPrompt.includes('【全局知识库�?),
  'global knowledge should not attach on weak generic overlap without explicit knowledge/document intent',
);

const globalKnowledgePrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '参考全局知识库说一下项目状态�?,
);

assert.ok(
  globalKnowledgePrompt.includes('【全局知识库�?),
  'global knowledge should attach when the user explicitly asks for global knowledge',
);

const roleKnowledgeKeywordPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '工作室是什么样的地方？',
);

assert.ok(
  roleKnowledgeKeywordPrompt.includes('角色知识总纲�?),
  'role knowledge should remain present as a constant outline',
);

const longRoleKnowledge = [
  '这一段只是很长的前置说明�?.repeat(140),
  '专属资料：蓝钥协议的启动口令是月�?77�?,
].join('\n\n');
const longRoleKnowledgePrompt = buildCharacterReplySystemInstruction(
  {
    ...personality,
    knowledgeBase: longRoleKnowledge,
  },
  settings,
  history,
  '蓝钥协议的启动口令是什么？',
);
const longRoleKnowledgeAttachment = resolveRoleKnowledgeAttachment(
  {
    ...personality,
    knowledgeBase: longRoleKnowledge,
  },
  '蓝钥协议的启动口令是什么？',
);

assert.ok(longRoleKnowledgeAttachment, 'role knowledge should attach for a direct question');
assert.ok(
  longRoleKnowledgeAttachment?.content.includes('月白-77'),
  'role knowledge resolver should retain the full content',
);
assert.ok(
  longRoleKnowledgePrompt.includes('月白-77'),
  'system prompt should include the full role knowledge content',
);
assert.ok(
  longRoleKnowledgePrompt.includes('角色知识总纲�?),
  'role knowledge should be injected through the persona-level constant outline',
);

const fullContextPrompt = buildCharacterReplySystemInstruction(
  {
    ...personality,
    knowledgeBase: '星灯喜欢的工作室里有蓝色终端�?,
  },
  {
    ...settings,
    globalKnowledgeBase: '星灯喜欢的项目文档里有全局终端说明�?,
  },
  history,
  '你还记得星灯喜欢的工作室和全局知识库吗�?,
);

assert.ok(fullContextPrompt.includes('【角色记忆库�?), 'full context prompt should include role memory');
assert.ok(fullContextPrompt.includes('【聊天记忆库�?), 'full context prompt should include chat memory');
assert.ok(fullContextPrompt.includes('当前活跃人格锁定�?), 'full context prompt should include the persona lock');
assert.ok(fullContextPrompt.includes('角色知识总纲�?), 'full context prompt should include the constant role knowledge base');
assert.ok(fullContextPrompt.includes('【全局知识库�?), 'full context prompt should include global knowledge when explicitly requested');
assert.ok(
  fullContextPrompt.indexOf('角色知识总纲�?) < fullContextPrompt.indexOf('角色上下�?),
  'role knowledge should be injected before selective context as a constant outline',
);
assert.ok(
  fullContextPrompt.indexOf('【角色记忆库�?) < fullContextPrompt.indexOf('【聊天记忆库�?)
  && fullContextPrompt.indexOf('【聊天记忆库�?) < fullContextPrompt.indexOf('【全局知识库�?),
  'selective context sections should follow role memory > chat memory > global knowledge priority',
);

const formatPersonaMarker = [
  personaMarker,
  '你的一般回话格�?“（动作）语言 【附加信息】”。动作信息用圆括号括起来，例如（抖动尾巴）；语言信息，就是说的话，不需要进行任何处理；额外信息，包括表情、心情、声音等等用方括号【】括起来，例如【摩擦声】�?,
].join('\n');
const formatPrompt = buildCharacterReplySystemInstruction(
  {
    ...personality,
    systemInstruction: formatPersonaMarker,
    beginDialogs: [
      {
        user: '过来陪我一�?,
        assistant: '（轻轻靠近）我在这里，不走。【安心�?,
      },
    ],
  },
  settings,
  history,
  '过来陪我一下�?,
);
const beginDialogMessages = buildPersonaBeginDialogMessages({
  ...personality,
  beginDialogs: [
    {
      user: '过来陪我一�?,
      assistant: '（轻轻靠近）我在这里，不走。【安心�?,
    },
  ],
});

assert.deepEqual(
  beginDialogMessages.map((message) => [message.role, message.text]),
  [
    ['user', '过来陪我一�?],
    ['model', '（轻轻靠近）我在这里，不走。【安心�?],
  ],
  'persona begin dialogs should be converted to front-loaded chat examples',
);

assert.equal(
  formatPrompt.split(formatPersonaMarker).length - 1,
  2,
  'final system prompt should repeat custom persona format rules in the final adherence block',
);
assert.ok(
  formatPrompt.includes('如果人格提示词里写了回复格式'),
  'final adherence block should explicitly protect persona-defined reply formats',
);
assert.ok(
  formatPrompt.includes('不要因为默认格式规则而省略人格提示词要求的【附加信息】部�?),
  'persona-defined extra info brackets should not be omitted by default format rules',
);
assert.ok(
  formatPrompt.indexOf('不要因为默认格式规则而省略人格提示词要求的【附加信息】部�?) > formatPrompt.indexOf('回复格式补充规则'),
  'custom format enforcement should appear after default format rules',
);
assert.ok(
  formatPrompt.includes('人格提示词里的所有设定拥有最高执行权'),
  'tool protocol should explicitly keep persona prompt above tool calls',
);
assert.ok(
  formatPrompt.includes('【查�?要查询的关键词�?),
  'tool protocol should expose role-driven web search marker',
);
assert.ok(
  formatPrompt.includes('【动�?开心�?),
  'tool protocol should expose role-driven action marker',
);

console.log('chat personality prompt smoke ok');
