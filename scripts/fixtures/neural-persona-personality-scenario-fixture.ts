import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaConfig,
  type NeuralPersonaContextInput,
  type NeuralPersonaEdge,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../../src/character-graph/neural-persona';

export interface NeuralPersonaPersonalityScenario {
  config: NeuralPersonaConfig;
  expectedFilteredNodeIds?: string[];
  forbiddenNodeIds: string[];
  graph: NeuralPersonaGraphSnapshot;
  input: NeuralPersonaContextInput;
  maxTokenBudget: number;
  mustSelectNodeIds: string[];
  privacyBoundary: string;
  scenarioId: string;
  title: string;
}

const ROLE_ID = 'persona-scenario-role';
const NOW = 100;

function tag(label: string) {
  return { canonicalId: `topic:${label}`, label, source: 'user' as const, status: 'active' as const };
}

function node(nodeId: string, overrides: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0,
    baseWeight: 0.05,
    confidence: 0.1,
    createdAt: 1,
    currentActivation: 0,
    decayRate: 0.1,
    influenceSummary: `${nodeId} 的固定人格影响。`,
    nodeId,
    ownerRoleId: ROLE_ID,
    plasticity: 0.2,
    protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private',
    stability: 0.8,
    status: 'active',
    tags: [],
    type: 'preference',
    updatedAt: 1,
    ...overrides,
  };
}

function edge(
  edgeId: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationType: NeuralPersonaEdge['relationType'],
): NeuralPersonaEdge {
  return {
    confidence: 1,
    createdAt: 1,
    edgeId,
    ownerRoleId: ROLE_ID,
    relationType,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId,
    targetNodeId,
    updatedAt: 1,
    weight: 1,
  };
}

function scenario(options: {
  config?: Partial<NeuralPersonaConfig>;
  edges?: NeuralPersonaEdge[];
  expectedFilteredNodeIds?: string[];
  forbidden?: string[];
  id: string;
  input?: Partial<NeuralPersonaContextInput>;
  must?: string[];
  nodes: NeuralPersonaNode[];
  privacy: string;
  title: string;
}): NeuralPersonaPersonalityScenario {
  const config = { ...DEFAULT_NEURAL_PERSONA_CONFIG, configVersion: 'persona-scenarios.v2', ...options.config };
  return {
    config,
    expectedFilteredNodeIds: options.expectedFilteredNodeIds,
    forbiddenNodeIds: options.forbidden ?? [],
    graph: {
      createdAt: 1, edges: options.edges ?? [], graphVersion: 'persona-scenarios.graph.v2',
      nodes: options.nodes, roleId: ROLE_ID, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    },
    input: {
      groupIds: [], includePrivate: true, now: NOW, query: options.id,
      requestId: `request:${options.id}`, roleId: ROLE_ID, sessionId: 'session:fixed',
      subgroupIds: [], turnId: `turn:${options.id}`, ...options.input,
    },
    maxTokenBudget: config.maxTokenBudget,
    mustSelectNodeIds: options.must ?? [],
    privacyBoundary: options.privacy,
    scenarioId: options.id,
    title: options.title,
  };
}

const propagationSource = (id: string, influenceSummary: string) => (
  node(id, { influenceSummary })
);
const propagationTarget = (id: string, influenceSummary: string) => (
  node(id, { baseWeight: 0, confidence: 0.9, influenceSummary })
);

