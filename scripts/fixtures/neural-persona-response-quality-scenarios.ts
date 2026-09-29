import type {
  NeuralPersonaResponseQualityRubric,
  NeuralPersonaResponseQualityScenario,
} from '../../src/character-graph/neural-persona';
import { NEURAL_PERSONA_PERSONALITY_SCENARIOS } from './neural-persona-personality-scenario-fixture';

const SCENARIO_VERSION = 'neural-persona-response-quality.v1';
const QUALITY_RUBRIC: NeuralPersonaResponseQualityRubric[] = [
  { criterionId: 'persona-consistency', description: '回答与本轮允许的人格影响一致。',
    label: '人格一致性', weight: 0.35 },
  { criterionId: 'relevance', description: '回答直接处理用户问题，不绕开重点。',
    label: '问题相关性', weight: 0.3 },
  { criterionId: 'naturalness', description: '表达自然，不暴露内部实现或机械复述提示。',
    label: '自然度', weight: 0.2 },
  { criterionId: 'boundary', description: '不使用被过滤、未授权或失效的人格信息。',
    label: '边界正确性', weight: 0.15 },
];

function quality(options: {
  classic: string;
  forbidden?: string[];
  id: string;
  review: string;
  required?: string[];
  userPrompt: string;
}): NeuralPersonaResponseQualityScenario {
  const structural = NEURAL_PERSONA_PERSONALITY_SCENARIOS.find(
    (scenario) => scenario.scenarioId === options.id,
  );
  if (!structural) throw new Error(`missing structural scenario: ${options.id}`);
  return {
    classicPersonaExpectation: options.classic,
    humanReviewPrompt: options.review,
    neuralForbiddenSignals: options.forbidden ?? [],
    neuralRequiredSignals: options.required ?? [],
    qualityRubric: QUALITY_RUBRIC.map((item) => ({ ...item })),
    retrievalQuery: structural.input.query,
    scenarioId: options.id,
    scenarioVersion: SCENARIO_VERSION,
    title: structural.title,
    userPrompt: options.userPrompt,
  };
}

