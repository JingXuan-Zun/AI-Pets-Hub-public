import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { NeuralPersonaNode, NeuralPersonaNodePatch } from '../../../character-graph/neural-persona';
import { activeMemoryTags, addMemoryTag, removeMemoryTag, type MemoryTagFilter } from './neuralMemoryTags';

/** Tag row under the links: click a tag to find every memory with it, + to add one. */
export function NeuralMemoryNoteTags(props: {
  activeFilterId?: string;
  node: NeuralPersonaNode;
  /** Asks the model for tags; resolves to a short status for the row. */
  onAutoTag?: () => Promise<string>;
  onFilter: (filter: MemoryTagFilter) => void;
  onSave: (patch: NeuralPersonaNodePatch) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [autoStatus, setAutoStatus] = useState<{ busy: boolean; text: string }>({ busy: false, text: '' });
  const autoTag = async () => {
    if (!props.onAutoTag || autoStatus.busy) return;
    setAutoStatus({ busy: true, text: '正在生成标签…' });
    const text = await props.onAutoTag().catch((error: unknown) => `生成失败：${error instanceof Error ? error.message : String(error)}`);
    setAutoStatus({ busy: false, text });
  };
  const commit = () => {
    // Several tags can be typed at once, separated like the old field: 、 or commas.
    let tags = props.node.tags;
    draft.split(/[,，、]/u).forEach((label) => {
      tags = addMemoryTag({ ...props.node, tags }, label) ?? tags;
    });
    if (tags !== props.node.tags) props.onSave({ tags });
    setDraft('');
    setAdding(false);
  };
  return (
    <div data-memory-note-tags className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>标签</span>
      {activeMemoryTags(props.node).map((tag) => (
        <span key={tag.canonicalId} className="group flex items-center gap-0.5">
          <button
            type="button"
            title={`查找所有带“${tag.label}”的记忆`}
            onClick={() => props.onFilter({ id: tag.canonicalId, label: tag.label })}
            className={`rounded px-1 ${props.activeFilterId === tag.canonicalId ? 'bg-primary/15 text-primary' : 'text-primary/80 hover:text-primary'}`}
          >
            #{tag.label}
          </button>
          <button type="button" aria-label={`移除标签 ${tag.label}`} onClick={() => props.onSave({ tags: removeMemoryTag(props.node, tag.canonicalId) })} className="opacity-0 hover:text-destructive group-hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') { event.stopPropagation(); setDraft(''); setAdding(false); }
          }}
          placeholder="例如：饮食、习惯"
          className="h-6 w-32 rounded border border-border bg-background px-1.5 outline-none focus:border-primary"
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="hover:text-foreground">+ 标签</button>
      )}
      {props.onAutoTag ? (
        <button type="button" disabled={autoStatus.busy} onClick={() => void autoTag()} title="让模型根据内容总结 3～5 个标签（调用一次当前模型）" className="flex items-center gap-1 hover:text-foreground disabled:opacity-50">
          <Sparkles className="h-3 w-3" />自动标签
        </button>
      ) : null}
      {autoStatus.text ? <span className="text-muted-foreground/80">{autoStatus.text}</span> : null}
    </div>
  );
}
