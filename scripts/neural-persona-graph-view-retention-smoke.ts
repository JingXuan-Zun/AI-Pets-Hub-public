import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { NeuralPersonaGraphExplorerView } from '../src/character-graph/neural-persona';
import {
  applyNeuralPersonaGraphViewState,
  mergeNeuralPersonaGraphViewState,
  type NeuralPersonaGraphPixiViewState,
} from '../src/components/settings/neuralPersonaGraphPixiViewState';

const view = {
  clusters: [], edges: [], graphVersion: 'g1', roleId: 'role-a', tagIds: [],
  nodes: [
    { nodeId: 'node:existing', x: 10, y: 20 },
    { nodeId: 'node:new', x: 30, y: 40 },
  ],
} as NeuralPersonaGraphExplorerView;
const retained: NeuralPersonaGraphPixiViewState = {
  nodePositions: { 'node:existing': { x: 410, y: -220 }, 'node:deleted': { x: 1, y: 2 } },
  viewport: { scale: 1.8, x: -320, y: 180 },
};
const restored = applyNeuralPersonaGraphViewState(view, retained);
assert.deepEqual(restored.nodes.find((node) => node.nodeId === 'node:existing'), {
  ...view.nodes[0], x: 410, y: -220,
});
assert.deepEqual(restored.nodes.find((node) => node.nodeId === 'node:new'), view.nodes[1]);
assert.deepEqual(retained.viewport, { scale: 1.8, x: -320, y: 180 });
const merged = mergeNeuralPersonaGraphViewState(retained, {
  nodePositions: { 'node:new': { x: 90, y: 120 } },
  viewport: { scale: 0.8, x: 12, y: 24 },
});
assert.deepEqual(merged.nodePositions, {
  'node:deleted': { x: 1, y: 2 },
  'node:existing': { x: 410, y: -220 },
  'node:new': { x: 90, y: 120 },
});
assert.deepEqual(merged.viewport, { scale: 0.8, x: 12, y: 24 });

const hookSource = fs.readFileSync(
  'src/components/settings/useNeuralPersonaGraphPixiCanvas.ts', 'utf8',
);
const runtimeSource = fs.readFileSync(
  'src/components/settings/neuralPersonaGraphPixiRuntime.ts', 'utf8',
);
assert.match(hookSource, /runtime\.getViewState\(\)/u);
assert.match(hookSource, /VIEW_STATE_BY_ROLE\.delete/u);
assert.match(hookSource, /const VIEW_STATE_BY_ROLE = new Map/u);
assert.match(runtimeSource, /initialViewState/u);
assert.match(runtimeSource, /getViewState/u);
assert.match(runtimeSource, /resetNodes: options\.view\.nodes/u);

console.log('neural persona graph view retention smoke ok');