export const NEURAL_PERSONA_PERSONALITY_SCENARIOS: NeuralPersonaPersonalityScenario[] = [
  scenario({ id: 'keyword-calm', title: '直接关键词偏好', privacy: 'private-allowed',
    nodes: [node('keyword-calm', { influenceSummary: '面对冲突时先冷静倾听。' })],
    input: { query: '冷静倾听' }, must: ['keyword-calm'] }),
  scenario({ id: 'tag-humor', title: '活动标签命中', privacy: 'private-allowed',
    nodes: [node('tag-humor', { influenceSummary: '适度活跃气氛。', tags: [tag('讲笑话')] })],
    input: { query: '讲笑话' }, must: ['tag-humor'] }),
  scenario({ id: 'supports', title: '支持关系传播', privacy: 'private-allowed',
    nodes: [
      propagationSource('supports', '面对不确定信息时主动核对事实。'),
      propagationTarget('supported-trust', '核对时也要维护对方的信任感。'),
    ], edges: [edge('edge:supports', 'supports', 'supported-trust', 'supports')],
    input: { query: '核对事实' },
    must: ['supports', 'supported-trust'] }),
  scenario({ id: 'inhibits', title: '抑制关系阻断', privacy: 'private-allowed',
    nodes: [
      propagationSource('inhibits', '受到挑衅时优先保持克制。'),
      propagationTarget('inhibited-fear', '冲动地立即反击。'),
    ], edges: [edge('edge:inhibits', 'inhibits', 'inhibited-fear', 'inhibits')],
    input: { query: '保持克制' },
    must: ['inhibits'], forbidden: ['inhibited-fear'], expectedFilteredNodeIds: ['inhibited-fear'] }),
  scenario({ id: 'opposes', title: '对立关系阻断', privacy: 'private-allowed',
    nodes: [
      propagationSource('opposes', '重要决定前先收集证据。'),
      propagationTarget('opposed-impulse', '只凭直觉立刻下结论。'),
    ], edges: [edge('edge:opposes', 'opposes', 'opposed-impulse', 'opposes')],
    input: { query: '收集证据' },
    must: ['opposes'], forbidden: ['opposed-impulse'], expectedFilteredNodeIds: ['opposed-impulse'] }),
  scenario({ id: 'identity', title: '受保护身份节点可读', privacy: 'private-allowed',
    nodes: [node('identity', { influenceSummary: '我是重视承诺的伙伴。', protected: true,
      sourceRef: 'identity:fixed', type: 'identity-reference' })],
    input: { query: '重视承诺' }, must: ['identity'] }),
  scenario({ id: 'private-allow', title: '私人节点授权读取', privacy: 'private-allowed',
    nodes: [node('private-allow', { influenceSummary: '私人偏好是安静交流。' })],
    input: { query: '安静交流', includePrivate: true }, must: ['private-allow'] }),
  scenario({ id: 'private-deny', title: '私人节点拒绝读取', privacy: 'private-denied',
    nodes: [node('private-deny', { influenceSummary: '私人偏好是安静交流。' })],
    input: { query: '安静交流', includePrivate: false }, forbidden: ['private-deny'] }),
  scenario({ id: 'group-match', title: '群组范围匹配', privacy: 'group:g1',
    nodes: [node('group-match', { groupId: 'g1', influenceSummary: '群组共同重视协作。', scope: 'group' })],
    input: { query: '重视协作', groupIds: ['g1'] }, must: ['group-match'] }),
  scenario({ id: 'group-isolate', title: '群组范围隔离', privacy: 'group:g2-denied',
    nodes: [node('group-isolate', { groupId: 'g1', influenceSummary: '群组共同重视协作。', scope: 'group' })],
    input: { query: '重视协作', groupIds: ['g2'] }, forbidden: ['group-isolate'] }),
  scenario({ id: 'subgroup-match', title: '子群组范围匹配', privacy: 'subgroup:s1',
    nodes: [node('subgroup-match', { subgroupId: 's1',
      influenceSummary: '信息足够时快速决策，但不跳过必要讨论和风险检查。', scope: 'subgroup' })],
    input: { query: '快速决策', subgroupIds: ['s1'] }, must: ['subgroup-match'] }),
  scenario({ id: 'subgroup-isolate', title: '子群组范围隔离', privacy: 'subgroup:s2-denied',
    nodes: [node('subgroup-isolate', { subgroupId: 's1', influenceSummary: '小组偏好快速决策。', scope: 'subgroup' })],
    input: { query: '快速决策', subgroupIds: ['s2'] }, forbidden: ['subgroup-isolate'] }),
  scenario({ id: 'world', title: '世界范围节点可读', privacy: 'world-readable',
    nodes: [node('world', { influenceSummary: '当前仅确认世界处于庆典期间，其他地点、声音、气味和活动细节未知。', scope: 'world' })],
    input: { query: '庆典期间', includePrivate: false }, must: ['world'] }),
  scenario({ id: 'runtime', title: '运行时节点可读', privacy: 'runtime-readable',
    nodes: [node('runtime', { influenceSummary: '当前必须简短回答，并只给出一个具体可执行的下一步。', scope: 'runtime' })],
    input: { query: '简短回答', includePrivate: false }, must: ['runtime'] }),
  scenario({ id: 'expired', title: '过期节点拒绝', privacy: 'expired-denied',
    nodes: [node('expired', { expiresAt: NOW, influenceSummary: '临时保持警觉。', type: 'temporary-cognitive-state' })],
    input: { query: '保持警觉' }, forbidden: ['expired'] }),
  scenario({ id: 'pending-review', title: '待审核节点拒绝', privacy: 'inactive-denied',
    nodes: [node('pending-review', { influenceSummary: '未经确认的表达倾向。', status: 'pending-review' })],
    input: { query: '表达倾向' }, forbidden: ['pending-review'] }),
  scenario({ id: 'quarantined', title: '隔离节点拒绝', privacy: 'inactive-denied',
    nodes: [node('quarantined', { influenceSummary: '存在风险的表达倾向。', status: 'quarantined' })],
    input: { query: '表达倾向' }, forbidden: ['quarantined'] }),
  scenario({ id: 'deleted', title: '已删除节点拒绝', privacy: 'inactive-denied',
    nodes: [node('deleted', { influenceSummary: '已经删除的表达倾向。', status: 'deleted' })],
    input: { query: '表达倾向' }, forbidden: ['deleted'] }),
  scenario({ id: 'token-budget', title: 'Token预算截断', privacy: 'private-allowed',
    config: { maxTokenBudget: 45 }, nodes: [
      node('budget-a', { influenceSummary: '安排计划时只给出一个稳定清晰且可执行的第一步，不展开后续步骤或次要细节。' }),
      node('budget-b', { influenceSummary: '安排计划时同时列出所有次要细节。' }),
    ], input: { query: '安排计划' }, must: ['budget-a'], forbidden: ['budget-b'],
    expectedFilteredNodeIds: ['budget-b'] }),
  scenario({ id: 'deterministic-private', title: '确定性与私密来源不泄漏', privacy: 'private-source-hidden',
    nodes: [node('deterministic-private', { influenceSummary: '对相同问题保持稳定一致的回答方式。',
      sourceRef: 'private://never-expose-this-reference' })],
    input: { query: '稳定一致' }, must: ['deterministic-private'] }),
];
