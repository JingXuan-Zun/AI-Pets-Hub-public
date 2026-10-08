import { useEffect, useState } from 'react';
import { MoreVertical, Trash2, X } from 'lucide-react';
import type {
  NeuralPersonaEdgeDraft,
  NeuralPersonaEdgeType,
  NeuralPersonaGraphSnapshot,
  NeuralPersonaNode,
  NeuralPersonaNodePatch,
  NeuralPersonaNodeType,
} from '../../../character-graph/neural-persona';
import { isNeuralMemoryStagedNode } from '../../../neural-memory/neuralMemoryStaging';
import { NeuralMemoryLinkPicker } from './NeuralMemoryLinkPicker';
import { NeuralMemoryNoteAdvanced } from './NeuralMemoryNoteAdvanced';
import { NeuralMemoryNoteContent } from './NeuralMemoryNoteContent';
import { NeuralMemoryNoteTags } from './NeuralMemoryNoteTags';
import type { MemoryTagFilter } from './neuralMemoryTags';
import { usePopoverDismiss } from './usePopoverDismiss';
import {
  MEMORY_NOTE_TYPES,
  memoryLinkRelationLabel,
  memoryNoteLinks,
  memoryNoteTitle,
  memoryNotes,
  memoryTypeLabel,
} from './neuralMemoryNotes';

export type MemoryCommandResult = { status: string; reason?: string };

function failure(result: MemoryCommandResult) {
  if (result.status === 'ok') return '';
  if (result.status === 'conflict') return '图谱刚被修改，已重新读取，请再试一次';
  return `操作失败：${result.reason ?? result.status}`;
}

