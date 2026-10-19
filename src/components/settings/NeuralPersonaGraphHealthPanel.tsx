import {
  inspectNeuralPersonaGraphHealth,
  type NeuralPersonaGraphSnapshot,
} from '../../character-graph/neural-persona';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function NeuralPersonaGraphHealthPanel(props: {
  graph: NeuralPersonaGraphSnapshot;
}) {
  const health = inspectNeuralPersonaGraphHealth(props.graph);
  const warnings = [
    health.unconnectedContentNodeIds.length
      ? `未建立语义关系 ${health.unconnectedContentNodeIds.length}` : '',
    health.missingSourceNodeIds.length
      ? `未绑定原文来源 ${health.missingSourceNodeIds.length}` : '',
    health.invalidSourceReferenceNodeIds.length
      ? `来源引用失效 ${health.invalidSourceReferenceNodeIds.length}` : '',
    health.structurallyOrphanedNodeIds.length
      ? `结构孤立 ${health.structurallyOrphanedNodeIds.length}` : '',
    health.missingParentNodeIds.length
      ? `父节点缺失 ${health.missingParentNodeIds.length}` : '',
    health.directAnchorContentNodeIds.length
      ? `仍直连主人格 ${health.directAnchorContentNodeIds.length}` : '',
    health.duplicateContentNodeGroups.length
      ? `重复内容组 ${health.duplicateContentNodeGroups.length}` : '',
    health.pendingReviewNodeIds.length
      ? `待审核 ${health.pendingReviewNodeIds.length}` : '',
  ].filter(Boolean);
  return (
    <section className="space-y-2 rounded-sm border border-cyan-400/30 bg-cyan-400/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold">人格图谱健康检查</div>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] ${health.healthy ? 'border-emerald-400/50 text-emerald-300' : 'border-amber-400/50 text-amber-200'}`}>
          {health.healthy ? '结构与关系正常' : '存在待处理项'}
        </span>
      </div>
      <div className="grid gap-2 text-[9px] text-muted-foreground sm:grid-cols-3">
        <div>原文档 {health.sourceDocumentCount}</div>
        <div>来源覆盖 {percent(health.sourceReferenceCoverageRatio)}</div>
        <div>语义覆盖 {percent(health.semanticCoverageRatio)}</div>
      </div>
      {warnings.length ? (
        <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-2 text-[9px] leading-4 text-amber-100">
          {warnings.join(' · ')}
        </div>
      ) : (
        <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-2 text-[9px] text-emerald-100">
          当前未发现结构孤立、来源失效、重复内容或语义关系空缺。
        </div>
      )}
      {health.missingSourceNodeIds.length ? (
        <p className="text-[9px] leading-4 text-muted-foreground">
          旧节点允许继续使用；重新从人格原文确认对应节点后，系统会渐进补齐来源，不会强制迁移或删除。
        </p>
      ) : null}
    </section>
  );
}
