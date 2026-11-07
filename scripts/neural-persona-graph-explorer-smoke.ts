import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
  CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT,
  DEFAULT_NEURAL_PERSONA_GRAPH_VIEWPORT,
  DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG,
  NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN,
  NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_HEIGHT,
  NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_WIDTH,
  NEURAL_PERSONA_GRAPH_MIN_SCALE,
  NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
  NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
  NEURAL_PERSONA_RECORD_VERSION,
  NEURAL_PERSONA_SCHEMA_VERSION,
  buildNeuralPersonaGraphExplorerView,
  buildNeuralPersonaGraphDragInfluences,
  createNeuralPersonaGraphPhysics,
  moveNeuralPersonaGraphOffsets,
  normalizeNeuralPersonaGraphPhysicsConfig,
  panNeuralPersonaGraphViewport,
  zoomNeuralPersonaGraphViewport,
  type NeuralPersonaGraphProjection,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';
import { NeuralPersonaGraphExchangePanel } from '../src/components/settings/NeuralPersonaGraphExchangePanel';
import { NeuralPersonaTagReviewInbox } from '../src/components/settings/NeuralPersonaTagReviewInbox';
import { resolveNeuralPersonaSettingsPreviewEnabled } from '../src/components/settings/neuralPersonaPreviewGate';
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaNodeCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaNodeHierarchy.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphExplorer.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphDimensions.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphDrag.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphPhysics.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphPhysicsConfig.ts',
  'src/components/settings/NeuralPersonaGraphExchangePanel.tsx',
  'src/components/settings/neuralPersonaGraphExchangeActions.ts',
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx',
  'src/components/settings/useNeuralPersonaGraphFullscreen.ts',
  'src/components/settings/useNeuralPersonaGraphSectionState.ts',
  'src/components/settings/NeuralPersonaTagReviewInbox.tsx',
  'src/components/settings/neuralPersonaTagReviewActions.ts',
  'src/components/settings/neuralPersonaPreviewGate.ts',
];
function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(node.body.end) - line(node.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const projection: NeuralPersonaGraphProjection = {
  edges: [
    { edgeId: 'e1', relationType: 'supports', sourceNodeId: 'identity', targetNodeId: 'trust', weight: 0.8 },
    { edgeId: 'e2', relationType: 'triggers', sourceNodeId: 'trust', targetNodeId: 'calm', weight: 0.6 },
  ],
  graphVersion: 'graph.v1',
  nodes: [
    { incomingCount: 0, label: '珍视用户', nodeId: 'identity', outgoingCount: 1, protected: true, scope: 'private', status: 'active', tagIds: ['identity', 'user'], type: 'identity-reference' },
    { incomingCount: 1, label: '信任用户', nodeId: 'trust', outgoingCount: 1, protected: false, scope: 'private', status: 'active', tagIds: ['relationship', 'user'], type: 'relationship-influence' },
    { incomingCount: 1, label: '平静表达', nodeId: 'calm', outgoingCount: 0, protected: false, scope: 'runtime', status: 'pending-review', tagIds: ['style'], type: 'style-tendency' },
  ],
  roleId: 'role-a',
};
sourceFiles.forEach(inspectSource);
const exchangePanelSource = fs.readFileSync(
  path.resolve('src/components/settings/NeuralPersonaGraphExchangePanel.tsx'),
  'utf8',
);
const settingsPersonalityTabSource = fs.readFileSync(path.resolve(
  'src/components/settings/SettingsPersonalityTab.tsx',
), 'utf8');
assert.match(exchangePanelSource, /preview\.diff\.requiresProtectedConfirmation/u);
assert.match(exchangePanelSource, /confirmProtectedChanges/u);
assert.match(exchangePanelSource, /disabled=\{!preview\.diff\.hasChanges/u);
assert.match(exchangePanelSource, /NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES/u);
assert.equal(resolveNeuralPersonaSettingsPreviewEnabled(false, undefined), false);
assert.equal(resolveNeuralPersonaSettingsPreviewEnabled(false, 'false'), false);
assert.equal(resolveNeuralPersonaSettingsPreviewEnabled(false, 'true'), true);
assert.equal(resolveNeuralPersonaSettingsPreviewEnabled(true, undefined), true);
assert.doesNotMatch(
  settingsPersonalityTabSource,
  /VITE_NEURAL_PERSONA_PREVIEW/u,
  'the graph editor must remain visible without a build-time preview flag',
);
assert.doesNotMatch(
  settingsPersonalityTabSource,
  /NEURAL_PERSONA_SETTINGS_SECTION_ENABLED\s*\?/u,
  'the graph editor must not be conditionally removed from the personality page',
);
const all = buildNeuralPersonaGraphExplorerView(projection, EMPTY_NEURAL_PERSONA_GRAPH_FILTERS);
assert.equal(all.nodes.length, 3);
assert.equal(all.edges.length, 2);
assert.equal(all.clusters.length, 0);
assert.equal(NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_WIDTH, NEURAL_PERSONA_GRAPH_VIEW_WIDTH * 3);
assert.equal(NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_HEIGHT, NEURAL_PERSONA_GRAPH_VIEW_HEIGHT * 3);
assert.deepEqual(CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT, {
  scale: 1, x: -NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN.x, y: -NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN.y,
});
assert.ok(all.nodes.every((node) => (
  Number.isFinite(node.x) && Number.isFinite(node.y)
)));
assert.deepEqual(all.tagIds, ['identity', 'relationship', 'style', 'user']);
assert.deepEqual(
  buildNeuralPersonaGraphExplorerView(projection, {
    ...EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
    query: '信任',
  }).nodes.map((node) => node.nodeId),
  ['trust'],
);
assert.deepEqual(
  buildNeuralPersonaGraphExplorerView(projection, {
    ...EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
    tagIds: ['identity', 'user'],
  }).nodes.map((node) => node.nodeId),
  ['identity'],
);
const focused = buildNeuralPersonaGraphExplorerView(projection, {
  ...EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
  focusNodeId: 'trust',
});
assert.deepEqual(focused.nodes.map((node) => node.nodeId).sort(), ['calm', 'identity', 'trust']);
assert.deepEqual(all, buildNeuralPersonaGraphExplorerView(projection, EMPTY_NEURAL_PERSONA_GRAPH_FILTERS));
assert.deepEqual(
  panNeuralPersonaGraphViewport(DEFAULT_NEURAL_PERSONA_GRAPH_VIEWPORT, { x: 12, y: -8 }),
  { scale: 1, x: 12, y: -8 },
);
assert.equal(zoomNeuralPersonaGraphViewport(
  DEFAULT_NEURAL_PERSONA_GRAPH_VIEWPORT, { x: 100, y: 100 }, 99,
).scale, 2.5);
assert.equal(zoomNeuralPersonaGraphViewport(
  DEFAULT_NEURAL_PERSONA_GRAPH_VIEWPORT, { x: 100, y: 100 }, 0.01,
).scale, NEURAL_PERSONA_GRAPH_MIN_SCALE);
const dragInfluences = buildNeuralPersonaGraphDragInfluences('identity', projection.edges);
assert.equal(dragInfluences.identity, 1);
assert.ok(dragInfluences.trust >= 0.3 && dragInfluences.trust <= 0.45);
assert.ok(dragInfluences.calm > 0 && dragInfluences.calm < dragInfluences.trust);
const movedOffsets = moveNeuralPersonaGraphOffsets({}, dragInfluences, { x: 100, y: -50 });
assert.deepEqual(movedOffsets.identity, { x: 100, y: -50 });
assert.equal(movedOffsets.trust.x, 100 * dragInfluences.trust);
assert.equal(movedOffsets.calm.y, -50 * dragInfluences.calm);
const physics = createNeuralPersonaGraphPhysics(all.nodes, all.edges);
physics.setConfig({ repulsionStrength: 1.2 });
assert.equal(physics.isActive(), true);
assert.deepEqual(normalizeNeuralPersonaGraphPhysicsConfig(), DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG);
const boundedPhysicsConfig = normalizeNeuralPersonaGraphPhysicsConfig({
  collisionDistance: 999, damping: 0, repulsionStrength: Number.NaN,
});
assert.equal(boundedPhysicsConfig.collisionDistance, 160);
assert.equal(boundedPhysicsConfig.damping, 0.5);
assert.equal(boundedPhysicsConfig.repulsionStrength, DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG.repulsionStrength);
assert.equal(normalizeNeuralPersonaGraphPhysicsConfig({ linkDistance: 999 }).linkDistance, 500);
assert.equal(normalizeNeuralPersonaGraphPhysicsConfig({ dragFollowStrength: 9 }).dragFollowStrength, 1);
const identityBefore = { ...physics.getPosition('identity')! };
const trustBefore = { ...physics.getPosition('trust')! };
const calmBefore = { ...physics.getPosition('calm')! };
physics.pin('identity');
physics.movePinned('identity', { x: identityBefore.x + 120, y: identityBefore.y });
for (let frame = 0; frame < 24; frame += 1) {
  physics.step();
}
assert.ok(physics.getPosition('identity')!.x > identityBefore.x + 110);
assert.notEqual(physics.getPosition('trust')!.x, trustBefore.x);
assert.notDeepEqual(physics.getPosition('calm'), calmBefore);
physics.release('identity');
const releasedAt = physics.getPosition('identity')!.x;
physics.step();
assert.ok(Math.abs(physics.getPosition('identity')!.x - releasedAt) < 18);
physics.pin('identity');
physics.movePinned('identity', { x: -10_000, y: 10_000 });
assert.equal(physics.getPosition('identity')?.x, -10_000);
assert.equal(physics.getPosition('identity')?.y, 10_000);
const overlapping = all.nodes.slice(0, 2).map((node) => ({ ...node, x: 100, y: 100 }));
const repulsion = createNeuralPersonaGraphPhysics(overlapping, []);
repulsion.pin(overlapping[0].nodeId);
repulsion.release(overlapping[0].nodeId);
for (let frame = 0; frame < 16; frame += 1) repulsion.step();
const left = repulsion.getPosition(overlapping[0].nodeId)!;
const right = repulsion.getPosition(overlapping[1].nodeId)!;
assert.ok(Math.hypot(left.x - right.x, left.y - right.y) > 8);
const disabledRepulsion = createNeuralPersonaGraphPhysics(overlapping, [], {
  collisionStrength: 0, repulsionStrength: 0,
});
disabledRepulsion.pin(overlapping[0].nodeId);
disabledRepulsion.release(overlapping[0].nodeId);
for (let frame = 0; frame < 16; frame += 1) disabledRepulsion.step();
const disabledLeft = disabledRepulsion.getPosition(overlapping[0].nodeId)!;
const disabledRight = disabledRepulsion.getPosition(overlapping[1].nodeId)!;
assert.equal(Math.hypot(disabledLeft.x - disabledRight.x, disabledLeft.y - disabledRight.y), 0);
const reviewNode: NeuralPersonaNode = {
  activationCount: 0, baseWeight: 0.5, confidence: 0.8, createdAt: 1,
  currentActivation: 0, decayRate: 0.1, influenceSummary: '平静地陪伴用户。',
  nodeId: 'preference:review', ownerRoleId: 'role-a', plasticity: 0.2,
  protected: false, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private',
  stability: 0.7, status: 'active', type: 'preference', updatedAt: 1,
  tags: [
    { canonicalId: 'tone:calm', label: '平静', source: 'system', status: 'pending-review' },
    { canonicalId: 'custom:old', label: '旧标签', source: 'user', status: 'active' },
  ],
};
const reviewMarkup = renderToStaticMarkup(createElement(NeuralPersonaTagReviewInbox, {
  nodes: [],
  onReview: async () => ({ reason: 'unused', status: 'invalid' }),
  onStage: async () => ({ reason: 'unused', status: 'invalid' }),
  roleId: 'role-a',
}));
assert.match(reviewMarkup, /标签建议审核/u);
assert.match(reviewMarkup, /当前没有待审核标签/u);
const pendingReviewMarkup = renderToStaticMarkup(createElement(NeuralPersonaTagReviewInbox, {
  nodes: [reviewNode],
  onReview: async () => ({ reason: 'unused', status: 'invalid' }),
  onStage: async () => ({ reason: 'unused', status: 'invalid' }),
  roleId: 'role-a',
  selectedNodeId: reviewNode.nodeId,
}));
assert.match(pendingReviewMarkup, /平静地陪伴用户/u);
assert.match(pendingReviewMarkup, />接受</u);
assert.match(pendingReviewMarkup, />拒绝</u);
const exchangeMarkup = renderToStaticMarkup(createElement(NeuralPersonaGraphExchangePanel, {
  onCommitImport: async () => ({ reason: 'unused', status: 'invalid' }),
  onPreviewImport: () => ({ expectedRevision: 0, reason: 'unused', status: 'invalid' }),
  record: {
    graph: {
      createdAt: 1,
      edges: [],
      graphVersion: 'neural-graph.r0',
      nodes: [],
      roleId: 'role-a',
      schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    },
    recordVersion: NEURAL_PERSONA_RECORD_VERSION,
    recoverySnapshots: [],
    revision: 0,
    roleId: 'role-a',
    updatedAt: 1,
  },
}));
assert.match(exchangeMarkup, /图谱导入与导出/u);
assert.match(exchangeMarkup, /导入只生成预览/u);

console.log('neural persona graph explorer smoke ok');
