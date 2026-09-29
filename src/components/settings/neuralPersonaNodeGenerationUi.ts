import type {
  NeuralPersonaGeneratedNodeType,
  NeuralPersonaNodeGenerationCandidate,
} from '../../character-graph/neural-persona';
import type { PetPersonality } from '../../types';

export const GENERATED_NODE_TYPE_OPTIONS: Array<{
  label: string;
  value: NeuralPersonaGeneratedNodeType;
}> = [
  { label: '表达风格', value: 'style-tendency' },
  { label: '情绪倾向', value: 'emotional-tendency' },
  { label: '偏好', value: 'preference' },
  { label: '观点与原则', value: 'belief-or-viewpoint' },
  { label: '目标与愿望', value: 'desire-or-goal' },
  { label: '顾虑与风险', value: 'concern-or-risk' },
  { label: '经历影响', value: 'experience' },
  { label: '关系影响', value: 'relationship-influence' },
];

const RESULT_MESSAGES: Record<string, string> = {
  'generated-node-already-exists': '候选列表中存在与当前图谱完全重复的节点。',
  'generated-node-evidence-not-found': '模型节点的原文依据已经失效，请重新解析。',
  'generated-node-selection-invalid': '至少保留一个有效候选节点。',
  'neural-provider-api-url-missing': '当前模型接口地址未配置。',
  'neural-provider-data-egress-not-consented': '请先允许将本次人格文本发送给当前模型。',
  'neural-provider-model-name-missing': '当前模型名称未配置。',
  'neural-provider-text-capability-disabled': '当前模型没有启用文本能力。',
  'persona-node-generation-cancelled': '本次解析已取消。',
  'persona-node-generation-failed': '人格解析失败，请稍后重试。',
  'persona-node-generation-json-invalid': '模型没有返回有效的候选节点列表。',
  'persona-node-generation-empty-response': '模型接口成功返回，但没有可用文本。',
  'persona-node-generation-network-failed': '模型连接在生成过程中中断，请重试。',
  'persona-node-generation-output-invalid': '候选节点缺少原文依据或字段不符合规则。',
  'persona-node-generation-provider-failed': '当前模型请求失败。',
  'persona-node-generation-timeout': '当前模型解析超时。',
  'persona-source-too-short': '人格文本太短，至少输入 10 个字符。',
};

export function neuralPersonaNodeGenerationMessage(reason: string) {
  if (reason.startsWith('persona-node-generation-http-')) {
    return `当前模型接口返回 HTTP ${reason.slice('persona-node-generation-http-'.length)}。`;
  }
  return RESULT_MESSAGES[reason] ?? reason;
}

export function buildCurrentPersonalitySource(personality: PetPersonality) {
  const sections = [
    personality.name.trim() ? `角色名称：${personality.name.trim()}` : '',
    personality.traits.length ? `人格标签：${personality.traits.join('、')}` : '',
    personality.systemInstruction.trim()
      ? `人格设定：\n${personality.systemInstruction.trim()}` : '',
    personality.greeting.trim() ? `常用开场：${personality.greeting.trim()}` : '',
  ];
  // The completion preset is runtime-only and must never become a neural node.
  return sections.filter(Boolean).join('\n\n');
}

export function createManualNodeCandidate(): NeuralPersonaNodeGenerationCandidate {
  return {
    baseWeight: 0.7,
    candidateId: `manual-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    confidence: 1,
    enabled: true,
    evidence: '',
    influenceSummary: '',
    origin: 'user',
    tags: [],
    topic: '',
    type: 'style-tendency',
  };
}

export function parseCandidateTags(value: string) {
  return [...new Set(value.split(/[,，、]/u).map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, 12);
}
