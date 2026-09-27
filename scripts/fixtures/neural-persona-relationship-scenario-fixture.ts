import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaConfig,
  type NeuralPersonaContextInput,
  type NeuralPersonaEdge,
  type NeuralPersonaEdgeType,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../../src/character-graph/neural-persona';

export interface NeuralPersonaRelationshipScenario {
  config: NeuralPersonaConfig;
  forbiddenNodeIds: string[];
  graph: NeuralPersonaGraphSnapshot;
  input: NeuralPersonaContextInput;
  mustSelectNodeIds: string[];
  privacyBoundary: string;
  scenarioId: string;
  title: string;
  expectedPath?: string[];
  expectedFilteredNodeIds?: string[];
  expectedCoverage?: { content: number; connected: number; edges: number };
}

const ROLE_ID = 'relationship-scenario-role';
const NOW = 100;

function node(nodeId: string, overrides: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.8, confidence: 0.9, createdAt: 1,
    currentActivation: 0, decayRate: 0.02,
    influenceSummary: `${nodeId} 的关系测试人格影响。`, nodeId,
    ownerRoleId: ROLE_ID, plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private', stability: 0.8,
    status: 'active', tags: [], type: 'preference', updatedAt: 1, ...overrides,
  };
}

function edge(
  edgeId: string, sourceNodeId: string, targetNodeId: string, relationType: NeuralPersonaEdgeType,
  weight = 1, confidence = 1,
): NeuralPersonaEdge {
  return {
    confidence, createdAt: 1, edgeId, ownerRoleId: ROLE_ID, relationType,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, sourceNodeId, targetNodeId,
    updatedAt: 1, weight,
  };
}

function scenario(options: {
  id: string; title: string; privacy: string; nodes: NeuralPersonaNode[];
  edges?: NeuralPersonaEdge[]; query: string; must?: string[]; forbidden?: string[];
  input?: Partial<NeuralPersonaContextInput>; config?: Partial<NeuralPersonaConfig>;
  path?: string[]; filtered?: string[]; coverage?: { content: number; connected: number; edges: number };
}): NeuralPersonaRelationshipScenario {
  const config = { ...DEFAULT_NEURAL_PERSONA_CONFIG, configVersion: 'relationship-scenarios.v1', ...options.config };
  return {
    config, forbiddenNodeIds: options.forbidden ?? [], graph: {
      createdAt: 1, edges: options.edges ?? [], graphVersion: 'relationship-scenarios.graph.v1',
      nodes: options.nodes, roleId: ROLE_ID, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    }, input: {
      groupIds: [], includePrivate: true, now: NOW, query: options.query,
      requestId: `request:${options.id}`, roleId: ROLE_ID, sessionId: 'session:relationships',
      subgroupIds: [], turnId: `turn:${options.id}`, ...options.input,
    }, mustSelectNodeIds: options.must ?? [], privacyBoundary: options.privacy,
    scenarioId: options.id, title: options.title, expectedPath: options.path,
    expectedFilteredNodeIds: options.filtered, expectedCoverage: options.coverage,
  };
}

const source = (id: string, summary: string, overrides: Partial<NeuralPersonaNode> = {}) => node(id, {
  influenceSummary: summary, ...overrides,
});
const target = (id: string, summary: string, overrides: Partial<NeuralPersonaNode> = {}) => node(id, {
  baseWeight: 0, confidence: 0.9, influenceSummary: summary, ...overrides,
});

