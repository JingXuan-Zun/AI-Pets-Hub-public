import type {
  NeuralPersonaNode,
  NeuralPersonaRelationshipCandidate,
} from '../../character-graph/neural-persona';

const fieldClass = 'rounded-sm border border-border bg-background/60 px-2 py-1.5 text-2xs';
const RELATIONS: Array<{ label: string; value: NeuralPersonaRelationshipCandidate['relationType'] }> = [
  { label: '相关联', value: 'associated-with' },
  { label: '支持', value: 'supports' },
  { label: '触发', value: 'triggers' },
  { label: '抑制', value: 'inhibits' },
  { label: '冲突', value: 'opposes' },
];

function nodeLabel(node: NeuralPersonaNode) {
  const value = node.influenceSummary.replace(/\s+/gu, ' ').trim();
  return value.length > 28 ? `${value.slice(0, 27)}…` : value;
}

export function NeuralPersonaRelationshipCandidateCard(props: {
  candidate: NeuralPersonaRelationshipCandidate;
  nodes: NeuralPersonaNode[];
  onChange: (patch: Partial<NeuralPersonaRelationshipCandidate>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="space-y-2 rounded-sm border border-border bg-background/30 p-3">
      <div className="flex items-center gap-2 text-2xs">
        <input type="checkbox" checked={props.candidate.enabled} onChange={(event) => props.onChange({ enabled: event.target.checked })} />
        <span>{props.candidate.origin === 'model' ? '模型候选'
          : props.candidate.origin === 'local' ? '本地连续关系' : '用户新增'}</span>
        <button type="button" onClick={props.onRemove} className="ml-auto text-muted-foreground hover:text-destructive">删除</button>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_100px_1fr]">
        <select value={props.candidate.sourceNodeId} onChange={(event) => props.onChange({ sourceNodeId: event.target.value })} className={fieldClass}>{props.nodes.map((node) => <option key={node.nodeId} value={node.nodeId}>{nodeLabel(node)}</option>)}</select>
        <select value={props.candidate.relationType} onChange={(event) => props.onChange({ relationType: event.target.value as NeuralPersonaRelationshipCandidate['relationType'] })} className={fieldClass}>{RELATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select value={props.candidate.targetNodeId} onChange={(event) => props.onChange({ targetNodeId: event.target.value })} className={fieldClass}>{props.nodes.map((node) => <option key={node.nodeId} value={node.nodeId}>{nodeLabel(node)}</option>)}</select>
      </div>
      <textarea maxLength={240} value={props.candidate.reason} onChange={(event) => props.onChange({ reason: event.target.value })} className={`${fieldClass} min-h-14 w-full resize-y`} placeholder="为什么这两个节点存在该关系" />
      <div className="grid gap-2 text-3xs text-muted-foreground md:grid-cols-2">
        <label className="grid grid-cols-[40px_1fr_34px] items-center gap-2"><span>强度</span><input type="range" min="0" max="1" step="0.05" value={props.candidate.weight} onChange={(event) => props.onChange({ weight: Number(event.target.value) })} /><span>{props.candidate.weight.toFixed(2)}</span></label>
        <label className="grid grid-cols-[40px_1fr_34px] items-center gap-2"><span>置信</span><input type="range" min="0" max="1" step="0.05" value={props.candidate.confidence} onChange={(event) => props.onChange({ confidence: Number(event.target.value) })} /><span>{props.candidate.confidence.toFixed(2)}</span></label>
      </div>
    </article>
  );
}
