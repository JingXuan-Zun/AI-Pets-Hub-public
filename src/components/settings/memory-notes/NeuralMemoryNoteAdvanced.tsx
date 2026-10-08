import { useEffect, useState } from 'react';
import type { NeuralPersonaNode, NeuralPersonaNodePatch } from '../../../character-graph/neural-persona';

const SLIDERS: Array<{ key: 'baseWeight' | 'confidence' | 'stability'; label: string; hint: string }> = [
  { key: 'baseWeight', label: '影响强度', hint: '被想起时对角色的影响有多大' },
  { key: 'confidence', label: '置信度', hint: '这条记忆有多可靠' },
  { key: 'stability', label: '稳定度', hint: '越高越不容易被聊天反馈改变' },
];

/** Rarely needed knobs; sliders save when released. Tags live in the editor's tag row. */
export function NeuralMemoryNoteAdvanced(props: {
  node: NeuralPersonaNode;
  onSave: (patch: NeuralPersonaNodePatch) => void;
}) {
  const { node } = props;
  const [values, setValues] = useState({ baseWeight: node.baseWeight, confidence: node.confidence, stability: node.stability });
  useEffect(() => {
    setValues({ baseWeight: node.baseWeight, confidence: node.confidence, stability: node.stability });
  }, [node.nodeId, node.updatedAt]);

  return (
    <details open className="rounded-sm px-2 py-1 text-2xs text-muted-foreground">
      <summary className="cursor-pointer select-none">高级参数</summary>
      <div className="mt-2 space-y-2">
        {SLIDERS.map((slider) => (
          <label key={slider.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2" title={slider.hint}>
            <span>{slider.label}</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={values[slider.key]}
              onChange={(event) => setValues({ ...values, [slider.key]: Number(event.target.value) })}
              onPointerUp={() => values[slider.key] !== node[slider.key] && props.onSave({ [slider.key]: values[slider.key] })}
              onKeyUp={() => values[slider.key] !== node[slider.key] && props.onSave({ [slider.key]: values[slider.key] })}
            />
            <span className="text-right tabular-nums">{values[slider.key].toFixed(2)}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