export const NEURAL_PERSONA_RELATIONSHIP_SCENARIOS: NeuralPersonaRelationshipScenario[] = [
  scenario({ id: 'supports-forward', title: '支持正向传播', privacy: 'private', query: '核对事实',
    nodes: [source('supports-source', '面对不确定信息时主动核对事实。'), target('supports-target', '始终维护对方的信任感。')],
    edges: [edge('supports-edge', 'supports-source', 'supports-target', 'supports')], must: ['supports-source', 'supports-target'], path: ['supports-source', 'supports-target'] }),
  scenario({ id: 'triggers-forward', title: '触发正向传播', privacy: 'private', query: '提到海边',
    nodes: [source('triggers-source', '用户提到海边时会联想到轻松的相处。'), target('triggers-target', '联想到轻松相处时使用柔和语气。')],
    edges: [edge('triggers-edge', 'triggers-source', 'triggers-target', 'triggers')], must: ['triggers-source', 'triggers-target'] }),
  scenario({ id: 'associated-forward', title: '关联正向传播', privacy: 'private', query: '蓝色',
    nodes: [source('associated-a', '喜欢蓝色的视觉意象。'), target('associated-b', '偏好安静而清澈的环境。')],
    edges: [edge('associated-edge', 'associated-a', 'associated-b', 'associated-with')], must: ['associated-a', 'associated-b'] }),
  scenario({ id: 'associated-reverse', title: '关联反向传播', privacy: 'private', query: '安静清澈',
    nodes: [source('reverse-a', '喜欢蓝色的视觉意象。'), target('reverse-b', '偏好安静而清澈的环境。')],
    edges: [edge('reverse-edge', 'reverse-a', 'reverse-b', 'associated-with')], must: ['reverse-b', 'reverse-a'], path: ['reverse-b', 'reverse-a'] }),
  scenario({ id: 'inhibits-target', title: '抑制目标', privacy: 'private', query: '保持克制',
    nodes: [source('inhibits-source', '受到挑衅时优先保持克制。'), target('inhibits-target', '冲动地立即反击。')],
    edges: [edge('inhibits-edge', 'inhibits-source', 'inhibits-target', 'inhibits')], must: ['inhibits-source'], forbidden: ['inhibits-target'], filtered: ['inhibits-target'] }),
  scenario({ id: 'opposes-target', title: '冲突目标', privacy: 'private', query: '收集证据',
    nodes: [source('opposes-source', '重要决定前先收集证据。'), target('opposes-target', '只凭直觉立即下结论。')],
    edges: [edge('opposes-edge', 'opposes-source', 'opposes-target', 'opposes')], must: ['opposes-source'], forbidden: ['opposes-target'], filtered: ['opposes-target'] }),
  scenario({ id: 'contains-ignored', title: '结构边不传播', privacy: 'private', query: '结构源信号',
    nodes: [source('contains-source', '结构源信号节点的关键词。'), target('contains-target', '没有语义关联的补充内容。')],
    edges: [edge('contains-edge', 'contains-source', 'contains-target', 'contains')], must: ['contains-source'], forbidden: ['contains-target'] }),
  scenario({ id: 'semantic-over-structure', title: '语义边优先于结构边', privacy: 'private', query: '核心规则',
    nodes: [source('mixed-source', '核心规则要求先确认信息。'), target('mixed-target', '确认信息后再给出安抚表达。'), target('mixed-structure-only', '只有结构归属但没有语义关联。')],
    edges: [edge('mixed-contains', 'mixed-source', 'mixed-structure-only', 'contains'), edge('mixed-supports', 'mixed-source', 'mixed-target', 'supports')],
    must: ['mixed-source', 'mixed-target'], forbidden: ['mixed-structure-only'], coverage: { content: 3, connected: 2, edges: 1 } }),
  scenario({ id: 'two-hop', title: '两层传播', privacy: 'private', query: '发现危险',
    nodes: [source('hop-source', '发现危险时提高警惕。'), target('hop-middle', '提高警惕后暂停行动。'), target('hop-target', '暂停行动后请求确认。')],
    edges: [edge('hop-one', 'hop-source', 'hop-middle', 'supports'), edge('hop-two', 'hop-middle', 'hop-target', 'supports')], must: ['hop-source', 'hop-middle', 'hop-target'] }),
  scenario({ id: 'three-hop-limit', title: '超过传播深度停止', privacy: 'private', query: '起点信号',
    nodes: [source('depth-a', '起点信号出现。'), target('depth-b', '第一层处理。'), target('depth-c', '第二层处理。'), target('depth-d', '第三层不应自动激活。')],
    edges: [edge('depth-one', 'depth-a', 'depth-b', 'supports'), edge('depth-two', 'depth-b', 'depth-c', 'supports'), edge('depth-three', 'depth-c', 'depth-d', 'supports')], must: ['depth-a', 'depth-b', 'depth-c'], forbidden: ['depth-d'] }),
  scenario({ id: 'weight-threshold', title: '低权重不传播', privacy: 'private', query: '权重信号',
    nodes: [source('weight-source', '权重信号出现。'), target('weight-target', '目标不应激活。')],
    edges: [edge('weight-edge', 'weight-source', 'weight-target', 'supports', 0.1)], must: ['weight-source'], forbidden: ['weight-target'] }),
  scenario({ id: 'confidence-threshold', title: '低置信度不传播', privacy: 'private', query: '置信信号',
    nodes: [source('confidence-source', '置信信号出现。'), target('confidence-target', '目标不应激活。')],
    edges: [edge('confidence-edge', 'confidence-source', 'confidence-target', 'supports', 1, 0.1)], must: ['confidence-source'], forbidden: ['confidence-target'] }),
  scenario({ id: 'cycle-safe', title: '循环关系安全停止', privacy: 'private', query: '循环起点',
    nodes: [source('cycle-a', '循环起点。'), target('cycle-b', '循环第二点。')],
    edges: [edge('cycle-ab', 'cycle-a', 'cycle-b', 'supports'), edge('cycle-ba', 'cycle-b', 'cycle-a', 'supports')], must: ['cycle-a', 'cycle-b'] }),
  scenario({ id: 'private-boundary', title: '私人目标边界', privacy: 'private-denied', query: '公开信号',
    nodes: [source('private-source', '公开信号出现。', { scope: 'runtime' }), target('private-target', '私人目标内容。')],
    edges: [edge('private-edge', 'private-source', 'private-target', 'supports')], input: { includePrivate: false }, must: ['private-source'], forbidden: ['private-target'] }),
  scenario({ id: 'group-boundary', title: '群组目标边界', privacy: 'group-denied', query: '群组信号',
    nodes: [source('group-source', '群组信号出现。'), target('group-target', '隔离范围内的目标。', { scope: 'group', groupId: 'g1' })],
    edges: [edge('group-edge', 'group-source', 'group-target', 'supports')], input: { groupIds: ['g2'] },
    must: ['group-source'], forbidden: ['group-target'] }),
  scenario({ id: 'subgroup-boundary', title: '子群组目标边界', privacy: 'subgroup-denied', query: '子群信号',
    nodes: [source('subgroup-source', '子群信号出现。'), target('subgroup-target', '隔离范围内的子目标。', { scope: 'subgroup', subgroupId: 's1' })],
    edges: [edge('subgroup-edge', 'subgroup-source', 'subgroup-target', 'supports')], input: { subgroupIds: ['s2'] },
    must: ['subgroup-source'], forbidden: ['subgroup-target'] }),
  scenario({ id: 'expired-boundary', title: '过期目标边界', privacy: 'expired', query: '仍然有效',
    nodes: [source('expired-source', '当前仍然有效的信号。'), target('expired-target', '已经过期的目标。', { expiresAt: NOW })],
    edges: [edge('expired-edge', 'expired-source', 'expired-target', 'supports')], must: ['expired-source'], forbidden: ['expired-target'] }),
  scenario({ id: 'source-conflict', title: '同源冲突择一', privacy: 'private', query: '同源规则',
    nodes: [source('same-source', '同源规则第一种表达。', { sourceRef: 'source:root' }), target('same-a', '第一个补充。', { sourceRef: 'source:same' }), target('same-b', '第二个补充。', { sourceRef: 'source:same' })],
    edges: [edge('same-edge-a', 'same-source', 'same-a', 'supports'), edge('same-edge-b', 'same-source', 'same-b', 'supports')], must: ['same-source', 'same-a'], forbidden: ['same-b'] }),
  scenario({ id: 'token-budget', title: '关系传播服从预算', privacy: 'private', query: '预算源',
    nodes: [source('budget-source', '预算源的简短影响。'), target('budget-target', '预算目标的简短影响。')],
    edges: [edge('budget-edge', 'budget-source', 'budget-target', 'supports')], config: { maxTokenBudget: 35 },
    must: ['budget-source'], forbidden: ['budget-target'], filtered: ['budget-target'] }),
  scenario({ id: 'coverage-and-determinism', title: '覆盖率与确定性', privacy: 'private', query: '覆盖源信号',
    nodes: [source('coverage-source', '覆盖源信号内容。'), target('coverage-related', '关联内容。'), target('coverage-orphan', '孤立内容。')],
    edges: [edge('coverage-edge', 'coverage-source', 'coverage-related', 'associated-with')], must: ['coverage-source', 'coverage-related'], forbidden: ['coverage-orphan'],
    coverage: { content: 3, connected: 2, edges: 1 } }),
];
