import type { NeuralPersonaGraphPhysicsConfig } from '../../character-graph/neural-persona';
import { NeuralPersonaGraphPhysicsSettings } from './NeuralPersonaGraphPhysicsSettings';

const BUTTON_CLASS = 'rounded-sm border border-border bg-background/80 px-2 py-1 text-3xs text-muted-foreground';

export function NeuralPersonaGraphCanvasToolbar(props: {
  editorMode: boolean;
  multiSelectMode: boolean;
  onApplyPhysicsConfig: (config: NeuralPersonaGraphPhysicsConfig) => void;
  onMultiSelectModeChange: (enabled: boolean) => void;
  onReset: () => void;
  onToggleEditor: () => void;
  physicsConfig: NeuralPersonaGraphPhysicsConfig;
  selectedNodeCount: number;
}) {
  return (
    <div className="absolute right-2 top-2 z-20 flex gap-1">
      <button type="button" onClick={props.onToggleEditor} className={BUTTON_CLASS}>{props.editorMode ? '退出编辑' : '编辑节点'}</button>
      <button type="button" aria-pressed={props.multiSelectMode} data-neural-graph-marquee-toggle onClick={() => props.onMultiSelectModeChange(!props.multiSelectMode)} className={`${BUTTON_CLASS} ${props.multiSelectMode ? 'border-cyan-600 bg-cyan-500/10 text-cyan-700' : ''}`}>{props.multiSelectMode ? `结束框选 (${props.selectedNodeCount})` : '框选节点'}</button>
      <NeuralPersonaGraphPhysicsSettings config={props.physicsConfig} onChange={props.onApplyPhysicsConfig} />
      <button type="button" onClick={props.onReset} className={BUTTON_CLASS}>重置视图</button>
    </div>
  );
}
