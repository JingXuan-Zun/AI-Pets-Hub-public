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
import { NeuralPersonaGraphExplorer } from '../src/components/settings/NeuralPersonaGraphExplorer';
import { NeuralPersonaGraphPhysicsSettings } from '../src/components/settings/NeuralPersonaGraphPhysicsSettings';
import { NeuralPersonaGraphExchangePanel } from '../src/components/settings/NeuralPersonaGraphExchangePanel';
import { NeuralPersonaEdgeEditor } from '../src/components/settings/NeuralPersonaEdgeEditor';
import { NeuralPersonaNodeEditorFields } from '../src/components/settings/NeuralPersonaNodeEditorFields';
import { NeuralPersonaNodeEditor } from '../src/components/settings/NeuralPersonaNodeEditor';
import { NeuralPersonaNodeResourceManager } from '../src/components/settings/NeuralPersonaNodeResourceManager';
import { NeuralPersonaTagReviewInbox } from '../src/components/settings/NeuralPersonaTagReviewInbox';
import { createNeuralPersonaEditorId } from '../src/components/settings/neuralPersonaEditorIds';
import {
  buildNeuralPersonaEdgeDraft,
  createEmptyNeuralPersonaEdgeEditorDraft,
} from '../src/components/settings/neuralPersonaEdgeEditorDraft';
import {
  buildNeuralPersonaNodeDraft,
  applyNeuralPersonaNodeEditorType,
  createEmptyNeuralPersonaNodeEditorDraft,
  createNeuralPersonaNodeEditorDraft,
  mergeNeuralPersonaEditorTags,
} from '../src/components/settings/neuralPersonaNodeEditorDraft';
import { resolveNeuralPersonaSettingsPreviewEnabled } from '../src/components/settings/neuralPersonaPreviewGate';
import { resolveNeuralPersonaGraphEdgeVisualStyle } from '../src/components/settings/neuralPersonaGraphEdgeVisualStyle';
import { resolveNeuralPersonaGraphFocusAlphas } from '../src/components/settings/neuralPersonaGraphFocusVisibility';
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaNodeCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaNodeHierarchy.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphExplorer.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphDimensions.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphDrag.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphPhysics.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphPhysicsConfig.ts',
  'src/components/settings/NeuralPersonaGraphCanvas.tsx',
  'src/components/settings/NeuralPersonaGraphCanvasToolbar.tsx',
  'src/components/settings/NeuralPersonaGraphPhysicsSettings.tsx',
  'src/components/settings/NeuralPersonaGraphPixiCanvas.tsx',
  'src/components/settings/NeuralPersonaGraphSvgCanvas.tsx',
  'src/components/settings/NeuralPersonaGraphControls.tsx',
  'src/components/settings/NeuralPersonaGraphDetails.tsx',
  'src/components/settings/NeuralPersonaGraphExplorer.tsx',
  'src/components/settings/NeuralPersonaGraphExchangePanel.tsx',
  'src/components/settings/neuralPersonaGraphExchangeActions.ts',
  'src/components/settings/NeuralPersonaEdgeEditor.tsx',
  'src/components/settings/NeuralPersonaEdgeEditorAdvancedFields.tsx',
  'src/components/settings/NeuralPersonaEdgeEditorFields.tsx',
  'src/components/settings/neuralPersonaEdgeEditorDraft.ts',
  'src/components/settings/neuralPersonaEditorIds.ts',
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx',
  'src/components/settings/useNeuralPersonaGraphCanvasController.ts',
  'src/components/settings/useNeuralPersonaGraphPixiCanvas.ts',
  'src/components/settings/useNeuralPersonaGraphFullscreen.ts',
  'src/components/settings/useNeuralPersonaGraphPhysicsConfig.ts',
  'src/components/settings/neuralPersonaGraphPhysics.worker.ts',
  'src/components/settings/neuralPersonaGraphPhysicsWorkerProtocol.ts',
  'src/components/settings/neuralPersonaGraphFrameRate.ts',
  'src/components/settings/neuralPersonaGraphEdgeVisualStyle.ts',
  'src/components/settings/neuralPersonaGraphFocusVisibility.ts',
  'src/components/settings/neuralPersonaGraphPixiApplication.ts',
  'src/components/settings/neuralPersonaGraphPixiRuntime.ts',
  'src/components/settings/neuralPersonaGraphPixiResizeObserver.ts',
  'src/components/settings/neuralPersonaGraphPixiScene.ts',
  'src/components/settings/neuralPersonaGraphPixiViewport.ts',
  'src/components/settings/neuralPersonaGraphWorkerPhysics.ts',
  'src/components/settings/useNeuralPersonaGraphSectionState.ts',
  'src/components/settings/NeuralPersonaNodeEditor.tsx',
  'src/components/settings/NeuralPersonaNodeEditorDeleteAction.tsx',
  'src/components/settings/NeuralPersonaNodeEditorAdvancedFields.tsx',
  'src/components/settings/NeuralPersonaNodeEditorFields.tsx',
  'src/components/settings/NeuralPersonaNodeResourceList.tsx',
  'src/components/settings/NeuralPersonaNodeResourceManager.tsx',
  'src/components/settings/neuralPersonaNodeResourceTree.ts',
  'src/components/settings/neuralPersonaNodeEditorDraft.ts',
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
const pixiRuntimeSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaGraphPixiRuntime.ts',
), 'utf8');
const pixiInteractionsSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaGraphPixiInteractions.ts',
), 'utf8');
const pixiResizeObserverSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaGraphPixiResizeObserver.ts',
), 'utf8');
const pixiApplicationSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaGraphPixiApplication.ts',
), 'utf8');
const pixiSceneSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaGraphPixiScene.ts',
), 'utf8');
const svgCanvasSource = fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaGraphSvgCanvas.tsx',
), 'utf8');
const settingsPersonalityTabSource = fs.readFileSync(path.resolve(
  'src/components/settings/SettingsPersonalityTab.tsx',
), 'utf8');
assert.match(pixiRuntimeSource, /installNeuralPersonaGraphResizeObserver/u);
assert.match(pixiInteractionsSource,
  /if \(nodeId\) \{\s+if \(!runtime\.multiSelectMode\) runtime\.callbacks\.onFocusNode\(nodeId\)/u);
assert.match(svgCanvasSource,
  /onPointerDown=\{\(event\) => \{ if \(!props\.multiSelectMode\) props\.onFocusNode\(node\.nodeId\); props\.beginDrag/u);
assert.match(pixiResizeObserverSource, /new ResizeObserver/u);
assert.match(pixiApplicationSource, /app\.renderer\.resize/u);
assert.match(pixiSceneSource, /new Sprite\(Texture\.WHITE\)/u);
assert.doesNotMatch(pixiSceneSource, /edgeGraphics\.clear\(\)/u);
const connectedEdgeStyle = resolveNeuralPersonaGraphEdgeVisualStyle({
  edgeId: 'e1', selectedNodeId: 'identity', sourceNodeId: 'identity',
  targetNodeId: 'trust', weight: 0.8,
});
const unrelatedEdgeStyle = resolveNeuralPersonaGraphEdgeVisualStyle({
  edgeId: 'e2', selectedNodeId: 'identity', sourceNodeId: 'trust',
  targetNodeId: 'calm', weight: 0.6,
});
assert.ok(connectedEdgeStyle.alpha > unrelatedEdgeStyle.alpha);
assert.ok(connectedEdgeStyle.width > unrelatedEdgeStyle.width);
assert.equal(resolveNeuralPersonaGraphEdgeVisualStyle({
  edgeId: 'e1', selectedEdgeId: 'e1', selectedNodeId: 'calm',
  sourceNodeId: 'identity', targetNodeId: 'trust', weight: 0.8,
}).color, 0x67e8f9);
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
const focusView = {
  ...all,
  edges: ['root:one', 'one:two', 'two:three'].map((edgeId, index) => ({
    edgeId, relationType: 'contains' as const,
    sourceNodeId: ['root', 'one', 'two'][index]!,
    targetNodeId: ['one', 'two', 'three'][index]!, weight: 1,
  })),
  nodes: ['root', 'one', 'two', 'three'].map((nodeId, index) => ({
    ...all.nodes[0]!, nodeId, x: index * 100, y: 0,
  })),
};
const focusAlphas = resolveNeuralPersonaGraphFocusAlphas(focusView, 'root');
assert.equal(focusAlphas.get('one'), 1);
assert.equal(focusAlphas.get('two'), 1);
assert.equal(focusAlphas.get('three'), 0.35);
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
const markup = renderToStaticMarkup(createElement(NeuralPersonaGraphExplorer, {
  canvasStyle: { height: 520 }, editorMode: false, onToggleEditor: () => undefined, projection,
}));
assert.match(markup, /神经人格图谱/u);
assert.match(markup, /编辑节点/u);
assert.match(markup, /力与碰撞/u);
assert.match(markup, /珍视用户/u);
assert.match(markup, /data-neural-graph-edge/u);
assert.match(markup, /data-neural-graph-canvas/u);
const physicsSettingsMarkup = renderToStaticMarkup(createElement(
  NeuralPersonaGraphPhysicsSettings,
  { config: DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG, onChange: () => undefined },
));
assert.equal(physicsSettingsMarkup.match(/type="range"/gu)?.length, 5);
assert.match(physicsSettingsMarkup, /拖动跟随强度/u);
assert.match(physicsSettingsMarkup, /拖动最大拉伸距离/u);
assert.match(physicsSettingsMarkup, /节点间的排斥力/u);
assert.match(physicsSettingsMarkup, /相连节点间的吸引力/u);
assert.match(physicsSettingsMarkup, /max="500"/u);
assert.doesNotMatch(markup, /来源：/u);
const edgeDraft = buildNeuralPersonaEdgeDraft({
  ...createEmptyNeuralPersonaEdgeEditorDraft(['identity', 'trust']),
  edgeId: 'edge:identity-trust',
});
assert.equal(edgeDraft.sourceNodeId, 'identity');
assert.equal(edgeDraft.targetNodeId, 'trust');
assert.equal(createNeuralPersonaEditorId('node', () => 'fixed'), 'node:fixed');
assert.equal(createEmptyNeuralPersonaEdgeEditorDraft([], 'edge:generated').edgeId, 'edge:generated');
const identityDraft = applyNeuralPersonaNodeEditorType(
  createEmptyNeuralPersonaNodeEditorDraft('node:generated'),
  'identity-reference',
);
assert.equal(identityDraft.protected, true);
assert.equal(identityDraft.nodeId, 'node:generated');
const preferenceDraft = applyNeuralPersonaNodeEditorType(
  { ...identityDraft, sourceRef: 'persona:self' },
  'preference',
);
assert.equal(preferenceDraft.protected, false);
assert.equal(preferenceDraft.sourceRef, '');
const editorDraft = buildNeuralPersonaNodeDraft({
  ...createEmptyNeuralPersonaNodeEditorDraft(),
  influenceSummary: '喜欢安静地陪伴用户。',
  nodeId: 'preference:quiet',
  tags: '陪伴，安静',
});
assert.equal(editorDraft.tags.length, 2);
assert.equal(editorDraft.tags.every((tag) => tag.source === 'user'), true);
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
assert.equal(createNeuralPersonaNodeEditorDraft(reviewNode).tags, '旧标签');
const mergedTags = mergeNeuralPersonaEditorTags(reviewNode, editorDraft.tags);
assert.equal(mergedTags.some((tag) => tag.canonicalId === 'tone:calm'
  && tag.status === 'pending-review'), true);
const editorMarkup = renderToStaticMarkup(createElement(NeuralPersonaNodeEditor, {
  linkedEdgeCount: 0,
  node: null,
  onDelete: async () => ({ reason: 'unused', status: 'invalid' }),
  onUpdate: async () => ({ reason: 'unused', status: 'invalid' }),
}));
assert.match(editorMarkup, /节点内容/u);
const resourceMarkup = renderToStaticMarkup(createElement(NeuralPersonaNodeResourceManager, {
  batchDeletePanel: null, edges: [], nodes: [reviewNode], selectedNodeId: reviewNode.nodeId,
  onCreate: async () => ({ reason: 'unused', status: 'invalid' }),
  onDelete: async () => ({ reason: 'unused', status: 'invalid' }),
  onSelect: () => undefined,
  onUpdate: async () => ({ reason: 'unused', status: 'invalid' }),
}));
assert.match(resourceMarkup, /节点资源/u);
assert.match(resourceMarkup, /新建节点/u);
assert.match(resourceMarkup, /data-neural-node-resource-id/u);
const nodeFieldsMarkup = renderToStaticMarkup(createElement(NeuralPersonaNodeEditorFields, {
  createMode: true,
  draft: createEmptyNeuralPersonaNodeEditorDraft('node:generated'),
  setDraft: () => undefined,
}));
assert.match(nodeFieldsMarkup, /这个节点会怎样影响角色/u);
assert.match(nodeFieldsMarkup, /<details/u);
assert.match(nodeFieldsMarkup, /高级设置/u);
const edgeEditorMarkup = renderToStaticMarkup(createElement(NeuralPersonaEdgeEditor, {
  edge: null,
  edges: [],
  managedPersonaRelationship: false,
  nodes: [],
  onCreate: async () => ({ reason: 'unused', status: 'invalid' }),
  onDelete: async () => ({ reason: 'unused', status: 'invalid' }),
  onSelectEdge: () => undefined,
  onUpdate: async () => ({ reason: 'unused', status: 'invalid' }),
  protectedRelationship: false,
}));
assert.match(edgeEditorMarkup, /关系编辑器/u);
assert.match(edgeEditorMarkup, /快速新建关系/u);
assert.match(edgeEditorMarkup, /disabled=""/u);
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
