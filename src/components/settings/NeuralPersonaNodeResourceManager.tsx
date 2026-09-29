import { useEffect, useState, type ReactNode } from 'react';
import type {
  NeuralPersonaEdge,
  NeuralPersonaNode,
  NeuralPersonaNodeCommandResult,
  NeuralPersonaNodeDraft,
  NeuralPersonaNodePatch,
} from '../../character-graph/neural-persona';
import { NeuralPersonaNodeEditor } from './NeuralPersonaNodeEditor';
import { NeuralPersonaNodeResourceList } from './NeuralPersonaNodeResourceList';
import { createNeuralPersonaEditorId } from './neuralPersonaEditorIds';

function quickDraft(parent: NeuralPersonaNode | undefined, name: string): NeuralPersonaNodeDraft {
  return {
    baseWeight: 0.5, confidence: 0.8, decayRate: 0.1,
    influenceSummary: name, nodeId: createNeuralPersonaEditorId('node'),
    parentNodeId: parent?.nodeId, plasticity: 0.2, protected: false,
    scope: 'private', stability: 0.5, status: 'active', tags: [],
    type: !parent || parent.type === 'persona-anchor' ? 'cognitive-domain' : 'cognitive-topic',
  };
}

function message(result: NeuralPersonaNodeCommandResult) {
  if (result.status === 'ok') return `操作完成 · revision ${result.record.revision}`;
  if (result.status === 'conflict') return '图谱版本发生变化，请重试。';
  return `操作失败：${result.reason}`;
}

export function NeuralPersonaNodeResourceManager(props: {
  batchDeletePanel: ReactNode;
  edges: NeuralPersonaEdge[];
  nodes: NeuralPersonaNode[];
  onCreate: (draft: NeuralPersonaNodeDraft) => Promise<NeuralPersonaNodeCommandResult>;
  onDelete: (nodeId: string, confirmProtectedNode: boolean) => Promise<NeuralPersonaNodeCommandResult>;
  onSelect: (nodeId: string) => void;
  onUpdate: (nodeId: string, patch: NeuralPersonaNodePatch) => Promise<NeuralPersonaNodeCommandResult>;
  selectedNodeId?: string;
}) {
  const [editingNodeId, setEditingNodeId] = useState<string>();
  const [feedback, setFeedback] = useState('');
  const selected = props.nodes.find((node) => node.nodeId === props.selectedNodeId);
  const editing = props.nodes.find((node) => node.nodeId === editingNodeId) ?? null;
  const anchor = props.nodes.find((node) => node.type === 'persona-anchor');
  useEffect(() => { if (editingNodeId && !editing) setEditingNodeId(undefined); }, [editing, editingNodeId]);
  const createNode = async () => {
    const parent = selected ?? anchor;
    const count = props.nodes.filter((node) => node.influenceSummary.startsWith('新节点')).length;
    const result = await props.onCreate(quickDraft(parent, `新节点 ${count + 1}`));
    setFeedback(message(result));
    if (result.status === 'ok' && result.receipt.nodeId) {
      props.onSelect(result.receipt.nodeId); setEditingNodeId(result.receipt.nodeId);
    }
  };
  const reparent = async (nodeId: string, parentNodeId: string) => {
    const result = await props.onUpdate(nodeId, { parentNodeId });
    setFeedback(message(result));
    if (result.status === 'ok') props.onSelect(nodeId);
  };
  const linkedEdgeCount = editing ? props.edges.filter((edge) => (
    edge.sourceNodeId === editing.nodeId || edge.targetNodeId === editing.nodeId
  )).length : 0;
  return <section data-neural-node-resource-manager className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
    {editingNodeId ? <NeuralPersonaNodeEditor linkedEdgeCount={linkedEdgeCount} node={editing} onBack={() => setEditingNodeId(undefined)} onDelete={props.onDelete} onUpdate={props.onUpdate} /> : <>
      <div className="flex items-center justify-between gap-2">
        <div><div className="text-xs font-semibold">节点资源</div><div className="text-3xs text-muted-foreground">在列表中创建、定位和拖动节点；拖入另一个节点会自动建立层级关系。</div></div>
        <button type="button" onClick={() => void createNode()} className="shrink-0 rounded-sm border border-primary px-3 py-1 text-2xs text-primary">新建节点</button>
      </div>
      <div className="text-3xs text-muted-foreground">{selected ? `将在“${selected.influenceSummary}”下新建` : anchor ? '将在主人格下新建' : '将创建顶层节点'} · 共 {props.nodes.length} 个节点</div>
      <NeuralPersonaNodeResourceList edges={props.edges} nodes={props.nodes} selectedNodeId={props.selectedNodeId} onEdit={setEditingNodeId} onReparent={reparent} onSelect={props.onSelect} />
      <div className="min-h-4 text-3xs text-muted-foreground">{feedback}</div>
      {props.batchDeletePanel}
    </>}
  </section>;
}
