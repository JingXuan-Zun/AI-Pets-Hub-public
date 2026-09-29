import { useEffect, useState } from 'react';
import type { NeuralPersonaActivationPreview } from '../../character-graph/neural-persona';
import type { PetConfig, PetPersonality } from '../../types';
import { NeuralPersonaActivationPreviewPanel } from './NeuralPersonaActivationPreviewPanel';
import { NeuralPersonaEdgeEditor } from './NeuralPersonaEdgeEditor';
import { NeuralPersonaFeedbackPanel } from './NeuralPersonaFeedbackPanel';
import { NeuralPersonaGraphExchangePanel } from './NeuralPersonaGraphExchangePanel';
import { NeuralPersonaGraphExplorer } from './NeuralPersonaGraphExplorer';
import { NeuralPersonaLearningProposalPanel } from './NeuralPersonaLearningProposalPanel';
import { NeuralPersonaNodeBatchDeletePanel } from './NeuralPersonaNodeBatchDeletePanel';
import { NeuralPersonaNodeGenerationPanel } from './NeuralPersonaNodeGenerationPanel';
import { NeuralPersonaNodeResourceManager } from './NeuralPersonaNodeResourceManager';
import { NeuralPersonaProviderPanel } from './NeuralPersonaProviderPanel';
import { NeuralPersonaRelationshipCandidatePanel } from './NeuralPersonaRelationshipCandidatePanel';
import { NeuralPersonaTagReviewInbox } from './NeuralPersonaTagReviewInbox';
import { useNeuralPersonaGraphFullscreen } from './useNeuralPersonaGraphFullscreen';
import {
  type NeuralPersonaGraphSectionState,
  useNeuralPersonaGraphSectionState,
} from './useNeuralPersonaGraphSectionState';

type Controller = ReturnType<typeof useNeuralPersonaGraphSectionState> & {
  applicationEnabled: boolean;
  feedbackEnabled: boolean;
  onProviderSettingsUpdate: (updates: Partial<PetConfig['settings']>) => void;
  personality: PetPersonality;
  providerSettings: PetConfig['settings'];
};
type ReadyState = Extract<NeuralPersonaGraphSectionState, { status: 'ready' }>;

function GraphEditorPanels(props: { controller: Controller; state: ReadyState }) {
  const { controller, state } = props;
  const selectedNode = state.record.graph.nodes.find(
    (node) => node.nodeId === controller.selectedNodeId,
  ) ?? null;
  const selectedEdge = state.record.graph.edges.find(
    (edge) => edge.edgeId === controller.selectedEdgeId,
  ) ?? null;
  const protectedIds = new Set(state.record.graph.nodes.filter(
    (node) => node.protected,
  ).map((node) => node.nodeId));
  const protectedRelationship = Boolean(selectedEdge && (
    protectedIds.has(selectedEdge.sourceNodeId) || protectedIds.has(selectedEdge.targetNodeId)
  ));
  const personaAnchorIds = new Set(state.record.graph.nodes.filter(
    (node) => node.type === 'persona-anchor',
  ).map((node) => node.nodeId));
  const managedPersonaRelationship = Boolean(selectedEdge && (
    personaAnchorIds.has(selectedEdge.sourceNodeId)
      || personaAnchorIds.has(selectedEdge.targetNodeId)
  ));
  return (
    <div className="space-y-3">
      <NeuralPersonaNodeResourceManager batchDeletePanel={<NeuralPersonaNodeBatchDeletePanel edges={state.record.graph.edges} enabled={controller.batchDeleteMode} nodes={state.record.graph.nodes} onDelete={controller.deleteNodes} onSelectionChange={controller.setBatchSelectedNodeIds} selectedNodeIds={controller.batchSelectedNodeIds} />} edges={state.record.graph.edges} nodes={state.record.graph.nodes} onCreate={controller.createNode} onDelete={controller.deleteNode} onSelect={controller.focusNode} onUpdate={controller.updateNode} selectedNodeId={controller.focusNodeId} />
      <NeuralPersonaTagReviewInbox nodes={state.record.graph.nodes} selectedNodeId={controller.selectedNodeId} roleId={state.record.roleId} onStage={controller.stageTagSuggestions} onReview={controller.reviewTagSuggestion} />
      <NeuralPersonaEdgeEditor edge={selectedEdge} edges={state.record.graph.edges} managedPersonaRelationship={managedPersonaRelationship} nodes={state.record.graph.nodes} protectedRelationship={protectedRelationship} onCreate={controller.createEdge} onDelete={controller.deleteEdge} onSelectEdge={controller.setSelectedEdgeId} onUpdate={controller.updateEdge} />
      <NeuralPersonaGraphExchangePanel record={state.record} onPreviewImport={controller.previewImport} onCommitImport={controller.commitImport} />
    </div>
  );
}

function ReadyNeuralPersonaGraphSection(props: {
  controller: Controller;
  state: ReadyState;
}) {
  const [activationPreview, setActivationPreview] = useState<NeuralPersonaActivationPreview | null>(null);
  const { controller, state } = props;
  const display = useNeuralPersonaGraphFullscreen();
  useEffect(() => {
    if (!display.fullscreen && controller.batchDeleteMode) {
      controller.toggleBatchDeleteMode(false);
    }
  }, [display.fullscreen]);
  const setMultiSelectMode = (enabled: boolean) => {
    controller.toggleBatchDeleteMode(enabled);
    if (enabled && !display.fullscreen) display.toggleFullscreen();
  };
  const toggleEditor = () => {
    if (display.fullscreen && controller.batchDeleteMode) {
      controller.toggleBatchDeleteMode(false);
    }
    display.toggleFullscreen();
  };
  return <ReadyNeuralPersonaContent activationPreview={activationPreview} controller={controller}
    display={display} onPreviewChange={setActivationPreview} setMultiSelectMode={setMultiSelectMode}
    state={state} toggleEditor={toggleEditor} />;
}

