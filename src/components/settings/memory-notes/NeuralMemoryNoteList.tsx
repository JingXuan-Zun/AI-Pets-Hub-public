import { useState } from 'react';
import { PenSquare, Search, X } from 'lucide-react';
import type { NeuralPersonaNode } from '../../../character-graph/neural-persona';
import { isNeuralMemoryStagedNode } from '../../../neural-memory/neuralMemoryStaging';
import { groupMemoryNotes, memoryNoteTitle } from './neuralMemoryNotes';
import { memoryHasTag, type MemoryTagFilter } from './neuralMemoryTags';

/** Drag payload type: dropping a memory into another memory's text links them. */
export const MEMORY_DRAG_TYPE = 'application/x-neural-memory-node';

const ICON_BUTTON = 'rounded p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground';

export function NeuralMemoryNoteList(props: {
  notes: NeuralPersonaNode[];
  onClearTagFilter: () => void;
  onCreate: () => void;
  onDelete: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  selectedNodeId?: string;
  tagFilter: MemoryTagFilter | null;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  // Right-click menu: the first click arms deletion, the second confirms it.
  // The Delete key opens it already armed, so Enter confirms and Esc cancels.
  const [menu, setMenu] = useState<{ armed: boolean; nodeId: string; x: number; y: number } | null>(null);
  const tagged = props.tagFilter ? props.notes.filter((note) => memoryHasTag(note, props.tagFilter!.id)) : props.notes;
  const ordered = groupMemoryNotes(tagged, query).flatMap((group) => group.notes);
  return (
    <aside data-memory-note-list className="relative flex h-full min-h-0 flex-col" onClick={() => setMenu(null)}>
      <div className="flex items-center gap-1 px-3 py-2">
        <button type="button" title="新建记忆" aria-label="新建记忆" onClick={props.onCreate} className={ICON_BUTTON}><PenSquare className="h-4 w-4" /></button>
        <button type="button" title="搜索" aria-label="搜索" onClick={() => { setSearching(!searching); setQuery(''); }} className={`${ICON_BUTTON} ${searching ? 'text-primary' : ''}`}><Search className="h-4 w-4" /></button>
      </div>
      {searching ? (
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索记忆" className="mx-3 mb-2 h-7 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
      ) : null}
      {props.tagFilter ? (
        <div data-memory-tag-filter className="mx-3 mb-2 flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
          <span className="min-w-0 flex-1 truncate">#{props.tagFilter.label} · {tagged.length} 条</span>
          <button type="button" aria-label="清除标签筛选" title="清除标签筛选" onClick={props.onClearTagFilter} className="rounded p-0.5 hover:bg-primary/15"><X className="h-3 w-3" /></button>
        </div>
      ) : null}
      <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {ordered.map((note) => {
          const selected = note.nodeId === props.selectedNodeId;
          return (
            <button
              key={note.nodeId}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(MEMORY_DRAG_TYPE, note.nodeId);
                event.dataTransfer.effectAllowed = 'link';
              }}
              onClick={() => props.onSelect(note.nodeId)}
              onKeyDown={(event) => {
                if (event.key !== 'Delete') return;
                event.preventDefault();
                props.onSelect(note.nodeId);
                const box = event.currentTarget.closest('aside')!.getBoundingClientRect();
                const row = event.currentTarget.getBoundingClientRect();
                setMenu({ armed: true, nodeId: note.nodeId, x: row.left - box.left + 24, y: row.bottom - box.top });
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                const box = event.currentTarget.closest('aside')!.getBoundingClientRect();
                setMenu({ armed: false, nodeId: note.nodeId, x: event.clientX - box.left, y: event.clientY - box.top });
              }}
              title={note.influenceSummary}
              className={`flex w-full items-center gap-1.5 rounded px-3 py-1 text-left text-[13px] leading-6 ${selected ? 'bg-black/[0.06] text-foreground' : 'text-foreground/80 hover:bg-black/[0.04]'}`}
            >
              {isNeuralMemoryStagedNode(note) ? <span title="暂存，尚未生效" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> : null}
              <span className="truncate">{memoryNoteTitle(note, 30)}</span>
            </button>
          );
        })}
        {!ordered.length ? (
          <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">{query || props.tagFilter ? '没有匹配的记忆' : '还没有记忆'}</p>
        ) : null}
      </nav>
      {menu ? (
        <div style={{ left: menu.x, top: menu.y }} className="absolute z-20 min-w-36 rounded-md border border-border bg-background p-1 text-xs shadow-lg" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            autoFocus={menu.armed}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(null); } }}
            onClick={() => {
              if (!menu.armed) { setMenu({ ...menu, armed: true }); return; }
              props.onDelete(menu.nodeId);
              setMenu(null);
            }}
            className="w-full rounded px-2 py-1 text-left text-destructive hover:bg-destructive/10"
          >
            {menu.armed ? '确认删除（Enter）' : '删除这条记忆'}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
