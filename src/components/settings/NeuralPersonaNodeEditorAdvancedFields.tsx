import type { Dispatch, SetStateAction } from 'react';
import type { NeuralPersonaNodeEditorDraft } from './neuralPersonaNodeEditorDraft';

const SCOPES = [
  ['private', '仅当前角色'], ['group', '指定群组'], ['subgroup', '指定子群组'],
  ['world', '世界状态'], ['runtime', '临时运行时'],
] as const;
const STATUSES = [
  ['active', '启用'], ['pending-review', '待审核'],
  ['quarantined', '隔离'], ['deleted', '已删除'],
] as const;
const NUMBERS = [
  ['baseWeight', '基础权重'], ['confidence', '可信度'], ['stability', '稳定性'],
  ['plasticity', '可塑性'], ['decayRate', '衰减率'],
] as const;

export function NeuralPersonaNodeEditorAdvancedFields(props: {
  createMode: boolean;
  draft: NeuralPersonaNodeEditorDraft;
  setDraft: Dispatch<SetStateAction<NeuralPersonaNodeEditorDraft>>;
}) {
  const set = <K extends keyof NeuralPersonaNodeEditorDraft>(key: K, value: NeuralPersonaNodeEditorDraft[K]) => props.setDraft((current) => ({ ...current, [key]: value }));
  const inputClass = 'h-8 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary';
  return (
    <details className="rounded-sm border border-border/70 bg-background/40 p-3">
      <summary className="cursor-pointer text-2xs text-muted-foreground">高级设置</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>内部节点 ID</span><input disabled={!props.createMode} value={props.draft.nodeId} onChange={(event) => set('nodeId', event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>状态</span><select value={props.draft.status} onChange={(event) => set('status', event.target.value as typeof props.draft.status)} className={inputClass}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>可见范围</span><select value={props.draft.scope} onChange={(event) => set('scope', event.target.value as typeof props.draft.scope)} className={inputClass}>{SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex h-8 items-center rounded-sm border border-border bg-secondary/30 px-2 text-3xs text-muted-foreground">父级通过节点资源列表拖动调整</div>
        {props.draft.scope === 'group' ? <input value={props.draft.groupId} onChange={(event) => set('groupId', event.target.value)} placeholder="群组 ID" className={inputClass} /> : null}
        {props.draft.scope === 'subgroup' ? <input value={props.draft.subgroupId} onChange={(event) => set('subgroupId', event.target.value)} placeholder="子群组 ID" className={inputClass} /> : null}
        {NUMBERS.map(([key, label]) => <label key={key} className="grid grid-cols-[72px_1fr] items-center gap-2 text-3xs text-muted-foreground"><span>{label}</span><input type="number" min="0" max="1" step="0.05" value={props.draft[key]} onChange={(event) => set(key, event.target.value)} className={inputClass} /></label>)}
      </div>
    </details>
  );
}
