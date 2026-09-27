import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  layoutNeuralPersonaGraphHierarchy,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaGraphViewNode,
} from '../src/character-graph/neural-persona';
import { hitNeuralPersonaGraphNode } from '../src/components/settings/neuralPersonaGraphPixiHitTesting';

function node(nodeId: string, type: NeuralPersonaGraphViewNode['type']): NeuralPersonaGraphViewNode {
  return {
    incomingCount: 0, label: nodeId, nodeId, outgoingCount: 0,
    protected: type === 'persona-anchor', scope: 'private', status: 'active',
    tagIds: [], type,
  };
}

function edge(sourceNodeId: string, targetNodeId: string): NeuralPersonaGraphViewEdge {
  return {
    edgeId: `${sourceNodeId}:contains:${targetNodeId}`, relationType: 'contains',
    sourceNodeId, targetNodeId, weight: 1,
  };
}

function denseFixture() {
  const nodes = [node('anchor', 'persona-anchor')];
  const edges: NeuralPersonaGraphViewEdge[] = [];
  const domains = Array.from({ length: 7 }, (_, index) => `domain-${index}`);
  domains.forEach((id) => { nodes.push(node(id, 'cognitive-domain')); edges.push(edge('anchor', id)); });
  const topics = Array.from({ length: 43 }, (_, index) => `topic-${index}`);
  topics.forEach((id, index) => {
    const domain = index < 20 ? domains[0] : domains[1 + (index - 20) % 6];
    nodes.push(node(id, 'cognitive-topic')); edges.push(edge(domain, id));
  });
  Array.from({ length: 28 }, (_, index) => `direct-${index}`).forEach((id, index) => {
    const domain = index < 12 ? domains[0] : domains[1 + (index - 12) % 6];
    nodes.push(node(id, 'preference')); edges.push(edge(domain, id));
  });
  Array.from({ length: 51 }, (_, index) => `content-${index}`).forEach((id, index) => {
    nodes.push(node(id, 'style-tendency')); edges.push(edge(topics[index % topics.length], id));
  });
  return { edges, nodes };
}

const fixture = denseFixture();
const viewport = { height: 440, width: 760 };
const layout = layoutNeuralPersonaGraphHierarchy(fixture.nodes, fixture.edges, viewport);
const center = { x: viewport.width / 2, y: viewport.height / 2 };
const radius = (value: { x: number; y: number }) => Math.hypot(
  value.x - center.x, value.y - center.y,
);
const topics = layout.nodes.filter((value) => value.type === 'cognitive-topic');
const content = layout.nodes.filter((value) => ![
  'persona-anchor', 'cognitive-domain', 'cognitive-topic',
].includes(value.type));
const maximumTopicRadius = Math.max(...topics.map(radius));
const minimumContentRadius = Math.min(...content.map(radius));
assert.ok(minimumContentRadius > maximumTopicRadius + 40,
  `content ring must stay outside the topic band: ${minimumContentRadius}/${maximumTopicRadius}`);

const positions = new Map(layout.nodes.map((value) => [value.nodeId, value]));
const edgeLengths = fixture.edges.map((value) => {
  const source = positions.get(value.sourceNodeId)!;
  const target = positions.get(value.targetNodeId)!;
  return Math.hypot(target.x - source.x, target.y - source.y);
});
const maximumEdgeLength = Math.max(...edgeLengths);
assert.ok(maximumEdgeLength <= 340,
  `dense hierarchy must keep structural lines compact: ${maximumEdgeLength}`);

const outer = [...content].sort((left, right) => radius(right) - radius(left))[0];
const physics = createNeuralPersonaGraphPhysics(layout.nodes, fixture.edges);
const before = { ...physics.getPosition(outer.nodeId)! };
const zoomedOutPointer = { x: before.x + 40, y: before.y };
assert.equal(hitNeuralPersonaGraphNode(
  { clusters: [], edges: [], nodes: [outer], tagIds: [] }, physics.getPosition,
  zoomedOutPointer, 10 / 0.2,
), outer.nodeId, 'zoomed-out nodes must keep a usable ten-pixel screen hit target');
physics.pin(outer.nodeId);
physics.movePinned(outer.nodeId, { x: before.x + 180, y: before.y - 120 });
const dragged = physics.getPosition(outer.nodeId)!;
assert.deepEqual({ x: dragged.x - before.x, y: dragged.y - before.y }, { x: 180, y: -120 });

console.log('neural persona graph density layout smoke ok', {
  maximumEdgeLength, maximumTopicRadius, minimumContentRadius,
});
