import { useState } from 'react';
import type { NeuralPersonaEdgeType, NeuralPersonaNode } from '../../../character-graph/neural-persona';
import { usePopoverDismiss } from './usePopoverDismiss';
import { MEMORY_LINK_RELATIONS, memoryNoteTitle, memoryTypeLabel } from './neuralMemoryNotes';

/** Search box + list for choosing which memory to link, with the relation kind. */
export function NeuralMemoryLinkPicker(props: {
  anchorText?: string;
  candidates: NeuralPersonaNode[];
  onClose: () => void;
  onPick: (targetNodeId: string, relation: NeuralPersonaEdgeType) => void;
}) {
  const [query, setQuery] = useState(props.anchorText ?? '');
  const [relation, setRelation] = useState<NeuralPersonaEdgeType>('associated-with');
  const ref = usePopoverDismiss<HTMLDivElement>(true, props.onClose, '[data-memory-link-picker-toggle]');
  const needle = query.trim().toLocaleLowerCase();
  const matches = props.candidates.filter((node) => !needle
    || node.influenceSummary.toLocaleLowerCase().includes(needle)).slice(0, 30);
  const shown = matches.length ? matches : props.candidates.slice(0, 30);
  return (
    <div ref={ref} data-memory-link-picker className="space-y-2 rounded-sm border border-primary/40 bg-background p-2 shadow-lg">
      {props.anchorText ? (
        <div className="text-3xs text-muted-foreground">把“<span className="text-primary">{props.anchorText}</span>”关联到：</div>
      ) : null}
      <div className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && shown[0]) props.onPick(shown[0].nodeId, relation);
          }}
          placeholder="搜索要关联的记忆"
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary"
        />
        <select value={relation} onChange={(event) => setRelation(event.target.value as NeuralPersonaEdgeType)} className="h-7 rounded-sm border border-border bg-background px-1 text-2xs">
          {MEMORY_LINK_RELATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {needle && !matches.length ? <div className="text-3xs text-muted-foreground">没有包含这段文字的记忆，下面是全部记忆。</div> : null}
      <div className="custom-scrollbar max-h-48 space-y-0.5 overflow-y-auto">
        {shown.map((node) => (
          <button
            key={node.nodeId}
            type="button"
            onClick={() => props.onPick(node.nodeId, relation)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-2xs hover:bg-primary/10"
          >
            <span className="shrink-0 text-3xs text-muted-foreground">{memoryTypeLabel(node.type)}</span>
            <span className="min-w-0 truncate">{memoryNoteTitle(node, 40)}</span>
          </button>
        ))}
        {!props.candidates.length ? <div className="px-2 py-1 text-3xs text-muted-foreground">还没有其他记忆可以关联。</div> : null}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={props.onClose} className="text-3xs text-muted-foreground hover:text-foreground">取消</button>
      </div>
    </div>
  );
}
