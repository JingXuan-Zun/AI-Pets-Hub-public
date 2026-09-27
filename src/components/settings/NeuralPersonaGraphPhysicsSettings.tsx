import {
  DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG,
  type NeuralPersonaGraphPhysicsConfig,
} from '../../character-graph/neural-persona';

type ConfigKey = keyof NeuralPersonaGraphPhysicsConfig;
type Field = {
  decimals: number;
  key: ConfigKey;
  label: string;
  max: number;
  min: number;
  scale: number;
  step: number;
};

const FIELDS: Field[] = [
  { decimals: 2, key: 'repulsionStrength', label: '节点间的排斥力', min: 0, max: 20, step: 0.1, scale: 0.1 },
  { decimals: 2, key: 'linkStrength', label: '相连节点间的吸引力', min: 0, max: 1, step: 0.01, scale: 0.05 },
  { decimals: 0, key: 'linkDistance', label: '连线长度', min: 20, max: 500, step: 1, scale: 1 },
  { decimals: 2, key: 'dragFollowStrength', label: '拖动跟随强度', min: 0, max: 1, step: 0.01, scale: 1 },
  { decimals: 0, key: 'dragMaxStretch', label: '拖动最大拉伸距离', min: 60, max: 1200, step: 10, scale: 1 },
];

function displayValue(field: Field, value: number) {
  return value / field.scale;
}

function PhysicsField(props: {
  field: Field;
  onChange: (key: ConfigKey, value: number) => void;
  value: number;
}) {
  const shown = displayValue(props.field, props.value);
  const change = (value: string) => props.onChange(
    props.field.key, Number(value) * props.field.scale,
  );
  return (
    <label className="block space-y-2 text-2xs text-muted-foreground">
      <span className="block text-2xs text-foreground">{props.field.label}</span>
      <span className="flex items-center gap-3">
        <output className="w-11 shrink-0 text-right font-mono text-2xs text-foreground">
          {shown.toFixed(props.field.decimals)}
        </output>
        <input aria-label={props.field.label} type="range" min={props.field.min} max={props.field.max} step={props.field.step} value={shown} onChange={(event) => change(event.target.value)} className="h-1.5 min-w-0 flex-1 accent-cyan-400" />
      </span>
    </label>
  );
}

export function NeuralPersonaGraphPhysicsSettings(props: {
  config: NeuralPersonaGraphPhysicsConfig;
  onChange: (config: NeuralPersonaGraphPhysicsConfig) => void;
}) {
  const change = (key: ConfigKey, value: number) => {
    if (!Number.isFinite(value)) return;
    props.onChange({ ...props.config, [key]: value });
  };
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-sm border border-border bg-background/80 px-2 py-1 text-3xs text-muted-foreground [&::-webkit-details-marker]:hidden">力与碰撞</summary>
      <div className="absolute right-0 top-8 z-30 w-[320px] max-w-[80vw] space-y-4 rounded-sm border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
        <div><div className="text-2xs font-semibold">力度</div><div className="text-3xs text-muted-foreground">拖动滑块会立即应用并保存；其他稳定参数继续使用现有配置。</div></div>
        <div className="space-y-4">{FIELDS.map((field) => <PhysicsField key={field.key} field={field} value={props.config[field.key]} onChange={change} />)}</div>
        <div className="flex justify-end"><button type="button" onClick={() => props.onChange(DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG)} className="rounded-sm border border-border px-2 py-1 text-3xs text-muted-foreground">恢复默认</button></div>
      </div>
    </details>
  );
}