function ReadyNeuralPersonaContent(props: {
  activationPreview: NeuralPersonaActivationPreview | null;
  controller: Controller;
  display: ReturnType<typeof useNeuralPersonaGraphFullscreen>;
  onPreviewChange: (preview: NeuralPersonaActivationPreview | null) => void;
  setMultiSelectMode: (enabled: boolean) => void;
  state: ReadyState;
  toggleEditor: () => void;
}) {
  const { activationPreview, controller, display, onPreviewChange, setMultiSelectMode, state, toggleEditor } = props;
  return (
    <div className="space-y-3">
      <NeuralPersonaNodeGenerationPanel
        existingSummaries={state.record.graph.nodes.map((node) => node.influenceSummary)}
        onCommit={controller.commitGeneratedNodes}
        onSettingsUpdate={controller.onProviderSettingsUpdate}
        personality={controller.personality}
        record={state.record}
        roleId={state.record.roleId}
        settings={controller.providerSettings}
      />
      <NeuralPersonaRelationshipCandidatePanel
        onCommit={controller.commitRelationshipCandidates}
        record={state.record}
        settings={controller.providerSettings}
      />
      <div ref={display.wrapperRef} data-neural-graph-editor-workspace className={display.fullscreen ? 'fixed inset-0 z-modal h-screen overflow-hidden bg-background p-3 text-foreground' : ''}>
        <div className={display.fullscreen ? 'grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]' : ''}>
          <div className={display.fullscreen ? 'min-h-0 overflow-y-auto pr-1' : ''}>
            <NeuralPersonaGraphExplorer activationPreview={activationPreview} batchSelectedNodeIds={controller.batchSelectedNodeIds} canvasStyle={display.canvasStyle} editorMode={display.fullscreen} focusRootNodeId={controller.focusNodeId} multiSelectMode={controller.batchDeleteMode} onFocusNodeChange={controller.focusNode} onMultiSelectModeChange={setMultiSelectMode} onSelectNodes={controller.selectBatchNodeIds} onToggleEditor={toggleEditor} projection={state.projection} selectedEdgeId={controller.selectedEdgeId} selectedNodeId={controller.selectedNodeId} onSelectedEdgeChange={controller.setSelectedEdgeId} onSelectedNodeChange={controller.selectNodeId} />
          </div>
          {display.fullscreen ? <aside data-neural-graph-editor-panels className="min-h-0 overflow-y-auto pr-1"><GraphEditorPanels controller={controller} state={state} /></aside> : null}
        </div>
      </div>
      <NeuralPersonaActivationPreviewPanel
        onFocusNode={controller.focusNode}
        onPreviewChange={onPreviewChange}
        record={state.record}
      />
      <NeuralPersonaProviderPanel record={state.record} settings={controller.providerSettings} onUpdate={controller.onProviderSettingsUpdate} />
      <NeuralPersonaFeedbackPanel enabled={controller.feedbackEnabled} graphRecord={state.record} selectedNodeId={controller.selectedNodeId} />
      <NeuralPersonaLearningProposalPanel applicationEnabled={controller.applicationEnabled} enabled={controller.feedbackEnabled || controller.applicationEnabled} graphRecord={state.record} selectedNodeId={controller.selectedNodeId} onGraphChanged={controller.refresh} />
    </div>
  );
}

export function SettingsNeuralPersonaGraphSection(props: {
  applicationEnabled: boolean;
  enabled: boolean;
  feedbackEnabled: boolean;
  onProviderSettingsUpdate: (updates: Partial<PetConfig['settings']>) => void;
  personality: PetPersonality;
  roleId: string;
  settings: PetConfig['settings'];
}) {
  const controller = {
    ...useNeuralPersonaGraphSectionState(props.enabled, props.roleId, props.settings),
    applicationEnabled: props.applicationEnabled,
    feedbackEnabled: props.feedbackEnabled,
    onProviderSettingsUpdate: props.onProviderSettingsUpdate,
    personality: props.personality,
    providerSettings: props.settings,
  };
  const { state } = controller;
  if (state.status === 'disabled') return null;
  if (state.status === 'ready') return <ReadyNeuralPersonaGraphSection controller={controller} state={state} />;
  if (state.status === 'missing') return (
    <div className="space-y-3">
      <NeuralPersonaNodeGenerationPanel existingSummaries={[]} onCommit={controller.commitGeneratedNodes} onSettingsUpdate={controller.onProviderSettingsUpdate} personality={controller.personality} roleId={props.roleId} settings={controller.providerSettings} />
      <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
        <div>也可以跳过智能解析，直接创建空图谱。</div>
        <button type="button" onClick={() => void controller.initializeGraph()} className="rounded-sm border border-primary px-3 py-1.5 text-2xs text-primary">创建空图谱</button>
      </section>
    </div>
  );
  return <section className="rounded-sm border border-border bg-secondary/20 p-4 text-xs text-muted-foreground">{state.status === 'loading' ? '正在读取神经人格图谱…' : null}{state.status === 'error' ? `图谱读取失败：${state.message}` : null}</section>;
}
