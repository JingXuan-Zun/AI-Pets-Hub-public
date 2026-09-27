import type { CSSProperties } from 'react';
import {
  createGeneratedCandidatePreviewNodes,
  validateNeuralPersonaNodeGenerationCandidate,
  validateNeuralPersonaRelationshipCandidate,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import type { PetConfig, PetPersonality } from '../../types';
import { NeuralPersonaNodeGenerationCandidateCard } from './NeuralPersonaNodeGenerationCandidateCard';
import { NeuralPersonaRelationshipCandidateCard } from './NeuralPersonaRelationshipCandidateCard';
import { useNeuralPersonaNodeGeneration } from './useNeuralPersonaNodeGeneration';
import type { useNeuralPersonaGraphSectionState } from './useNeuralPersonaGraphSectionState';

type CommitAction = ReturnType<typeof useNeuralPersonaGraphSectionState>['commitGeneratedNodes'];
type GenerationController = ReturnType<typeof useNeuralPersonaNodeGeneration>;

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

interface PanelProps {
  existingSummaries: string[];
  onCommit: CommitAction;
  onSettingsUpdate: (updates: Partial<PetConfig['settings']>) => void;
  personality: PetPersonality;
  record?: NeuralPersonaPersistedRecord;
  roleId: string;
  settings: PetConfig['settings'];
}

function candidateState(props: PanelProps, controller: GenerationController) {
  const existing = new Set(props.existingSummaries.map(normalized));
  const selected = controller.batch?.candidates.filter((candidate) => candidate.enabled) ?? [];
  const duplicateIds = new Set(selected.filter((candidate) => (
    existing.has(normalized(candidate.influenceSummary))
  )).map((candidate) => candidate.candidateId));
  const invalidCount = controller.batch ? selected.filter((candidate) => (
    validateNeuralPersonaNodeGenerationCandidate(candidate, controller.batch?.sourceText)
  )).length : 0;
  const previewNodes = controller.batch ? createGeneratedCandidatePreviewNodes(
    controller.batch, props.record?.graph.nodes ?? [],
  ) : [];
  const relationships = controller.batch?.relationshipAnalysis?.candidates.filter(
    (candidate) => candidate.enabled,
  ) ?? [];
  const invalidRelationshipCount = relationships.filter((candidate) => (
    validateNeuralPersonaRelationshipCandidate(candidate, previewNodes)
  )).length;
  const relationshipReady = controller.batch?.relationshipAnalysis?.status === 'complete';
  const canCommit = Boolean(controller.batch && selected.length
    && !invalidCount && !invalidRelationshipCount && relationshipReady
    && !controller.busy && !controller.committed);
  return {
    canCommit, duplicateIds, invalidCount, invalidRelationshipCount,
    previewNodes, relationshipReady, relationships, selected,
  };
}

function RelationshipCandidateList(props: {
  controller: GenerationController;
  state: ReturnType<typeof candidateState>;
}) {
  const { controller, state } = props;
  if (!controller.batch) return null;
  const analysis = controller.batch.relationshipAnalysis;
  const pending = analysis?.status === 'pending';
  const stale = analysis?.reason === 'relationship-analysis-stale';
  return (
    <div className="space-y-2 rounded-sm border border-violet-400/30 bg-violet-400/5 p-3">
      <div className="flex items-center gap-2 text-2xs font-semibold">
        <span>节点间语义关系</span>
        <span className="font-normal text-muted-foreground">候选 {analysis?.candidates.length ?? 0} · 准备写入 {state.relationships.length}</span>
        {!state.relationshipReady && !pending ? <button type="button" disabled={Boolean(controller.busy)} onClick={() => void controller.retryRelationshipAnalysis()} className="ml-auto rounded-sm border border-violet-600 px-2 py-1 text-violet-700 disabled:opacity-40">重新分析关系</button> : null}
      </div>
      {pending ? <p className="text-3xs text-violet-700">正在分析候选节点之间的语义关系，请等待分析完成。</p> : null}
      {stale ? <p className="text-3xs text-amber-700">节点候选已经改变，旧关系候选已失效。请重新分析关系。</p> : null}
      {analysis?.status === 'failed' && !stale ? <p className="text-3xs text-amber-700">关系分析失败：{analysis.reason}</p> : null}
      {state.invalidRelationshipCount ? <p className="text-3xs text-destructive">有 {state.invalidRelationshipCount} 条关系无效，请修正。</p> : null}
      {analysis?.candidates.map((candidate) => (
        <NeuralPersonaRelationshipCandidateCard key={candidate.candidateId} candidate={candidate} nodes={state.previewNodes} onChange={(patch) => controller.updateRelationshipCandidate(candidate.candidateId, patch)} onRemove={() => controller.removeRelationshipCandidate(candidate.candidateId)} />
      ))}
    </div>
  );
}

function CandidateList(props: {
  controller: GenerationController;
  state: ReturnType<typeof candidateState>;
}) {
  const { controller, state } = props;
  if (!controller.batch) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-3xs text-muted-foreground">
        <span>候选 {controller.batch.candidates.length}</span><span>准备生成 {state.selected.length}</span>
        <span>将复用现有节点 {state.duplicateIds.size}</span><span>待修正 {state.invalidCount}</span>
        <button type="button" onClick={controller.addCandidate} className="ml-auto text-primary">新增节点</button>
      </div>
      {controller.batch.candidates.map((candidate) => (
        <NeuralPersonaNodeGenerationCandidateCard key={candidate.candidateId} candidate={candidate} duplicate={state.duplicateIds.has(candidate.candidateId)} onChange={(patch) => controller.updateCandidate(candidate.candidateId, patch)} onRemove={() => controller.removeCandidate(candidate.candidateId)} />
      ))}
      <RelationshipCandidateList controller={controller} state={state} />
      <button type="button" disabled={!state.canCommit} onClick={() => void controller.commit()} className="w-full rounded-sm bg-primary px-3 py-2 text-2xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{controller.busy === 'committing' ? '正在生成完整认知图谱……' : controller.committed ? '已经生成' : '确认并生成完整认知图谱'}</button>
    </div>
  );
}