function NoteMenu(props: { node: NeuralPersonaNode; onDelete: () => void; onSave: (patch: NeuralPersonaNodePatch) => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = usePopoverDismiss<HTMLDivElement>(open, () => { setOpen(false); setConfirmDelete(false); });
  useEffect(() => { setOpen(false); setConfirmDelete(false); }, [props.node.nodeId]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="更多" title="更多" onClick={() => setOpen(!open)} className="rounded p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-20 w-80 space-y-2 rounded-md border border-border bg-background p-2 shadow-lg">
          <NeuralMemoryNoteAdvanced node={props.node} onSave={props.onSave} />
          {confirmDelete ? (
            <div className="flex items-center gap-2 px-1 text-xs">
              删除这条记忆和它的关联？
              <button type="button" onClick={props.onDelete} className="rounded bg-destructive px-2 py-0.5 text-white">删除</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted-foreground">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-destructive/10">删除这条记忆</button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function NeuralMemoryNoteEditor(props: {
  activeTagFilterId?: string;
  graph: NeuralPersonaGraphSnapshot;
  node: NeuralPersonaNode;
  onCreateEdge: (edge: NeuralPersonaEdgeDraft) => Promise<MemoryCommandResult>;
  onDelete: () => Promise<MemoryCommandResult>;
  onDeleteEdge: (edgeId: string) => Promise<MemoryCommandResult>;
  onAutoTag?: () => Promise<string>;
  onDropLink: (targetNodeId: string, offset: number) => Promise<MemoryCommandResult>;
  onFilterTag: (filter: MemoryTagFilter) => void;
  onSelect: (nodeId: string) => void;
  onUpdate: (patch: NeuralPersonaNodePatch) => Promise<MemoryCommandResult>;
}) {
  const { graph, node } = props;
  const [status, setStatus] = useState('');
  const [picker, setPicker] = useState<{ anchorText?: string } | null>(null);
  const [emptyPrompt, setEmptyPrompt] = useState(false);
  // Bumping this remounts the text so 撤销 restores the saved content.
  const [contentVersion, setContentVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setStatus(''); setPicker(null); setEmptyPrompt(false); setConfirmDelete(false); }, [node.nodeId]);
  const links = memoryNoteLinks(graph, node.nodeId);
  const outgoing = links.filter((link) => link.direction === 'outgoing');
  const incoming = links.filter((link) => link.direction === 'incoming');

  const run = async (action: () => Promise<MemoryCommandResult>, done: string) => {
    setStatus('保存中…');
    const result = await action();
    setStatus(failure(result) || done);
    return result;
  };
  const link = (targetNodeId: string, relation: NeuralPersonaEdgeType) => {
    const anchorText = picker?.anchorText;
    setPicker(null);
    void run(() => props.onCreateEdge({
      anchorText, confidence: 0.8,
      edgeId: `memory-link-${node.nodeId}-${targetNodeId}-${Date.now().toString(36)}`,
      relationType: relation, sourceNodeId: node.nodeId, targetNodeId, weight: 0.6,
    }), '已关联');
  };

  return (
    <article data-memory-note-editor className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-10 py-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <select
          value={node.type}
          onChange={(event) => void run(() => props.onUpdate({ type: event.target.value as NeuralPersonaNodeType }), '已保存')}
          className="rounded bg-transparent px-1 py-0.5 hover:bg-black/5"
        >
          {(MEMORY_NOTE_TYPES.includes(node.type) ? MEMORY_NOTE_TYPES : [node.type, ...MEMORY_NOTE_TYPES]).map((type) => (
            <option key={type} value={type}>{memoryTypeLabel(type)}</option>
          ))}
        </select>
        {isNeuralMemoryStagedNode(node) ? (
          <>
            <span className="text-amber-600">暂存，尚未参与对话</span>
            <button type="button" onClick={() => void run(() => props.onUpdate({ status: 'active' }), '已生效')} className="rounded bg-primary px-2 py-0.5 text-primary-foreground">确认生效</button>
          </>
        ) : null}
        <span className="ml-auto">{status}</span>
        {confirmDelete ? (
          <span className="flex items-center gap-1">
            删除这条记忆？
            <button type="button" onClick={() => void run(props.onDelete, '已删除')} className="rounded bg-destructive px-2 py-0.5 text-white">删除</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="px-1 hover:text-foreground">取消</button>
          </span>
        ) : (
          <button type="button" aria-label="删除这条记忆" title="删除这条记忆" onClick={() => setConfirmDelete(true)} className="rounded p-1.5 hover:bg-black/5 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <NoteMenu node={node} onDelete={() => void run(props.onDelete, '已删除')} onSave={(patch) => void run(() => props.onUpdate(patch), '已保存')} />
      </div>

      {emptyPrompt ? (
        <div className="flex items-center gap-2 rounded bg-destructive/5 px-3 py-2 text-xs text-destructive">
          内容为空，删除这条记忆吗？
          <button type="button" onClick={() => void run(props.onDelete, '已删除')} className="rounded bg-destructive px-2 py-0.5 text-white">删除</button>
          <button type="button" onClick={() => { setEmptyPrompt(false); setContentVersion((version) => version + 1); }} className="text-muted-foreground hover:text-foreground">撤销</button>
        </div>
      ) : null}
      <NeuralMemoryNoteContent
        key={`${node.nodeId}:${contentVersion}`}
        content={node.influenceSummary}
        links={links}
        nodeId={node.nodeId}
        onDropLink={(targetNodeId, offset) => void run(() => props.onDropLink(targetNodeId, offset), '已关联')}
        onLinkSelection={(anchorText) => setPicker({ anchorText })}
        onOpenNode={props.onSelect}
        onEmpty={() => setEmptyPrompt(true)}
        onSave={(influenceSummary) => { setEmptyPrompt(false); return run(() => props.onUpdate({ influenceSummary }), '已保存'); }}
      />

      {picker ? (
        <NeuralMemoryLinkPicker
          anchorText={picker.anchorText}
          candidates={memoryNotes(graph).filter((candidate) => candidate.nodeId !== node.nodeId)}
          onClose={() => setPicker(null)}
          onPick={link}
        />
      ) : null}

      <footer className="space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>关联</span>
          {outgoing.map((item) => (
            <span key={item.edge.edgeId} className="group flex items-center gap-0.5">
              <button type="button" onClick={() => props.onSelect(item.other.nodeId)} title={`${memoryLinkRelationLabel(item.edge.relationType)} · ${item.other.influenceSummary}`} className="text-primary hover:underline">
                {memoryNoteTitle(item.other, 16)}
              </button>
              <button type="button" aria-label="解除关联" onClick={() => void run(() => props.onDeleteEdge(item.edge.edgeId), '已解除关联')} className="opacity-0 hover:text-destructive group-hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" data-memory-link-picker-toggle onClick={() => setPicker(picker ? null : {})} className={picker ? 'text-primary' : 'hover:text-foreground'}>+ 关联</button>
        </div>
        {incoming.length ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>被关联</span>
            {incoming.map((item) => (
              <button key={item.edge.edgeId} type="button" onClick={() => props.onSelect(item.other.nodeId)} title={item.other.influenceSummary} className="text-primary hover:underline">
                {memoryNoteTitle(item.other, 16)}
              </button>
            ))}
          </div>
        ) : null}
        <NeuralMemoryNoteTags
          activeFilterId={props.activeTagFilterId}
          key={node.nodeId}
          node={node}
          onAutoTag={props.onAutoTag}
          onFilter={props.onFilterTag}
          onSave={(patch) => void run(() => props.onUpdate(patch), '已保存')}
        />
        <div className="text-[11px] text-muted-foreground/70">提示：把左边的记忆拖进正文会在那里插入关联；按住 Ctrl 点击彩色文字可跳转</div>
      </footer>
    </article>
  );
}
