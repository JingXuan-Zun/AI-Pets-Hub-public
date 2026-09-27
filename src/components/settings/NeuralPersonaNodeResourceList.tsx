import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { NeuralPersonaEdge, NeuralPersonaNode } from '../../character-graph/neural-persona';
import {
  buildNeuralPersonaNodeResourceTree,
  canReparentNeuralPersonaResourceNode,
  neuralPersonaNodeResourceMatches,
  type NeuralPersonaNodeResourceTreeItem,
} from './neuralPersonaNodeResourceTree';

type Props = {
  edges: NeuralPersonaEdge[];
  nodes: NeuralPersonaNode[];
  onEdit: (nodeId: string) => void;
  onReparent: (nodeId: string, parentNodeId: string) => Promise<void>;
  onSelect: (nodeId: string) => void;
  selectedNodeId?: string;
};

function label(value: string) {
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length > 30 ? `${text.slice(0, 29)}…` : text;
}

function ResourceSourceRow(props: { depth: number; sourceRef?: string }) {
  if (!props.sourceRef) return null;
  return <div data-neural-node-resource-source style={{ paddingLeft: `${props.depth * 14 + 32}px` }} className="flex h-7 items-center gap-1 truncate text-3xs text-primary/60" title={props.sourceRef}>▧ <span className="truncate">{props.sourceRef}</span></div>;
}

function ResourceRow(props: {
  depth: number; draggingId?: string; dropId?: string; expanded: Set<string>;
  item: NeuralPersonaNodeResourceTreeItem; parents: ReadonlyMap<string, string | undefined>;
  selectedNodeId?: string; setDraggingId: (id?: string) => void; setDropId: (id?: string) => void;
  toggle: (id: string) => void; onEdit: (id: string) => void;
  onReparent: Props['onReparent']; onSelect: (id: string) => void;
}) {
  const { item } = props;
  const hasChildren = item.children.length > 0 || Boolean(item.node.sourceRef);
  const open = props.expanded.has(item.node.nodeId);
  const canDrop = Boolean(props.draggingId && canReparentNeuralPersonaResourceNode(
    props.draggingId, item.node.nodeId, props.parents,
  ));
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (props.draggingId && canDrop) void props.onReparent(props.draggingId, item.node.nodeId);
    props.setDropId(); props.setDraggingId();
  };
  return <div data-neural-node-resource-id={item.node.nodeId}>
    <div draggable={item.node.type !== 'persona-anchor'} onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'move'; props.setDraggingId(item.node.nodeId);
    }} onDragEnd={() => { props.setDraggingId(); props.setDropId(); }}
      onDragOver={(event) => { if (canDrop) { event.preventDefault(); props.setDropId(item.node.nodeId); } }}
      onDragLeave={() => props.dropId === item.node.nodeId && props.setDropId()} onDrop={drop}
      style={{ paddingLeft: `${props.depth * 14 + 6}px` }}
      className={`group flex min-h-8 items-center gap-1 rounded-sm border px-1 text-2xs ${props.dropId === item.node.nodeId ? 'border-cyan-400 bg-cyan-400/10' : props.selectedNodeId === item.node.nodeId ? 'border-primary/60 bg-primary/10' : 'border-transparent hover:bg-secondary/60'}`}>
      <button type="button" disabled={!hasChildren} onClick={() => props.toggle(item.node.nodeId)} className="w-5 shrink-0 text-muted-foreground disabled:opacity-20">{open ? '⌄' : '›'}</button>
      <button type="button" onClick={() => props.onSelect(item.node.nodeId)} onDoubleClick={() => props.onEdit(item.node.nodeId)} className="min-w-0 flex-1 truncate text-left" title={item.node.influenceSummary}>{item.node.type === 'persona-anchor' ? '◆ ' : '● '}{label(item.node.influenceSummary)}</button>
      {item.node.sourceRef ? <span title={item.node.sourceRef} className="text-3xs text-primary/60">文件</span> : null}
      {hasChildren ? <span className="text-3xs text-muted-foreground">{item.children.length}</span> : null}
      <button type="button" onClick={() => props.onEdit(item.node.nodeId)} className="invisible px-1 text-3xs text-primary group-hover:visible">编辑</button>
    </div>
    {open ? <><ResourceSourceRow depth={props.depth + 1} sourceRef={item.node.sourceRef} />{item.children.map((child) => <ResourceRow key={child.node.nodeId} {...props} depth={props.depth + 1} item={child} />)}</> : null}
  </div>;
}

export function NeuralPersonaNodeResourceList(props: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string>();
  const [dropId, setDropId] = useState<string>();
  const tree = useMemo(() => buildNeuralPersonaNodeResourceTree(props.nodes, props.edges), [props.edges, props.nodes]);
  const roots = useMemo(() => tree.roots.map((item) => neuralPersonaNodeResourceMatches(item, query))
    .filter((item): item is NeuralPersonaNodeResourceTreeItem => Boolean(item)), [query, tree.roots]);
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      tree.roots.filter((item) => item.node.type === 'persona-anchor').forEach((item) => next.add(item.node.nodeId));
      let currentId = props.selectedNodeId;
      while (currentId) { const parent = tree.parents.get(currentId); if (parent) next.add(parent); currentId = parent; }
      return next;
    });
  }, [props.selectedNodeId, tree.parents, tree.roots]);
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  return <div className="space-y-2">
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点、标签或来源文件" className="h-8 w-full rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary" />
    <div data-neural-node-resource-list className="max-h-[48vh] overflow-y-auto rounded-sm border border-border bg-background/40 p-1">
      {roots.length ? roots.map((item) => <ResourceRow key={item.node.nodeId} depth={0} draggingId={draggingId} dropId={dropId} expanded={expanded} item={item} parents={tree.parents} selectedNodeId={props.selectedNodeId} setDraggingId={setDraggingId} setDropId={setDropId} toggle={toggle} onEdit={props.onEdit} onReparent={props.onReparent} onSelect={props.onSelect} />) : <div className="p-3 text-2xs text-muted-foreground">没有匹配的节点。</div>}
    </div>
  </div>;
}