function GenerationStatus(props: {
  controller: GenerationController;
  consent: boolean;
}) {
  const fallback = props.consent
    ? '输入人格文本后点击“智能解析”，候选结果会先进入人工确认列表。'
    : '智能解析尚未授权。请先勾选下方授权，文本才允许发送给当前模型。';
  const message = props.controller.message || fallback;
  const active = Boolean(props.controller.message || props.controller.busy || !props.consent);
  return (
    <div role="status" aria-live="polite" data-neural-node-generation-status className={`rounded-sm border px-3 py-2 text-2xs leading-4 ${active ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border/70 bg-background/30 text-muted-foreground'}`}>
      {message}
    </div>
  );
}

export function NeuralPersonaNodeGenerationPanel(props: PanelProps) {
  const controller = useNeuralPersonaNodeGeneration(props);
  const state = candidateState(props, controller);
  return (
    <section className="space-y-3 rounded-sm border border-primary/30 bg-primary/5 p-4">
      <div>
        <div className="text-xs font-semibold text-foreground">从人格文本智能生成节点</div>
        <p className="mt-1 text-2xs leading-4 text-muted-foreground">系统保留原文语义块，并判断一级认知分支、所属主题、类型和标签。确认后按“主要人格 → 一级分支 → 主题 → 内容节点”建图，不再把全部内容直接连接主体。</p>
      </div>
      <textarea value={controller.sourceText} onChange={(event) => controller.updateSourceText(event.target.value)} className="min-h-28 w-full resize-y rounded-sm border border-border bg-background/60 p-3 text-xs leading-5 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="输入或粘贴完整人格描述，也可以读取当前人格页内容。" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={controller.useCurrentPersonality} className="rounded-sm border border-border px-3 py-1.5 text-2xs text-muted-foreground hover:text-foreground">读取当前人格</button>
        <button type="button" disabled={Boolean(controller.busy)} onClick={() => void controller.generate()} style={{ WebkitAppRegion: 'no-drag' } as CSSProperties} className="cursor-pointer rounded-sm border border-primary bg-primary/10 px-3 py-1.5 text-2xs text-primary hover:bg-primary/20 disabled:cursor-wait disabled:opacity-50">{controller.busy === 'generating' ? '正在解析…' : '智能解析'}</button>
        {controller.busy === 'generating' ? <button type="button" onClick={controller.cancel} className="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-1.5 text-2xs text-destructive hover:bg-destructive/20">取消分析</button> : null}
        <span className="ml-auto text-3xs text-muted-foreground">{controller.sourceText.length}</span>
      </div>
      <GenerationStatus controller={controller} consent={props.settings.neuralPersonaProviderDataEgressConsent} />
      <label className="flex items-start gap-2 rounded-sm border border-border/70 bg-background/30 p-2 text-3xs leading-4 text-muted-foreground">
        <input type="checkbox" checked={props.settings.neuralPersonaProviderDataEgressConsent} onChange={(event) => props.onSettingsUpdate({ neuralPersonaProviderDataEgressConsent: event.target.checked })} className="mt-0.5" />
        允许把本次人格文本发送给当前配置模型进行解析。关闭后不会发出请求。
      </label>
      <CandidateList controller={controller} state={state} />
    </section>
  );
}
