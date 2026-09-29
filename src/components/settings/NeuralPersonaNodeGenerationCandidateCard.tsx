import type { NeuralPersonaNodeGenerationCandidate } from '../../character-graph/neural-persona';
import {
  GENERATED_NODE_TYPE_OPTIONS,
  parseCandidateTags,
} from './neuralPersonaNodeGenerationUi';

const fieldClass = 'w-full rounded-sm border border-border bg-background/50 px-2 py-1.5 text-2xs focus:outline-none focus:ring-1 focus:ring-primary';

export function NeuralPersonaNodeGenerationCandidateCard(props: {
  candidate: NeuralPersonaNodeGenerationCandidate;
  duplicate: boolean;
  onChange: (patch: Partial<NeuralPersonaNodeGenerationCandidate>) => void;
  onRemove: () => void;
}) {
  const { candidate } = props;
  return (
    <article className={`space-y-2 rounded-sm border p-3 ${props.duplicate ? 'border-amber-500/70 bg-amber-500/5' : 'border-border bg-background/30'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-2xs">
          <input type="checkbox" checked={candidate.enabled} onChange={(event) => props.onChange({ enabled: event.target.checked })} />
          生成
        </label>
        <select value={candidate.type} onChange={(event) => props.onChange({ type: event.target.value as NeuralPersonaNodeGenerationCandidate['type'] })} className={`${fieldClass} max-w-36`}>
          {GENERATED_NODE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-3xs text-muted-foreground">{candidate.origin === 'model' ? '原文候选' : '用户新增'}</span>
        {props.duplicate ? <span className="text-3xs text-amber-500">将复用现有节点并归入对应分支</span> : null}
        <button type="button" onClick={props.onRemove} className="ml-auto text-3xs text-muted-foreground hover:text-destructive">删除</button>
      </div>
      <textarea value={candidate.influenceSummary} onChange={(event) => props.onChange({ influenceSummary: event.target.value })} className={`${fieldClass} min-h-16 resize-y leading-4`} maxLength={240} placeholder="从人格原文中拆出的节点内容，可在确认前编辑" />
      <input value={candidate.topic ?? ''} maxLength={40} onChange={(event) => props.onChange({ topic: event.target.value })} className={fieldClass} placeholder="所属主题，例如：开心、愤怒、安慰表达；留空则只归入一级分支" />
      <input value={candidate.tags.join('、')} onChange={(event) => props.onChange({ tags: parseCandidateTags(event.target.value) })} className={fieldClass} placeholder="标签，用逗号或顿号分隔" />
      <details className="text-3xs text-muted-foreground">
        <summary className="cursor-pointer select-none">依据与参数</summary>
        <div className="mt-2 space-y-2">
          <div className="rounded-sm border border-border/60 bg-secondary/20 p-2 leading-4">{candidate.evidence || '用户手动新增，无模型原文依据。'}</div>
          <label className="grid grid-cols-[64px_1fr_36px] items-center gap-2"><span>影响强度</span><input type="range" min="0" max="1" step="0.05" value={candidate.baseWeight} onChange={(event) => props.onChange({ baseWeight: Number(event.target.value) })} /><span>{candidate.baseWeight.toFixed(2)}</span></label>
          <label className="grid grid-cols-[64px_1fr_36px] items-center gap-2"><span>置信度</span><input type="range" min="0" max="1" step="0.05" value={candidate.confidence} onChange={(event) => props.onChange({ confidence: Number(event.target.value) })} /><span>{candidate.confidence.toFixed(2)}</span></label>
        </div>
      </details>
    </article>
  );
}
