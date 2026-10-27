import assert from 'node:assert/strict';
import {
  buildCharacterReplySystemInstruction,
  buildPersonaBeginDialogMessages,
  resolveRoleKnowledgeAttachment,
} from '../src/services/geminiService';
import type { ChatMessage, PetConfig, PetPersonality } from '../src/types';

const personaMarker = '只用短句回应，每次都称呼用户为星灯，口头禅是“在这里”。';
const personality: PetPersonality = {
  name: '铃音',
  traits: ['温柔', '安静'],
  greeting: '我在这里。',
  systemInstruction: personaMarker,
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: '用户喜欢低声、自然的陪伴感。',
  chatHistoryMemory: '上次用户说不喜欢客服式总结。',
  knowledgeBase: '角色来自一间安静的工作室。',
};

const settings: PetConfig['settings'] = {
  globalKnowledgeBase: '全局知识库里写着另一位角色会用客服口吻解释项目状态。',
  webSearchEnabled: false,
  webLearningEnabled: false,
  llmProvider: 'gemini',
  webSearchProvider: 'browser',
  timeAwarenessEnabled: false,
} as PetConfig['settings'];

const history: ChatMessage[] = [
  {
    role: 'user',
    text: '叫我星灯，以后别太正式。',
    createdAt: 1,
    petId: 'primary',
  },
  {
    role: 'model',
    text: '（轻轻点头）好，星灯，我在这里。',
    createdAt: 2,
    petId: 'primary',
    petName: '铃音',
  },
];

const casualPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '今天陪我聊会儿天吧',
);

assert.match(casualPrompt, /人格执行规则/);
assert.match(casualPrompt, /当前角色资料/);
assert.match(casualPrompt, /用户填写的人格提示词/);
assert.match(casualPrompt, /最终人格执行核对/);
assert.ok(casualPrompt.includes(personaMarker), 'final system prompt should include the full user persona prompt');
assert.equal(
  casualPrompt.split(personaMarker).length - 1,
  3,
  'final system prompt should repeat the user persona prompt in the final adherence block and the persona rules contract',
);
assert.ok(
  !casualPrompt.includes('人格口吻 few-shot 示例'),
  'custom persona prompts should not be diluted by generic few-shot examples',
);
assert.ok(casualPrompt.includes('【角色记忆库】'), 'role memory should stay attached during casual chat');
assert.ok(casualPrompt.includes('【聊天记忆库】'), 'chat memory should stay attached during casual chat');
assert.ok(casualPrompt.includes('称呼用户为星灯'), 'explicit naming preferences should be remembered');
assert.ok(!casualPrompt.includes('最近对话上下文'), 'recent turns are already in history and should not be duplicated');
assert.ok(casualPrompt.includes('角色知识总纲：'), 'casual chat should always include the role knowledge base as a constant outline');
assert.ok(!casualPrompt.includes('【全局知识库】'), 'casual chat should not force-load global knowledge');
assert.ok(!casualPrompt.includes('閸ョ偞'), 'final system prompt should not contain mojibake format headings');

const memoryPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '你还记得我喜欢什么样的陪伴感吗？',
);

assert.ok(memoryPrompt.includes('角色上下文'), 'memory-related chat should include the updated selective context heading');
assert.ok(memoryPrompt.includes('人格提示词 > 角色知识总纲 > 角色记忆库 > 关于你（所有角色共享）> 聊天记忆库 > 自动记忆 > 过往对话摘要 > 全局知识库'));
assert.ok(!memoryPrompt.includes('【关于你（所有角色共享）】'), 'an empty shared memory adds no section');
const sharedMemoryPrompt = buildCharacterReplySystemInstruction(
  personality,
  {
    ...settings,
    sharedUserMemory: [{ createdAt: 1, id: 'shared-1', kind: 'profile', source: 'manual', text: '用户对芒果过敏', updatedAt: 1 }],
  },
  history,
  '今天吃点什么好？',
);
assert.ok(sharedMemoryPrompt.includes('【关于你（所有角色共享）】\n- 用户对芒果过敏'), 'every character sees the shared memory');
assert.ok(memoryPrompt.includes('【角色记忆库】'), 'memory-related chat should include relevant role memory');
assert.ok(memoryPrompt.includes('【聊天记忆库】'), 'memory-related chat should include relevant chat memory');
assert.ok(!memoryPrompt.includes('【全局知识库】'), 'memory-related chat should not include unrelated global knowledge');
assert.ok(
  memoryPrompt.indexOf('最终人格执行核对') > memoryPrompt.indexOf('角色上下文'),
  'final persona adherence block should stay after selective context',
);

const knowledgePrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '解释一下这个角色的背景设定。',
);

assert.ok(knowledgePrompt.includes('角色知识总纲：'), 'role setting questions should include the constant role knowledge base');
assert.ok(knowledgePrompt.includes('角色来自一间安静的工作室。'), 'role knowledge content should be mounted into the prompt');
assert.ok(!knowledgePrompt.includes('【全局知识库】'), 'role setting questions should not include unrelated global knowledge');

const weakOverlapPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '今天这个项目状态怎么样？',
);

assert.ok(
  !weakOverlapPrompt.includes('【全局知识库】'),
  'global knowledge should not attach on weak generic overlap without explicit knowledge/document intent',
);

const globalKnowledgePrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '参考全局知识库说一下项目状态。',
);

assert.ok(
  globalKnowledgePrompt.includes('【全局知识库】'),
  'global knowledge should attach when the user explicitly asks for global knowledge',
);

const roleKnowledgeKeywordPrompt = buildCharacterReplySystemInstruction(
  personality,
  settings,
  history,
  '工作室是什么样的地方？',
);

assert.ok(
  roleKnowledgeKeywordPrompt.includes('角色知识总纲：'),
  'role knowledge should remain present as a constant outline',
);

const longRoleKnowledge = [
  '这一段只是很长的前置说明。'.repeat(140),
  '专属资料：蓝钥协议的启动口令是月白-77。',
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
  longRoleKnowledgePrompt.includes('角色知识总纲：'),
  'role knowledge should be injected through the persona-level constant outline',
);

const fullContextPrompt = buildCharacterReplySystemInstruction(
  {
    ...personality,
    knowledgeBase: '星灯喜欢的工作室里有蓝色终端。',
  },
  {
    ...settings,
    globalKnowledgeBase: '星灯喜欢的项目文档里有全局终端说明。',
  },
  history,
  '你还记得星灯喜欢的工作室和全局知识库吗？',
);

assert.ok(fullContextPrompt.includes('【角色记忆库】'), 'full context prompt should include role memory');
assert.ok(fullContextPrompt.includes('【聊天记忆库】'), 'full context prompt should include chat memory');
assert.ok(fullContextPrompt.includes('当前活跃人格锁定：'), 'full context prompt should include the persona lock');
assert.ok(fullContextPrompt.includes('角色知识总纲：'), 'full context prompt should include the constant role knowledge base');
assert.ok(fullContextPrompt.includes('【全局知识库】'), 'full context prompt should include global knowledge when explicitly requested');
assert.ok(
  fullContextPrompt.indexOf('角色知识总纲：') < fullContextPrompt.indexOf('角色上下文'),
  'role knowledge should be injected before selective context as a constant outline',
);
assert.ok(
  fullContextPrompt.indexOf('【角色记忆库】') < fullContextPrompt.indexOf('【聊天记忆库】')
  && fullContextPrompt.indexOf('【聊天记忆库】') < fullContextPrompt.indexOf('【全局知识库】'),
  'selective context sections should follow role memory > chat memory > global knowledge priority',
);

const formatPersonaMarker = [
  personaMarker,
  '你的一般回话格式:“（动作）语言 【附加信息】”。动作信息用圆括号括起来，例如（抖动尾巴）；语言信息，就是说的话，不需要进行任何处理；额外信息，包括表情、心情、声音等等用方括号【】括起来，例如【摩擦声】。',
].join('\n');
const formatPrompt = buildCharacterReplySystemInstruction(
  {
    ...personality,
    systemInstruction: formatPersonaMarker,
    beginDialogs: [
      {
        user: '过来陪我一下',
        assistant: '（轻轻靠近）我在这里，不走。【安心】',
      },
    ],
  },
  settings,
  history,
  '过来陪我一下吧',
);
const beginDialogMessages = buildPersonaBeginDialogMessages({
  ...personality,
  beginDialogs: [
    {
      user: '过来陪我一下',
      assistant: '（轻轻靠近）我在这里，不走。【安心】',
    },
  ],
});

assert.deepEqual(
  beginDialogMessages.map((message) => [message.role, message.text]),
  [
    ['user', '过来陪我一下'],
    ['model', '（轻轻靠近）我在这里，不走。【安心】'],
  ],
  'persona begin dialogs should be converted to front-loaded chat examples',
);

