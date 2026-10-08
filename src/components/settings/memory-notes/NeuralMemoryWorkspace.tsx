import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Settings2, X } from 'lucide-react';
import type {
  NeuralPersonaEdgeDraft,
  NeuralPersonaNodeDraft,
  NeuralPersonaNodePatch,
  NeuralPersonaPersistedRecord,
} from '../../../character-graph/neural-persona';
import { insertNeuralMemoryLink } from '../../../neural-memory/neuralMemoryLinkInsertion';
import { isNeuralMemoryStagedNode } from '../../../neural-memory/neuralMemoryStaging';
import { requestNeuralMemoryTags } from '../../../neural-memory/neuralMemoryTagSuggestion';
import type { PetConfig } from '../../../types';
import { useStandaloneWindowDrag } from '../../../standaloneWindowDrag';
import { useStandaloneWindowFrame } from '../../../standaloneWindowFrame';
import { NeuralMemoryGraphView } from './NeuralMemoryGraphView';
import { NeuralMemoryNoteEditor, type MemoryCommandResult } from './NeuralMemoryNoteEditor';
import { NeuralMemoryNoteList } from './NeuralMemoryNoteList';
import { groupMemoryNotes, memoryNotes } from './neuralMemoryNotes';
import { memoryHasTag, type MemoryTagFilter } from './neuralMemoryTags';

const ICON_BUTTON = 'rounded p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground';

function newMemoryDraft(): NeuralPersonaNodeDraft {
  return {
    baseWeight: 0.6, confidence: 0.8, decayRate: 0.02,
    influenceSummary: '新记忆',
    nodeId: `memory-manual-${Date.now().toString(36)}`,
    plasticity: 0.3, protected: false, scope: 'private', stability: 0.6,
    status: 'active', tags: [], type: 'experience',
  };
}

