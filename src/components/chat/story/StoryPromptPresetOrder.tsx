import { ChevronDown, ChevronUp } from 'lucide-react';
import { getStoryPromptOrderList } from './storyPromptPresetSchema';
import { moveStoryPromptOrderEntry, setStoryPromptOrderEnabled } from './storyPromptPresetOrderActions';
import type { StoryPromptPreset } from './storyPromptPresetTypes';
import { SettingsToggleSwitch } from '../../settings/SettingsToggleSwitch';

function PromptOrderRow(props: {
  index: number;
  onChange: (preset: StoryPromptPreset) => void;
  preset: StoryPromptPreset;
}) {
  const order = getStoryPromptOrderList(props.preset)?.order ?? [];
  const entry = order[props.index];
  const prompt = props.preset.prompts.find((item) => item.identifier === entry.identifier);
  if (!entry) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/50 px-2 py-2">
      <SettingsToggleSwitch
        checked={entry.enabled}
        hideLabel
        label={`启用 ${prompt?.name || entry.identifier}`}
        onChange={(checked) => props.onChange(setStoryPromptOrderEnabled(props.preset, entry.identifier, checked))}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-sky-950">{prompt?.name || entry.identifier}</div>
        <div className="truncate text-[9px] text-sky-500">{prompt?.role || 'system'} · {entry.identifier}</div>
      </div>
      <button type="button" disabled={props.index === 0} onClick={() => props.onChange(moveStoryPromptOrderEntry(props.preset, props.index, -1))} className="rounded p-1 text-sky-600 disabled:text-slate-300" aria-label="上移">
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" disabled={props.index === order.length - 1} onClick={() => props.onChange(moveStoryPromptOrderEntry(props.preset, props.index, 1))} className="rounded p-1 text-sky-600 disabled:text-slate-300" aria-label="下移">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function StoryPromptPresetOrder(props: {
  onChange: (preset: StoryPromptPreset) => void;
  preset: StoryPromptPreset;
}) {
  const order = getStoryPromptOrderList(props.preset)?.order ?? [];
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium text-sky-800">Prompt order</div>
      {order.map((entry, index) => (
        <PromptOrderRow key={`${entry.identifier}-${index}`} index={index} {...props} />
      ))}
    </div>
  );
}