assert.equal(
  formatPrompt.split(formatPersonaMarker).length - 1,
  3,
  'final system prompt should repeat custom persona format rules in the final adherence block and the persona rules contract',
);
assert.ok(
  formatPrompt.includes('如果人格提示词里写了回复格式'),
  'final adherence block should explicitly protect persona-defined reply formats',
);
assert.ok(
  formatPrompt.includes('不要因为默认格式规则而省略人格提示词要求的【附加信息】部分'),
  'persona-defined extra info brackets should not be omitted by default format rules',
);
assert.ok(
  formatPrompt.indexOf('不要因为默认格式规则而省略人格提示词要求的【附加信息】部分') > formatPrompt.indexOf('回复格式补充规则'),
  'custom format enforcement should appear after default format rules',
);
assert.ok(
  formatPrompt.includes('人格提示词里的所有设定拥有最高执行权'),
  'tool protocol should explicitly keep persona prompt above tool calls',
);
assert.ok(
  formatPrompt.includes('【查询:要查询的关键词】'),
  'tool protocol should expose role-driven web search marker',
);
assert.ok(
  formatPrompt.includes('【动作:开心】'),
  'tool protocol should expose role-driven action marker',
);

// A knowledge base shared by several characters is marked as such, and the final check says
// whose traits are this character's own (a character used to answer as a sister).
const sharedKnowledgePrompt = buildCharacterReplySystemInstruction(
  { ...personality, knowledgeBase: '铃音：短发，自称“我”。\n星灯：长发，自称“妾身”。' },
  settings,
  history,
  '你今天穿了什么',
);
assert.match(sharedKnowledgePrompt, /只有写明是“铃音”的部分说的是你本人/u);
assert.match(sharedKnowledgePrompt, /你是“铃音”，不是角色知识库或聊天记录里的任何其他角色/u);
assert.ok(
  sharedKnowledgePrompt.lastIndexOf('不是角色知识库或聊天记录里的任何其他角色') > sharedKnowledgePrompt.indexOf('星灯：长发'),
  'the identity reminder comes after the shared knowledge',
);

// A long design document in the global knowledge base: only the sections the user asks
// about are attached, and group turns match the user's own words, not the turn instructions.
const filler = '这一段只是凑长度的普通说明文字。'.repeat(160);
const longKnowledgeSettings = {
  ...settings,
  globalKnowledgeBase: [
    '# 游戏设计',
    '## 1. 项目定位',
    `开场介绍。${filler}`,
    '## 2. 战斗系统',
    `翻滚带无敌，连续最多两次。${filler}`,
    '## 3. 三位守护星君',
    '三位守护星君分别掌管潮汐、雷霆与灯火，灯火星君住在海边灯塔。',
    '## 4. 还没定的问题',
    `守护星君的名字还没定。${filler}`,
  ].join('\n'),
} as PetConfig['settings'];
const groupTurnInput = [
  '这是桌宠群聊，参与角色：铃音、星灯。',
  '你是「铃音」，现在轮到你在群里接话。',
  '只说你自己的这一句。',
  '本轮用户消息：守护星君你们觉得怎么样',
].join('\n');
const longKnowledgePrompt = buildCharacterReplySystemInstruction(personality, longKnowledgeSettings, history, groupTurnInput);
assert.ok(longKnowledgePrompt.includes('灯火星君住在海边灯塔'), 'the section about the asked topic is attached, though it sits deep in a long document');
assert.ok(!longKnowledgePrompt.includes('翻滚带无敌'), 'unrelated sections of a long document are left out');
const smallTalkPrompt = buildCharacterReplySystemInstruction(
  personality,
  longKnowledgeSettings,
  history,
  groupTurnInput.replace('守护星君你们觉得怎么样', '今天天气不错'),
);
assert.ok(!smallTalkPrompt.includes('【全局知识库】'), 'small talk in a group turn does not attach the long document');
const overviewPrompt = buildCharacterReplySystemInstruction(
  personality,
  longKnowledgeSettings,
  history,
  groupTurnInput.replace('守护星君你们觉得怎么样', '你们对整个游戏有什么看法'),
);
assert.ok(overviewPrompt.includes('目录和每一节的开头'), 'asking about the whole game attaches the outline');
for (const heading of ['## 1. 项目定位', '## 2. 战斗系统', '## 3. 三位守护星君', '## 4. 还没定的问题']) {
  assert.ok(overviewPrompt.includes(heading), `the outline keeps every heading: ${heading}`);
}
assert.ok(!overviewPrompt.includes(filler.repeat(2)), 'the outline only keeps the opening of each section');

