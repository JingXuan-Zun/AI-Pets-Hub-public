import { useState } from 'react';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createReadonlyNeuralPersonaGraphStore,
  inspectNeuralPersonaActivation,
  type NeuralPersonaActivationPreview,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';

const STATUS_LABELS = { filtered: '未入选', selected: '已激活', suppressed: '被抑制' } as const;

export function NeuralPersonaActivationPreviewPanel(props: {
  onFocusNode?: (nodeId: string) => void;
  onPreviewChange?: (preview: NeuralPersonaActivationPreview | null) => void;
  record: NeuralPersonaPersistedRecord;
}) {
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<NeuralPersonaActivationPreview | null>(null);
  const byId = new Map(props.record.graph.nodes.map((node) => [node.nodeId, node]));
  const run = () => {
    if (!query.trim()) return;
    const store = createReadonlyNeuralPersonaGraphStore(
      props.record.graph, DEFAULT_NEURAL_PERSONA_CONFIG,
    );
    if (!store.valid) return;
    const nextPreview = inspectNeuralPersonaActivation({
      config: DEFAULT_NEURAL_PERSONA_CONFIG,
      input: {
        groupIds: [], includePrivate: true, now: Date.now(), query,
        requestId: `preview:${Date.now()}`, roleId: props.record.roleId,
        sessionId: 'local-preview', subgroupIds: [], turnId: 'local-preview',
      },
      store: store.store,
    });
    setPreview(nextPreview); props.onPreviewChange?.(nextPreview);
  };
  return (
    <section className="space-y-3 rounded-sm border border-cyan-400/30 bg-cyan-400/5 p-4">
      <div><div className="text-xs font-semibold">激活路径预览</div><p className="mt-1 text-2xs text-muted-foreground">只在本地读取当前图谱，不调用模型、不写入图谱。用于检查候选检索、关系传播、抑制和最终入选结果。</p></div>
      <textarea value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-16 w-full resize-y rounded-sm border border-border bg-background/60 p-2 text-xs" placeholder="输入一句测试对话，例如：主人今天心情不好，你会怎样安慰？" />
      <button type="button" disabled={!query.trim()} onClick={run} className="rounded-sm border border-cyan-600 px-3 py-1.5 text-2xs text-cyan-700 disabled:opacity-40">运行本地激活</button>
      {preview ? <div className="space-y-2">
        <div className="flex flex-wrap gap-3 text-3xs text-muted-foreground"><span>初始候选 {preview.candidateCount}</span><span>最终激活 {preview.selectedCount}</span><span>预算 {preview.tokenBudgetUsed}/400</span><span className="font-mono">{preview.traceId}</span></div>
        {preview.nodes.length ? preview.nodes.map((node) => <button key={`${node.status}:${node.nodeId}`} type="button" onClick={() => props.onFocusNode?.(node.nodeId)} className={`block w-full rounded-sm border p-2 text-left text-3xs ${node.status === 'selected' ? 'border-emerald-400/60 bg-emerald-400/10' : node.status === 'suppressed' ? 'border-rose-400/50 bg-rose-400/10' : 'border-border bg-background/30 text-muted-foreground'}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-medium">{STATUS_LABELS[node.status]} · {node.label}</span><span>{node.score.toFixed(3)}</span></div>
          <div className="mt-1 text-muted-foreground">路径：{node.path.map((nodeId) => byId.get(nodeId)?.influenceSummary ?? nodeId).join(' → ')}</div>
          <div className="mt-1 text-muted-foreground">依据：{node.reason.join('、') || '基础权重与置信度'}</div>
        </button>) : <div className="text-2xs text-muted-foreground">当前测试句没有命中可激活节点。</div>}
      </div> : null}
    </section>
  );
}
