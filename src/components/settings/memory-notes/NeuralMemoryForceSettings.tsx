import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { DEFAULT_MEMORY_FORCE_SETTINGS, type MemoryForceSettings } from './memoryForceSimulation';
import { usePopoverDismiss } from './usePopoverDismiss';

const FIELDS: Array<{ key: keyof MemoryForceSettings; label: string; max: number; min: number; step: number }> = [
  { key: 'repelStrength', label: '排斥力', max: 600, min: 20, step: 10 },
  { key: 'linkDistance', label: '连线距离', max: 200, min: 20, step: 5 },
  { key: 'centerStrength', label: '中心引力', max: 0.3, min: 0, step: 0.01 },
  { key: 'collideRadius', label: '节点间距', max: 40, min: 0, step: 1 },
  { key: 'followStrength', label: '拖动跟随', max: 1, min: 0, step: 0.05 },
];

function storageKey(roleId: string) {
  return `desktop-pet.memory-graph-forces.v1:${roleId}`;
}

function readSettings(roleId: string): MemoryForceSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(roleId)) ?? 'null') as Partial<MemoryForceSettings> | null;
    const merged = { ...DEFAULT_MEMORY_FORCE_SETTINGS, ...(stored ?? {}) };
    return FIELDS.every((field) => Number.isFinite(merged[field.key])) ? merged : DEFAULT_MEMORY_FORCE_SETTINGS;
  } catch {
    return DEFAULT_MEMORY_FORCE_SETTINGS;
  }
}

/** Per-role force settings; storage is a convenience, defaults apply when it fails. */
export function useMemoryForceSettings(roleId: string) {
  const [settings, setSettings] = useState(() => readSettings(roleId));
  const save = (next: MemoryForceSettings) => {
    setSettings(next);
    try { window.localStorage.setItem(storageKey(roleId), JSON.stringify(next)); } catch { /* keep in memory */ }
  };
  return { save, settings };
}

export function NeuralMemoryForceSettings(props: { onChange: (settings: MemoryForceSettings) => void; settings: MemoryForceSettings }) {
  const [open, setOpen] = useState(false);
  const ref = usePopoverDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      {/* Same chip style as the memory summary laid over the graph's top-left. */}
      <button type="button" onClick={() => setOpen(!open)} className={`flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1.5 text-2xs font-semibold shadow-sm backdrop-blur-sm hover:text-primary ${open ? 'text-primary' : 'text-foreground'}`}>
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />力与碰撞
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-20 w-64 space-y-3 rounded-md border border-border bg-background p-3 text-xs shadow-lg">
          {FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="flex justify-between text-muted-foreground">
                {field.label}<span className="tabular-nums">{Number(props.settings[field.key].toFixed(2))}</span>
              </span>
              <input
                type="range" className="w-full"
                min={field.min} max={field.max} step={field.step}
                value={props.settings[field.key]}
                onChange={(event) => props.onChange({ ...props.settings, [field.key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <div className="flex justify-end">
            <button type="button" onClick={() => props.onChange(DEFAULT_MEMORY_FORCE_SETTINGS)} className="text-muted-foreground hover:text-foreground">恢复默认</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
