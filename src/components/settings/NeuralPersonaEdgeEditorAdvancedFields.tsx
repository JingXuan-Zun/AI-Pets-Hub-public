import type { Dispatch, SetStateAction } from 'react';
import type { NeuralPersonaEdgeEditorDraft } from './neuralPersonaEdgeEditorDraft';

export function NeuralPersonaEdgeEditorAdvancedFields(props: {
  createMode: boolean;
  draft: NeuralPersonaEdgeEditorDraft;
  setDraft: Dispatch<SetStateAction<NeuralPersonaEdgeEditorDraft>>;
}) {
  const set = <K extends keyof NeuralPersonaEdgeEditorDraft>(key: K, value: NeuralPersonaEdgeEditorDraft[K]) => props.setDraft((current) => ({ ...current, [key]: value }));
  const inputClass = 'h-8 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary';
  return (
    <details className="rounded-sm border border-border/70 bg-background/40 p-3">
      <summary className="cursor-pointer text-2xs text-muted-foreground">高级设置</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>内部关系 ID</span><input disabled={!props.createMode} value={props.draft.edgeId} onChange={(event) => set('edgeId', event.target.value)} className={inputClass} /></label>
        {([['weight', '关系强度'], ['confidence', '可信度']] as const).map(([key, label]) => <label key={key} className="grid grid-cols-[72px_1fr] items-center gap-2 text-3xs text-muted-foreground"><span>{label}</span><input type="number" min="0" max="1" step="0.05" value={props.draft[key]} onChange={(event) => set(key, event.target.value)} className={inputClass} /></label>)}
      </div>
    </details>
  );
}