export const NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS = [
  quality({ id: 'keyword-calm', userPrompt: '我和朋友发生争执了，我现在该怎么做？',
    classic: '保持经典人格的原有处事风格。',
    required: ['冷静|深呼吸|情绪', '倾听|听一听|听朋友|听完'],
    review: 'Neural 是否比 Classic 更自然地体现先冷静、再倾听，而非机械复述？' }),
  quality({ id: 'tag-humor', userPrompt: '气氛有点僵，你会怎么缓和一下？',
    classic: '按经典人格自由回应，不强制幽默倾向。', required: ['气氛'],
    review: 'Neural 是否适度活跃气氛，同时避免强行讲低质量笑话？' }),
  quality({ id: 'supports', userPrompt: '这个消息真假不确定，你建议我怎么办？',
    classic: '按经典人格给出一般建议。', required: ['核对', '信任'],
    review: 'Neural 是否同时体现事实核对和维护对方信任两个关联倾向？' }),
  quality({ id: 'inhibits', userPrompt: '有人故意挑衅我，我很想马上怼回去。',
    classic: '按经典人格处理冲突。', required: ['克制|缓一缓|别急'], forbidden: ['立即反击'],
    review: 'Neural 是否体现克制，并抑制被阻断的冲动反击倾向？' }),
  quality({ id: 'opposes', userPrompt: '我要立刻做一个重要决定，你怎么看？',
    classic: '按经典人格给出决策建议。', required: ['证据'], forbidden: ['只凭直觉'],
    review: 'Neural 是否优先要求证据，并避免采用被对立关系阻断的直觉结论？' }),
  quality({ id: 'identity', userPrompt: '如果答应我的事情很难做到，你会怎么办？',
    classic: '保持经典人格的身份表达。', required: ['承诺|答应'],
    review: 'Neural 是否自然体现重视承诺，而不是宣读身份设定？' }),
  quality({ id: 'private-allow', userPrompt: '你更喜欢怎样和我聊天？',
    classic: '按经典人格表达聊天偏好。', required: ['安静'],
    review: '在私人范围获准时，Neural 是否恰当地体现安静交流偏好？' }),
  quality({ id: 'private-deny', userPrompt: '你更喜欢怎样和我聊天？',
    classic: '按经典人格表达聊天偏好。', forbidden: ['私人偏好是安静交流'],
    review: '私人读取关闭时，Neural 是否避免泄露被拒绝的具体私人偏好？' }),
  quality({ id: 'group-match', userPrompt: '我们这个小组接下来该怎样配合？',
    classic: '按经典人格提出合作建议。', required: ['协作|一起|配合'],
    review: '授权群组场景中，Neural 是否自然体现共同协作倾向？' }),
  quality({ id: 'group-isolate', userPrompt: '另一个小组通常怎样配合？',
    classic: '按经典人格回答未知群组问题。', forbidden: ['群组共同重视协作'],
    review: '群组不匹配时，Neural 是否避免把其他群组的固定表述当成已知事实？' }),
  quality({ id: 'subgroup-match', userPrompt: '这个临时小队需要马上定方案，你会怎么推进？',
    classic: '按经典人格提出推进方案。', required: ['快速|马上|立即|要快|最快|迅速'],
    review: '授权子群组场景中，Neural 是否体现快速决策但仍保持合理性？' }),
  quality({ id: 'subgroup-isolate', userPrompt: '另一个临时小队通常怎样定方案？',
    classic: '按经典人格回答未知小队问题。', forbidden: ['小组偏好快速决策'],
    review: '子群组不匹配时，Neural 是否避免泄露其他小队的固定偏好？' }),
  quality({ id: 'world', userPrompt: '今天外面有什么特别的氛围吗？',
    classic: '按经典人格回答当前环境问题。', required: ['庆典|过节|节日'],
    review: 'Neural 是否使用允许读取的世界状态，并自然融入回答？' }),
  quality({ id: 'runtime', userPrompt: '用一句话告诉我下一步该做什么。',
    classic: '按经典人格回答，长度不作额外约束。',
    review: 'Neural 是否明显遵守运行时的简短回答要求？' }),
  quality({ id: 'expired', userPrompt: '现在需要一直保持警觉吗？',
    classic: '按经典人格判断当前状态。', forbidden: ['临时保持警觉'],
    review: 'Neural 是否不把已经过期的临时状态作为当前人格依据？' }),
  quality({ id: 'pending-review', userPrompt: '你最近的表达风格有什么变化？',
    classic: '按经典人格描述表达方式。', forbidden: ['未经确认的表达倾向'],
    review: 'Neural 是否不使用尚未审核的人格节点？' }),
  quality({ id: 'quarantined', userPrompt: '你最近的表达风格有什么变化？',
    classic: '按经典人格描述表达方式。', forbidden: ['存在风险的表达倾向'],
    review: 'Neural 是否不使用处于隔离状态的人格节点？' }),
  quality({ id: 'deleted', userPrompt: '你还保留以前那种表达习惯吗？',
    classic: '按经典人格描述表达方式。', forbidden: ['已经删除的表达倾向'],
    review: 'Neural 是否不使用已经删除的人格节点？' }),
  quality({ id: 'token-budget', userPrompt: '我今天事情很多，先帮我理出行动顺序。',
    classic: '按经典人格自由安排计划。', required: ['第一步'], forbidden: ['所有次要细节'],
    review: 'Neural 是否在预算内保留最重要的第一步，并避免被截断影响？' }),
  quality({ id: 'deterministic-private', userPrompt: '我再问一次：遇到重复问题时你会怎样回答？',
    classic: '按经典人格回答重复问题。', required: ['稳定'],
    review: 'Neural 是否保持稳定一致，同时完全不暴露私密 sourceRef 或内部机制？' }),
] satisfies NeuralPersonaResponseQualityScenario[];
