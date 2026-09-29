import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  layoutNeuralPersonaGraphHierarchy,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaGraphViewNode,
} from '../src/character-graph/neural-persona';

function node(nodeId: string, type: NeuralPersonaGraphViewNode['type']) {
  return {
    incomingCount: 0, label: nodeId, nodeId, outgoingCount: 0,
    protected: type === 'persona-anchor', scope: 'private' as const,
    status: 'active' as const, tagIds: [], type,
  };
}

function edge(sourceNodeId: string, targetNodeId: string): NeuralPersonaGraphViewEdge {
  return {
    edgeId: `${sourceNodeId}:${targetNodeId}`, relationType: 'contains',
    sourceNodeId, targetNodeId, weight: 1,
  };
}

function fixture() {
  const nodes = [node('anchor', 'persona-anchor')];
  const edges: NeuralPersonaGraphViewEdge[] = [];
  for (let domainIndex = 0; domainIndex < 7; domainIndex += 1) {
    const domainId = `domain-${domainIndex}`;
    nodes.push(node(domainId, 'cognitive-domain')); edges.push(edge('anchor', domainId));
    for (let topicIndex = 0; topicIndex < 6; topicIndex += 1) {
      const topicId = `${domainId}:topic-${topicIndex}`;
      nodes.push(node(topicId, 'cognitive-topic')); edges.push(edge(domainId, topicId));
      for (let contentIndex = 0; contentIndex < 3; contentIndex += 1) {
        const contentId = `${topicId}:content-${contentIndex}`;
        nodes.push(node(contentId, 'style-tendency')); edges.push(edge(topicId, contentId));
      }
    }
  }
  return { edges, nodes };
}

const graph = fixture();
const layout = layoutNeuralPersonaGraphHierarchy(graph.nodes, graph.edges, {
  height: 900, width: 1400,
});
const physics = createNeuralPersonaGraphPhysics(layout.nodes, graph.edges, {
  dragFollowStrength: 0.65, dragMaxStretch: 60, linkDistance: 92,
  linkStrength: 0.0265, repulsionStrength: 0.59,
});
const initial = new Map(graph.edges.map((value) => {
  const source = physics.getPosition(value.sourceNodeId)!;
  const target = physics.getPosition(value.targetNodeId)!;
  return [value.edgeId, Math.hypot(target.x - source.x, target.y - source.y)];
}));
const maximumError = () => Math.max(...graph.edges.map((value) => {
  const source = physics.getPosition(value.sourceNodeId)!;
  const target = physics.getPosition(value.targetNodeId)!;
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  return Math.abs(distance - initial.get(value.edgeId)!);
}));

const maximumOverstretch = () => Math.max(...graph.edges.map((value) => {
  const source = physics.getPosition(value.sourceNodeId)!;
  const target = physics.getPosition(value.targetNodeId)!;
  return Math.max(0, Math.hypot(
    target.x - source.x, target.y - source.y,
  ) - initial.get(value.edgeId)!);
}));

function worstEdge() {
  return graph.edges.map((value) => {
    const source = physics.getPosition(value.sourceNodeId)!;
    const target = physics.getPosition(value.targetNodeId)!;
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    return {
      current: distance, edgeId: value.edgeId,
      error: Math.abs(distance - initial.get(value.edgeId)!),
      target: initial.get(value.edgeId)!,
    };
  }).sort((left, right) => right.error - left.error)[0];
}

const dragged = physics.getPosition('domain-0')!;
physics.pin('domain-0');
physics.movePinned('domain-0', { x: dragged.x - 3600, y: dragged.y + 1200 });
const releasedError = maximumError();
physics.release('domain-0');
let frames = 0;
let errorAfterThreeSeconds = releasedError;
let errorAfterSixSeconds = releasedError;
while (frames < 2000 && physics.isActive()) {
  physics.step(); frames += 1;
  if (frames === 180) errorAfterThreeSeconds = maximumError();
  if (frames === 360) errorAfterSixSeconds = maximumError();
}
const settledError = maximumError();
const settledOverstretch = maximumOverstretch();

assert.ok(releasedError > 500, `fixture must reproduce a long stretch: ${releasedError}`);
assert.ok(errorAfterThreeSeconds < releasedError * 0.5,
  `long release must visibly rebound within three seconds: ${releasedError} -> ${errorAfterThreeSeconds}`);
assert.ok(errorAfterSixSeconds < releasedError * 0.25,
  `long release must keep recovering: ${releasedError} -> ${errorAfterSixSeconds}`);
assert.ok(settledError < 80,
  `long release must recover structural links after ${frames} frames: ${releasedError} -> ${settledError}; three=${errorAfterThreeSeconds}; six=${errorAfterSixSeconds}; ${JSON.stringify(worstEdge())}`);
assert.ok(settledOverstretch < 8,
  `long release must restore the original maximum link length: ${settledOverstretch}`);

console.log('neural persona graph long release smoke ok', {
  errorAfterSixSeconds, errorAfterThreeSeconds, frames, releasedError,
  settledError, settledOverstretch,
});
