import { type CSSProperties } from 'react';
import { listPresetEntries, setPresetEntryEnabled } from '../../services/dialogueCompletionPresetEntries';

// Switches for each entry of a pasted SillyTavern preset; shown only for that format.
export function SettingsPresetEntryToggles({
  noDragRegionStyle,
  onChange,
  preset,
}: {
  noDragRegionStyle?: CSSProperties;
  onChange: (preset: string) => void;
  preset: string;
}) {
  const entries = listPresetEntries(preset);
  if (!entries?.length) return null;
  const enabledCount = entries.filter((entry) => entry.enabled).length;
  return (
    <div className="mt-3 rounded-sm border border-border bg-secondary/40 p-2" style={noDragRegionStyle}>
      <div className="mb-1.5 text-2xs text-muted-foreground">预设条目（已开 {enabledCount} / {entries.length}）：取消勾选就不再发给模型，例如不想要回复末尾的推荐选项，就关掉对应的“选项”条目。</div>
      <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {entries.map((entry) => (
          <label key={entry.identifier} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-xs hover:bg-muted">
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(event) => onChange(setPresetEntryEnabled(preset, entry.identifier, event.target.checked))}
            />
            <span className="truncate" title={entry.name}>{entry.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
