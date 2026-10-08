import {
  inspectNeuralPersonaRelationshipCoverage,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import type { PetConfig } from '../../types';
import { NeuralPersonaRelationshipCandidateCard } from './NeuralPersonaRelationshipCandidateCard';
import { useNeuralPersonaRelationshipCandidates } from './useNeuralPersonaRelationshipCandidates';
import type { useNeuralPersonaGraphSectionState } from './useNeuralPersonaGraphSectionState';

type CommitAction = ReturnType<typeof useNeuralPersonaGraphSectionState>['commitRelationshipCandidates'];

function editableNodes(record: NeuralPersonaPersistedRecord) {
  return record.graph.nodes.filter((node) => node.status === 'active' && !node.protected
    && !['persona-anchor', 'cognitive-domain', 'cognitive-topic'].includes(node.type));
}

export function NeuralPersonaRelationshipCandidatePanel(props: {
  onCommit: CommitAction;
  record: NeuralPersonaPersistedRecord;
  settings: PetConfig['settings'];
}) {
  const controller = useNeuralPersonaRelationshipCandidates(props);
  const nodes = editableNodes(props.record);
  const coverage = inspectNeuralPersonaRelationshipCoverage(props.record.graph);
  const selected = controller.batch?.candidates.filter((candidate) => candidate.enabled) ?? [];
  const canCommit = Boolean(selected.length && !controller.busy);
  return (
    <section className="space-y-3 rounded-sm border border-violet-400/30 bg-violet-400/5 p-4">
      <div><div className="text-xs font-semibold">补全现有节点关系</div><p className="mt-1 text-2xs leading-4 text-muted-foreground">用于修复已经生成但缺少语义边的图谱。模型只提出候选，人工确认后才写入；contains 仍只负责层级结构。</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={Boolean(controller.busy) || nodes.length < 2} onClick={() => void controller.generate()} className="rounded-sm border border-violet-400 px-3 py-1.5 text-2xs text-violet-300 disabled:opacity-40">{controller.busy === 'generating' ? '正在分析……' : '智能分析关系'}</button>
        {controller.busy === 'generating' ? <button type="button" onClick={controller.cancel} className="rounded-sm border border-border px-3 py-1.5 text-2xs">取消</button> : null}
        <button type="button" onClick={controller.add} disabled={nodes.length < 2 || Boolean(controller.busy)} className="rounded-sm border border-border px-3 py-1.5 text-2xs disabled:opacity-40">手动新增关系</button>
        <span className="ml-auto text-3xs text-muted-foreground">可分析节点 {nodes.length} · 已有语义边 {coverage.semanticEdgeCount} · 覆盖 {coverage.connectedContentNodeCount}/{coverage.contentNodeCount}</span>
      </div>
      {coverage.unconnectedContentNodeIds.length ? <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-2 text-3xs leading-4 text-amber-700">仍有 {coverage.unconnectedContentNodeIds.length} 个内容节点没有语义关系；这不是结构层级缺失，先运行关系分析并审核候选。`associated-with` 写入后会按双向路径传播。</div> : <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 p-2 text-3xs text-emerald-700">内容节点已经有语义关系覆盖。结构 `contains` 仍只负责组织，不参与激活。</div>}
      {!props.settings.neuralPersonaProviderDataEgressConsent ? <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 p-2 text-3xs text-amber-700">尚未允许把节点内容发送给当前模型。可在下方“模型语义与智能标签”区域开启授权。</div> : null}
      {controller.message ? <div role="status" className="rounded-sm border border-border bg-background/40 p-2 text-2xs text-muted-foreground">{controller.message}</div> : null}
      {controller.batch ? <div className="space-y-2">
        <div className="text-3xs text-muted-foreground">候选 {controller.batch.candidates.length} · 准备写入 {selected.length} · 基于 revision {controller.batch.revision}</div>
        {controller.batch.candidates.map((candidate) => <NeuralPersonaRelationshipCandidateCard key={candidate.candidateId} candidate={candidate} nodes={nodes} onChange={(patch) => controller.update(candidate.candidateId, patch)} onRemove={() => controller.remove(candidate.candidateId)} />)}
        <button type="button" disabled={!canCommit} onClick={() => void controller.commit()} className="w-full rounded-sm bg-violet-500 px-3 py-2 text-2xs font-semibold text-white disabled:opacity-40">{controller.busy === 'committing' ? '正在写入……' : '确认并写入认知关系'}</button>
      </div> : null}
    </section>
  );
}
