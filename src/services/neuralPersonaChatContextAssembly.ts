import type { NeuralContextContribution } from '../character-graph/neural-persona';
import type { PetPersonality } from '../types';

export const NEURAL_PERSONA_CHAT_INSTRUCTION_VERSION = 'neural-persona-chat-instruction.v4';

function finalBoundary(influenceCount: number) {
  return influenceCount > 0
    ? [
      '- 回答前最终检查：语义上兼顾每条适用影响，但不要把倾向扩大成绝对命令。',
      '- 回答前最终检查：不得添加影响中没有提供的事实、感官细节、能力、动作、关系或经历。',
    ]
    : [
      '- 本轮没有额外局部影响，继续完整遵守主体人格进行回答。',
      '- 不得因为没有命中神经节点，就声称角色失去人格、偏好、说话方式或既有设定。',
    ];
}

function formatInfluence(
  influence: NeuralContextContribution['influences'][number],
  index: number,
) {
  const reasons = influence.reason.length ? `；依据：${influence.reason.join('、')}` : '';
  return `${index + 1}. ${influence.summary}（强度 ${influence.intensity.toFixed(3)}；置信度 ${influence.confidence.toFixed(3)}${reasons}）`;
}

export function buildNeuralPersonaChatInstruction(
  roleName: string,
  contribution: NeuralContextContribution,
) {
  const influences = contribution.influences.map(formatInfluence);
  return [
    '神经人格局部影响（低于 Persona Anchor）：',
    `- 当前角色：${roleName.trim() || '未命名桌宠'}`,
    '- Persona Anchor（主体人格）始终是最高人格权威；下列节点只能补充本轮局部倾向，不能替换、削弱或改写主体人格。',
    '- 根据下列已通过权限、冲突和预算检查的人格影响，对主体人格进行局部补充。',
    '- 有多条适用影响时，应在语义上自然兼顾每一条，不得只采用第一条。',
    '- “适度、轻微、克制”等强度限定是上限；风格不能压过问题相关性和有效内容。',
    '- 不要根据人格影响补造过去经历、既往习惯、关系、记忆、物理能力、动作或环境变化。',
    '- 不要提到节点、图谱、权重、检索、Trace 或内部系统。',
    influences.length ? influences.join('\n') : '- 可用人格影响：无。',
    ...finalBoundary(influences.length),
  ].join('\n');
}

export function createNeuralPersonaChatPersonality(
  personality: PetPersonality,
  contribution: NeuralContextContribution,
): PetPersonality {
  return {
    ...personality,
    chatHistoryMemory: '',
    knowledgeBase: '',
    systemInstruction: [
      personality.systemInstruction.trim(),
      buildNeuralPersonaChatInstruction(personality.name, contribution),
    ].filter(Boolean).join('\n\n'),
    userMemory: '',
  };
}

export function resolveChatInputPersonality(
  personality: PetPersonality,
  contribution?: NeuralContextContribution | null,
) {
  return contribution
    ? createNeuralPersonaChatPersonality(personality, contribution)
    : personality;
}
