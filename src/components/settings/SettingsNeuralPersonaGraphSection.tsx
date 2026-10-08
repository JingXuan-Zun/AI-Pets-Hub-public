import type { PetConfig, PetPersonality } from '../../types';
import { NeuralPersonaActivationPreviewPanel } from './NeuralPersonaActivationPreviewPanel';
import { NeuralPersonaFeedbackPanel } from './NeuralPersonaFeedbackPanel';
import { NeuralPersonaGraphExchangePanel } from './NeuralPersonaGraphExchangePanel';
import { NeuralPersonaLearningProposalPanel } from './NeuralPersonaLearningProposalPanel';
import { NeuralPersonaProviderPanel } from './NeuralPersonaProviderPanel';
import { NeuralPersonaRelationshipCandidatePanel } from './NeuralPersonaRelationshipCandidatePanel';
import { NeuralMemoryWorkspace } from './memory-notes/NeuralMemoryWorkspace';
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

function ReadyNeuralPersonaGraphSection(props: {
  controller: Controller;
  state: ReadyState;
}) {
  // The memory workspace takes over the whole settings window while open.
  const display = useNeuralPersonaGraphFullscreen();
  return <ReadyNeuralPersonaContent controller={props.controller} display={display} state={props.state} />;
}

type ReadyContentProps = {
  controller: Controller;
  display: ReturnType<typeof useNeuralPersonaGraphFullscreen>;
  state: ReadyState;
};

// Rarely used analysis, review and data tools live in the workspace's tools drawer.
function NeuralPersonaToolPanels(props: ReadyContentProps) {
  const { controller, state } = props;
  return (
    <>
      <NeuralPersonaTagReviewInbox nodes={state.record.graph.nodes} selectedNodeId={controller.selectedNodeId} roleId={state.record.roleId} onStage={controller.stageTagSuggestions} onReview={controller.reviewTagSuggestion} />
      <NeuralPersonaRelationshipCandidatePanel onCommit={controller.commitRelationshipCandidates} record={state.record} settings={controller.providerSettings} />
      <NeuralPersonaActivationPreviewPanel onFocusNode={controller.focusNode} onPreviewChange={() => undefined} record={state.record} />
      <NeuralPersonaProviderPanel record={state.record} settings={controller.providerSettings} onUpdate={controller.onProviderSettingsUpdate} />
      <NeuralPersonaFeedbackPanel enabled={controller.feedbackEnabled} graphRecord={state.record} selectedNodeId={controller.selectedNodeId} />
      <NeuralPersonaLearningProposalPanel applicationEnabled={controller.applicationEnabled} enabled={controller.feedbackEnabled || controller.applicationEnabled} graphRecord={state.record} selectedNodeId={controller.selectedNodeId} onGraphChanged={controller.refresh} />
      <NeuralPersonaGraphExchangePanel record={state.record} onPreviewImport={controller.previewImport} onCommitImport={controller.commitImport} />
    </>
  );
}

function ReadyNeuralPersonaContent(props: ReadyContentProps) {
  const { controller, display, state } = props;
  return (
    <NeuralMemoryWorkspace
      onClose={display.toggleFullscreen}
      onCreateEdge={controller.createEdge}
      onCreateNode={controller.createNode}
      onDeleteEdge={controller.deleteEdge}
      onDeleteNode={controller.deleteNode}
      onOpen={display.toggleFullscreen}
      onUpdateNode={controller.updateNode}
      open={display.fullscreen}
      record={state.record}
      onRefresh={controller.refresh}
      roleName={controller.personality.name}
      settings={controller.providerSettings}
      tools={<NeuralPersonaToolPanels {...props} />}
      wrapperRef={display.wrapperRef}
    />
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
    <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
      <div>当前角色还没有神经记忆图谱。主体人格保持完整，不会被拆分；之后的记忆会从聊天经历中逐条加入。</div>
      <button type="button" onClick={() => void controller.initializeGraph()} className="rounded-sm border border-primary px-3 py-1.5 text-2xs text-primary">创建图谱</button>
    </section>
  );
  return <section className="rounded-sm border border-border bg-secondary/20 p-4 text-xs text-muted-foreground">{state.status === 'loading' ? '正在读取神经人格图谱…' : null}{state.status === 'error' ? `图谱读取失败：${state.message}` : null}</section>;
}