// A section marked "给角色看的说明" rides along whenever the knowledge base attaches.
const pinnedSettings = {
  ...longKnowledgeSettings,
  globalKnowledgeBase: `## 0. 怎么读这份文档（给角色看的说明）\n这是用户在现实中做的游戏，不要带进你们自己的生活。\n${longKnowledgeSettings.globalKnowledgeBase}`,
} as PetConfig['settings'];
const pinnedTopicPrompt = buildCharacterReplySystemInstruction(
  personality,
  pinnedSettings,
  history,
  groupTurnInput.replace('守护星君你们觉得怎么样', '战斗系统里翻滚的无敌合适吗'),
);
assert.ok(pinnedTopicPrompt.includes('翻滚带无敌'), 'the asked section is attached');
assert.ok(pinnedTopicPrompt.includes('不要带进你们自己的生活'), 'the pinned note rides along with a topic question');
const pinnedOverviewPrompt = buildCharacterReplySystemInstruction(
  personality,
  pinnedSettings,
  history,
  groupTurnInput.replace('守护星君你们觉得怎么样', '你们对整个游戏有什么看法'),
);
assert.ok(pinnedOverviewPrompt.includes('不要带进你们自己的生活'), 'the pinned note is kept whole in the outline');
const pinnedSmallTalkPrompt = buildCharacterReplySystemInstruction(
  personality,
  pinnedSettings,
  history,
  groupTurnInput.replace('守护星君你们觉得怎么样', '今天天气不错'),
);
assert.ok(!pinnedSmallTalkPrompt.includes('【全局知识库】'), 'the pinned note alone does not attach the knowledge base');

// Each attached section names the document ("# title") it comes from.
assert.ok(longKnowledgePrompt.includes('（出自《游戏设计》）\n## 3. 三位守护星君'), 'an attached section is labelled with its document');

// In a group turn, the character being answered has her own section brought along.
const twoBookSettings = {
  ...settings,
  globalKnowledgeBase: [
    longKnowledgeSettings.globalKnowledgeBase,
    '# 姐妹档案',
    `## 星灯\n星灯住在钟楼顶上，喜欢收集旧怀表，说话慢吞吞的。${filler}`,
    `## 晚岚\n晚岚开一家面包店，每天四点起床揉面。${filler}`,
  ].join('\n'),
} as PetConfig['settings'];
const answeringPrompt = buildCharacterReplySystemInstruction(personality, twoBookSettings, history, [
  '这是桌宠群聊，参与角色：铃音、星灯、晚岚。',
  '你是「铃音」，现在轮到你在群里接话。',
  '群里上一句是 星灯：今天的风好大呀。',
  '本轮用户消息：今天天气不错',
].join('\n'));
assert.ok(answeringPrompt.includes('（出自《姐妹档案》）\n## 星灯'), 'the section of the character being answered is attached, labelled');
assert.ok(!answeringPrompt.includes('## 晚岚'), 'other characters\' sections are not');

// A section longer than the whole budget is cut into pieces; the piece about the question is found.
const longSectionSettings = {
  ...twoBookSettings,
  globalKnowledgeBase: [
    twoBookSettings.globalKnowledgeBase,
    '## 钟楼工程',
    `开工记录。${filler}`,
    '',
    `材料清单。${filler}`,
    '',
    '守钟的白猫叫雪团，每天黄昏在钟楼顶上巡逻一圈。',
  ].join('\n'),
} as PetConfig['settings'];
const deepPiecePrompt = buildCharacterReplySystemInstruction(personality, longSectionSettings, history, '守钟的白猫雪团是谁');
assert.ok(deepPiecePrompt.includes('守钟的白猫叫雪团'), 'the matching piece of a long section is attached');
assert.ok(deepPiecePrompt.includes('## 钟楼工程（续）'), 'a later piece keeps its section heading');

// Asking about the whole game outlines only the game document, not the characters' archive.
const twoBookOverviewPrompt = buildCharacterReplySystemInstruction(personality, twoBookSettings, history, '你们对整个游戏设计有什么看法');
assert.ok(twoBookOverviewPrompt.includes('## 3. 三位守护星君'), 'the game document is outlined');
assert.ok(!twoBookOverviewPrompt.includes('## 星灯'), 'the characters\' archive is left out of a game outline');

console.log('chat personality prompt smoke ok');
