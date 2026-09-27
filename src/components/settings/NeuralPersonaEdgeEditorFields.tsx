import type { Dispatch, SetStateAction } from 'react';
import type {
  NeuralPersonaEdgeType,
  NeuralPersonaNode,
} from '../../character-graph/neural-persona';
import { NeuralPersonaEdgeEditorAdvancedFields } from './NeuralPersonaEdgeEditorAdvancedFields';
import type { NeuralPersonaEdgeEditorDraft } from './neuralPersonaEdgeEditorDraft';

const RELATION_TYPES: Array<[NeuralPersonaEdgeType, string]> = [
  ['contains', '结构包含（不参与传播）'], ['associated-with', '相关'],
  ['supports', '支持'], ['inhibits', '抑制'],
  ['opposes', '对立'], ['triggers', '触发'], ['protects', '保护'],
  ['derived-from', '来源于'], ['reminds-of', '联想到'], ['threatens', '威胁'],
  ['related-to-person', '关联人物'], ['related-to-topic', '关联主题'],
];

function nodeLabel(node: NeuralPersonaNode) {
  return node.influenceSummary.trim() || node.nodeId;
}

export function NeuralPersonaEdgeEditorFields(props: {
  createMode: boolean;
  draft: NeuralPersonaEdgeEditorDraft;
  nodes: NeuralPersonaNode[];
  setDraft: Dispatch<SetStateAction<NeuralPersonaEdgeEditorDraft>>;
}) {
  const set = <K extends keyof NeuralPersonaEdgeEditorDraft>(key: K, value: NeuralPersonaEdgeEditorDraft[K]) => props.setDraft((current) => ({ ...current, [key]: value }));
  const inputClass = 'h-8 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary disabled:opacity-60';
  const nodeOptions = props.nodes.map((node) => (
    <option key={node.nodeId} value={node.nodeId}>{nodeLabel(node)}</option>
  ));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>来源节点</span><select disabled={!props.createMode} value={props.draft.sourceNodeId} onChange={(event) => set('sourceNodeId', event.target.value)} className={inputClass}><option value="">请选择</option>{nodeOptions}</select></label>
        <label className="grid gap-1 text-3xs text-muted-foreground"><span>目标节点</span><select disabled={!props.createMode} value={props.draft.targetNodeId} onChange={(event) => set('targetNodeId', event.target.value)} className={inputClass}><option value="">请选择</option>{nodeOptions}</select></label>
        <label className="grid gap-1 text-3xs text-muted-foreground md:col-span-2"><span>关系类型</span><select value={props.draft.relationType} onChange={(event) => set('relationType', event.target.value as NeuralPersonaEdgeType)} className={inputClass}>{RELATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <NeuralPersonaEdgeEditorAdvancedFields createMode={props.createMode} draft={props.draft} setDraft={props.setDraft} />
    </div>
  );
}