export interface NeuralMemoryWorkspaceProps {
  onClose: () => void;
  onCreateEdge: (edge: NeuralPersonaEdgeDraft) => Promise<MemoryCommandResult>;
  onCreateNode: (node: NeuralPersonaNodeDraft) => Promise<MemoryCommandResult>;
  onDeleteEdge: (edgeId: string, confirmProtectedRelationship: boolean) => Promise<MemoryCommandResult>;
  onDeleteNode: (nodeId: string, confirmProtectedNode: boolean) => Promise<MemoryCommandResult>;
  onOpen: () => void;
  onRefresh: () => Promise<unknown> | void;
  onUpdateNode: (nodeId: string, patch: NeuralPersonaNodePatch) => Promise<MemoryCommandResult>;
  open: boolean;
  record: NeuralPersonaPersistedRecord;
  roleName: string;
  /** Model settings for automatic tags. */
  settings: PetConfig['settings'];
  tools: ReactNode;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

/** Compact title + open button, laid over the top-left of the graph preview. */
function WorkspaceSummary(props: { onOpen: () => void; record: NeuralPersonaPersistedRecord; roleName: string }) {
  const notes = memoryNotes(props.record.graph);
  const staged = notes.filter(isNeuralMemoryStagedNode).length;
  return (
    <div data-memory-workspace-summary className="flex items-center gap-2 rounded-md bg-background/80 py-1 pl-2 pr-1 text-2xs shadow-sm backdrop-blur-sm">
      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
      <span className="font-semibold text-foreground">{props.roleName || '当前角色'}的记忆</span>
      <span className="text-muted-foreground" title="在工作台里编辑记忆、建立关联、查看关系图谱">
        {notes.length} 条{staged ? ` · ${staged} 条暂存` : ''}
      </span>
      <button type="button" onClick={props.onOpen} className="ml-1 shrink-0 rounded bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
        打开工作台
      </button>
    </div>
  );
}

/** Full-window, Obsidian-style memory workspace: list, wide editor and a light graph. */
export function NeuralMemoryWorkspace(props: NeuralMemoryWorkspaceProps) {
  const { graph } = props.record;
  const notes = memoryNotes(graph);
  const [selectedId, setSelectedId] = useState<string>();
  const [showTools, setShowTools] = useState(false);
  const [tagFilter, setTagFilter] = useState<MemoryTagFilter | null>(null);
  // The workspace covers the settings title bar, so its own header moves the window instead.
  const inOwnWindow = new URLSearchParams(window.location.search).get('panel') === 'settings';
  const windowFrame = useStandaloneWindowFrame({ enabled: inOwnWindow });
  const windowDrag = useStandaloneWindowDrag({ enabled: inOwnWindow, isMaximized: windowFrame.isMaximized });
  const selected = notes.find((note) => note.nodeId === selectedId);

  useEffect(() => {
    if (!selected && notes.length) setSelectedId(groupMemoryNotes(notes, '')[0]?.notes[0]?.nodeId);
  }, [selected, notes.length]);

  if (!props.open) {
    return (
      <div ref={props.wrapperRef}>
        {notes.length ? (
          // Graph preview on the settings page; clicking a memory opens it in the workspace.
          <section data-memory-graph-preview className="relative h-[460px] overflow-hidden rounded-sm border border-border bg-background/60 text-foreground/70">
            <div className="absolute left-3 top-3 z-10">
              <WorkspaceSummary onOpen={props.onOpen} record={props.record} roleName={props.roleName} />
            </div>
            <NeuralMemoryGraphView
              graph={graph}
              onSelect={(nodeId) => { setSelectedId(nodeId); props.onOpen(); }}
              roleId={props.record.roleId}
              selectedNodeId={selected?.nodeId}
            />
          </section>
        ) : (
          // No memories yet: still offer the way into the workspace to write the first one.
          <WorkspaceSummary onOpen={props.onOpen} record={props.record} roleName={props.roleName} />
        )}
      </div>
    );
  }

  const createMemory = async () => {
    const draft = newMemoryDraft();
    if ((await props.onCreateNode(draft)).status === 'ok') setSelectedId(draft.nodeId);
  };
  const autoTag = async (nodeId: string) => {
    const node = notes.find((note) => note.nodeId === nodeId);
    if (!node) return '';
    const added = await requestNeuralMemoryTags(node, notes, props.roleName, props.settings);
    if (!added.length) return '没有新的标签';
    const result = await props.onUpdateNode(nodeId, { tags: [...node.tags, ...added] });
    return result.status === 'ok' ? `已添加 ${added.map((tag) => tag.label).join('、')}` : `保存失败：${result.reason ?? result.status}`;
  };
  const dropLink = async (sourceNodeId: string, targetNodeId: string, offset: number) => {
    const result = await insertNeuralMemoryLink({
      offset, roleId: props.record.roleId, sourceNodeId, targetNodeId,
    });
    await props.onRefresh();
    return result;
  };

  // Portal to <body>: the settings shell's backdrop-filter would otherwise trap
  // `fixed` inside the middle column instead of covering the whole window.
  return createPortal(
    <div ref={props.wrapperRef} data-memory-workspace className="fixed inset-0 z-modal flex flex-col overflow-hidden bg-background text-foreground">
      <header
        className="flex h-10 shrink-0 select-none items-center gap-2 border-b border-border/70 px-3 text-xs"
        onPointerDown={windowDrag.startWindowDrag}
        onDoubleClick={(event) => {
          if (inOwnWindow && !(event.target as HTMLElement).closest('button')) windowFrame.toggleMaximizeWindow();
        }}
      >
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">记忆</span>
        <span className="text-muted-foreground">· {props.roleName || '当前角色'} · {notes.length} 条</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" title="工具" aria-label="工具" onClick={() => setShowTools(!showTools)} className={`${ICON_BUTTON} ${showTools ? 'text-primary' : ''}`}><Settings2 className="h-4 w-4" /></button>
          <button type="button" title="退出（Esc）" aria-label="退出" onClick={props.onClose} className={ICON_BUTTON}><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="relative grid min-h-0 flex-1 grid-cols-[260px_minmax(420px,1fr)_minmax(360px,0.9fr)] grid-rows-[minmax(0,1fr)]">
        <div className="h-full min-h-0 border-r border-border/70 bg-secondary/40">
          <NeuralMemoryNoteList
            notes={notes}
            onClearTagFilter={() => setTagFilter(null)}
            onCreate={() => void createMemory()}
            onDelete={(nodeId) => {
              void props.onDeleteNode(nodeId, false).then((result) => {
                if (result.status === 'ok' && nodeId === selectedId) setSelectedId(undefined);
              });
            }}
            onSelect={setSelectedId}
            selectedNodeId={selected?.nodeId}
            tagFilter={tagFilter}
          />
        </div>
        <main className="custom-scrollbar min-h-0 overflow-y-auto">
          {selected ? (
            <NeuralMemoryNoteEditor
              activeTagFilterId={tagFilter?.id}
              graph={graph}
              node={selected}
              onCreateEdge={props.onCreateEdge}
              onDelete={async () => {
                const result = await props.onDeleteNode(selected.nodeId, false);
                if (result.status === 'ok') setSelectedId(undefined);
                return result;
              }}
              onDeleteEdge={(edgeId) => props.onDeleteEdge(edgeId, false)}
              onAutoTag={() => autoTag(selected.nodeId)}
              onDropLink={(targetNodeId, offset) => dropLink(selected.nodeId, targetNodeId, offset)}
              onFilterTag={(filter) => setTagFilter(tagFilter?.id === filter.id ? null : filter)}
              onSelect={setSelectedId}
              onUpdate={(patch) => props.onUpdateNode(selected.nodeId, patch)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">选择左边的一条记忆，或者新建一条</div>
          )}
        </main>
        <section className="relative min-h-0 border-l border-border/70 bg-secondary/40 text-foreground/70">
          <NeuralMemoryGraphView
            graph={graph}
            highlightNodeIds={tagFilter ? new Set(notes.filter((note) => memoryHasTag(note, tagFilter.id)).map((note) => note.nodeId)) : undefined}
            onSelect={setSelectedId}
            roleId={props.record.roleId}
            selectedNodeId={selected?.nodeId}
          />
        </section>
        {showTools ? (
          <aside data-memory-tools className="absolute inset-y-0 right-0 z-20 w-[min(520px,90vw)] space-y-3 overflow-y-auto custom-scrollbar border-l border-border bg-background p-3 shadow-xl">
            {props.tools}
          </aside>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
