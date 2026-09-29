import { StrictMode, useRef, useState, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildNeuralPersonaGraphExplorerView,
  EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
  type NeuralPersonaEdgeType,
  type NeuralPersonaGraphProjection,
  type NeuralPersonaNodeType,
} from '../../src/character-graph/neural-persona';
import { NeuralPersonaGraphCanvas } from '../../src/components/settings/NeuralPersonaGraphCanvas';

const NODE_TYPES: NeuralPersonaNodeType[] = [
  'identity-reference',
  'memory-reference',
  'experience',
  'preference',
  'emotional-tendency',
];
const EDGE_TYPE: NeuralPersonaEdgeType = 'associated-with';

function buildProjection(): NeuralPersonaGraphProjection {
  const nodes = Array.from({ length: 30 }, (_, index) => ({
    incomingCount: index === 0 ? 0 : 1,
    label: `节点 ${String(index).padStart(2, '0')}`,
    nodeId: `node-${index}`,
    outgoingCount: index < 29 ? 1 : 0,
    protected: index === 0,
    scope: 'private' as const,
    status: 'active' as const,
    tagIds: [`group-${index % 5}`],
    type: NODE_TYPES[index % NODE_TYPES.length],
  }));
  const chainEdges = Array.from({ length: 29 }, (_, index) => ({
    edgeId: `chain-${index}`,
    relationType: EDGE_TYPE,
    sourceNodeId: `node-${index}`,
    targetNodeId: `node-${index + 1}`,
    weight: 0.7,
  }));
  const rootEdges = Array.from({ length: 5 }, (_, index) => ({
    edgeId: `root-${index + 2}`,
    relationType: EDGE_TYPE,
    sourceNodeId: 'node-0',
    targetNodeId: `node-${index + 2}`,
    weight: 0.85,
  }));
  return { edges: [...chainEdges, ...rootEdges], graphVersion: 'harness.v1', nodes, roleId: 'harness' };
}

function useDragFrameProbe() {
  const [summary, setSummary] = useState('等待拖动');
  const sample = useRef({ active: false, frames: 0, moves: 0, startedAt: 0 });
  const tick = () => {
    if (!sample.current.active) return;
    sample.current.frames += 1;
    requestAnimationFrame(tick);
  };
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-neural-graph-canvas]')) return;
    sample.current = { active: true, frames: 0, moves: 0, startedAt: performance.now() };
    requestAnimationFrame(tick);
  };
  const move = () => {
    if (sample.current.active) sample.current.moves += 1;
  };
  const end = () => {
    if (!sample.current.active) return;
    sample.current.active = false;
    const duration = Math.max(1, performance.now() - sample.current.startedAt);
    const fps = Math.round((sample.current.frames * 1000) / duration);
    setSummary(`${fps} FPS · ${sample.current.moves} pointermove · ${Math.round(duration)} ms`);
  };
  return { begin, end, move, summary };
}

function GraphHarness() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const probe = useDragFrameProbe();
  const view = buildNeuralPersonaGraphExplorerView(buildProjection(), EMPTY_NEURAL_PERSONA_GRAPH_FILTERS);
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold">神经人格图谱 30 节点拖动压测</h1>
          <output data-testid="graph-harness-metrics" className="font-mono text-xs">{probe.summary}</output>
        </div>
        <div onPointerDownCapture={probe.begin} onPointerMoveCapture={probe.move} onPointerUpCapture={probe.end} onPointerCancelCapture={probe.end}>
          <NeuralPersonaGraphCanvas view={view} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onSelectEdge={() => undefined} />
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><GraphHarness /></StrictMode>);
