import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysicsConfig,
} from '../../character-graph/neural-persona';
import {
  createNeuralPersonaGraphPixiRuntime,
  type NeuralPersonaGraphPixiRuntime,
} from './neuralPersonaGraphPixiRuntime';
import {
  formatNeuralPersonaGraphDiagnostics,
  type NeuralPersonaGraphDiagnosticsMetadata,
} from './neuralPersonaGraphDiagnostics';
import {
  mergeNeuralPersonaGraphViewState,
  type NeuralPersonaGraphPixiViewState,
} from './neuralPersonaGraphPixiViewState';

const GRAPH_DIAGNOSTICS_ENABLED = (
  import.meta.env?.VITE_NEURAL_PERSONA_GRAPH_DIAGNOSTICS === 'true'
);
const GPU_RENDERER_CACHE = new WeakMap<HTMLCanvasElement, string>();
const VIEW_STATE_BY_ROLE = new Map<string, NeuralPersonaGraphPixiViewState>();

function viewSignature(view: NeuralPersonaGraphExplorerView) {
  const nodes = view.nodes.map((node) => [
    node.nodeId, node.x, node.y, node.label, node.tagIds.join(','), node.status, node.type,
  ].join(':')).join('|');
  const edges = view.edges.map((edge) => [
    edge.edgeId, edge.sourceNodeId, edge.targetNodeId, edge.weight,
  ].join(':')).join('|');
  return `${nodes}#${edges}`;
}

type NeuralPersonaGraphPixiCanvasOptions = {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  focusRootNodeId?: string;
  focusedNodeId?: string;
  multiSelectMode?: boolean;
  onFailure: () => void;
  onFocusNode: (nodeId?: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[], append: boolean) => void;
  physicsConfig: NeuralPersonaGraphPhysicsConfig;
  roleId: string;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
};

function gpuRenderer(canvas: HTMLCanvasElement) {
  const cached = GPU_RENDERER_CACHE.get(canvas);
  if (cached) return cached;
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return 'WebGL context unavailable';
  const extension = gl.getExtension('WEBGL_debug_renderer_info') as {
    UNMASKED_RENDERER_WEBGL: number;
  } | null;
  const renderer = extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'masked';
  const result = renderer.length > 72 ? `${renderer.slice(0, 71)}…` : renderer;
  GPU_RENDERER_CACHE.set(canvas, result);
  return result;
}

function diagnosticsMetadata(ref: RefObject<HTMLPreElement | null>) {
  const canvas = ref.current?.parentElement?.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return undefined;
  const bounds = canvas.getBoundingClientRect();
  return {
    bufferSize: `${canvas.width}x${canvas.height}`,
    cssSize: `${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    focused: document.hasFocus(),
    gpuRenderer: gpuRenderer(canvas),
    visibility: document.visibilityState,
  } satisfies NeuralPersonaGraphDiagnosticsMetadata;
}

function diagnosticsCallback(ref: RefObject<HTMLPreElement | null>) {
  if (!GRAPH_DIAGNOSTICS_ENABLED) return undefined;
  return (sample: Parameters<typeof formatNeuralPersonaGraphDiagnostics>[0]) => {
    if (ref.current) {
      ref.current.textContent = formatNeuralPersonaGraphDiagnostics(
        sample, diagnosticsMetadata(ref),
      );
    }
  };
}

function selection(options: NeuralPersonaGraphPixiCanvasOptions) {
  return {
    activationPreview: options.activationPreview,
    batchSelectedNodeIds: options.batchSelectedNodeIds,
    focusRootNodeId: options.focusRootNodeId,
    focusedNodeId: options.focusedNodeId,
    multiSelectMode: options.multiSelectMode,
    selectedEdgeId: options.selectedEdgeId,
    selectedNodeId: options.selectedNodeId,
  };
}

function createRuntime(options: NeuralPersonaGraphPixiCanvasOptions, host: HTMLDivElement,
  diagnosticsRef: RefObject<HTMLPreElement | null>, initialViewState?: NeuralPersonaGraphPixiViewState) {
  return createNeuralPersonaGraphPixiRuntime({
    callbacks: {
      onFocusNode: options.onFocusNode,
      onSelectEdge: options.onSelectEdge,
      onSelectNode: options.onSelectNode,
      onSelectNodes: options.onSelectNodes,
    },
    host,
    initialViewState,
    onDiagnostics: diagnosticsCallback(diagnosticsRef),
    onFailure: options.onFailure,
    physicsConfig: options.physicsConfig,
    selection: selection(options),
    view: options.view,
  });
}

export function useNeuralPersonaGraphPixiCanvas(options: NeuralPersonaGraphPixiCanvasOptions) {
  const diagnosticsRef = useRef<HTMLPreElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<NeuralPersonaGraphPixiRuntime | null>(null);
  const signature = useMemo(() => viewSignature(options.view), [options.view]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    try {
      const runtime = createRuntime(
        options, host, diagnosticsRef,
        VIEW_STATE_BY_ROLE.get(options.roleId),
      );
      runtimeRef.current = runtime;
      return () => {
        const previous = VIEW_STATE_BY_ROLE.get(options.roleId);
        VIEW_STATE_BY_ROLE.set(
          options.roleId,
          mergeNeuralPersonaGraphViewState(previous, runtime.getViewState()),
        );
        runtimeRef.current = null; runtime.destroy();
      };
    } catch (error) {
      console.warn('[neural-graph-pixi] renderer initialization failed', error);
      options.onFailure();
      return undefined;
    }
  }, [options.roleId, signature]);
  useEffect(() => {
    runtimeRef.current?.setCallbacks({
      onFocusNode: options.onFocusNode,
      onSelectEdge: options.onSelectEdge,
      onSelectNode: options.onSelectNode,
      onSelectNodes: options.onSelectNodes,
    });
  }, [options.onFocusNode, options.onSelectEdge, options.onSelectNode, options.onSelectNodes]);
  useEffect(() => runtimeRef.current?.setPhysicsConfig(options.physicsConfig), [options.physicsConfig]);
  useEffect(() => runtimeRef.current?.setSelection({
    activationPreview: options.activationPreview,
    batchSelectedNodeIds: options.batchSelectedNodeIds,
    focusRootNodeId: options.focusRootNodeId,
    focusedNodeId: options.focusedNodeId,
    multiSelectMode: options.multiSelectMode,
    selectedEdgeId: options.selectedEdgeId,
    selectedNodeId: options.selectedNodeId,
  }), [options.activationPreview?.traceId, options.batchSelectedNodeIds, options.focusRootNodeId,
    options.focusedNodeId, options.multiSelectMode, options.selectedEdgeId, options.selectedNodeId]);
  return { diagnosticsEnabled: GRAPH_DIAGNOSTICS_ENABLED, diagnosticsRef, hostRef,
    reset: () => { VIEW_STATE_BY_ROLE.delete(options.roleId); runtimeRef.current?.reset(); } };
}
