import type { Dispatch, SetStateAction } from 'react';
import type { NeuralPersonaNodeType } from '../../character-graph/neural-persona';
import { NeuralPersonaNodeEditorAdvancedFields } from './NeuralPersonaNodeEditorAdvancedFields';
import {
  applyNeuralPersonaNodeEditorType,
  neuralPersonaNodeTypeNeedsSource,
  type NeuralPersonaNodeEditorDraft,
} from './neuralPersonaNodeEditorDraft';

const NODE_TYPES: Array<[NeuralPersonaNodeType, string]> = [
  ['cognitive-domain', '结构领域'], ['cognitive-topic', '结构主题'],
  ['preference', '偏好'], ['belief-or-viewpoint', '观点'], ['desire-or-goal', '目标'],
  ['emotional-tendency', '情感倾向'], ['style-tendency', '表达风格'],
  ['experience', '经历'], ['relationship-influence', '关系影响'],
  ['concern-or-risk', '担忧或风险'], ['temporary-cognitive-state', '临时认知状态'],
  ['persona-anchor', '主要人格主体'], ['identity-reference', '身份引用'],
  ['knowledge-reference', '知识引用'],
  ['memory-reference', '记忆引用'], ['world-state-reference', '世界状态引用'],
];
export function NeuralPersonaNodeEditorFields(props: {
  createMode: boolean;
  draft: NeuralPersonaNodeEditorDraft;
  setDraft: Dispatch<SetStateAction<NeuralPersonaNodeEditorDraft>>;
}) {
  const set = <K extends keyof NeuralPersonaNodeEditorDraft>(key: K, value: NeuralPersonaNodeEditorDraft[K]) => props.setDraft((current) => ({ ...current, [key]: value }));
  const setType = (type: NeuralPersonaNodeType) => props.setDraft((current) => (
    applyNeuralPersonaNodeEditorType(current, type)
  ));
  const inputClass = 'h-8 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>节点类型</span><select value={props.draft.type} onChange={(event) => setType(event.target.value as NeuralPersonaNodeType)} className={inputClass}>{NODE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <input value={props.draft.tags} onChange={(event) => set('tags', event.target.value)} placeholder="标签，用逗号分隔（可选）" className={inputClass} />
        <textarea value={props.draft.influenceSummary} onChange={(event) => set('influenceSummary', event.target.value)} placeholder="这个节点会怎样影响角色？" className="min-h-20 rounded-sm border border-border bg-background p-2 text-2xs md:col-span-2" />
        {neuralPersonaNodeTypeNeedsSource(props.draft.type) ? <input value={props.draft.sourceRef} onChange={(event) => set('sourceRef', event.target.value)} placeholder="来源引用（必填）" className={`${inputClass} md:col-span-2`} /> : null}
        {props.draft.type === 'temporary-cognitive-state' ? <input type="number" value={props.draft.expiresAt} onChange={(event) => set('expiresAt', event.target.value)} placeholder="过期时间戳（必填）" className={inputClass} /> : null}
        {props.draft.type === 'identity-reference' || props.draft.type === 'persona-anchor' ? <div className="text-3xs text-amber-500">主体或身份引用会自动设为受保护节点。</div> : null}
      </div>
      <NeuralPersonaNodeEditorAdvancedFields createMode={props.createMode} draft={props.draft} setDraft={props.setDraft} />
    </div>
  );
}
