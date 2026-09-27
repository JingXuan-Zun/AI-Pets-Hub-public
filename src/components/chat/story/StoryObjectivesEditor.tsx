import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { createStoryEntry } from './storyDefaults';
import type { StoryDefinition, StoryEntry } from './storyTypes';

type SectionKey = 'goals' | 'tasks' | 'rules';

interface StoryObjectivesEditorProps {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  goals: '故事目标',
  tasks: '特定任务',
  rules: '故事规则',
};

function updateEntry(entries: StoryEntry[], id: string, patch: Partial<StoryEntry>) {
  return entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
}

function StoryEntryRow(props: {
  entry: StoryEntry;
  onRemove: () => void;
  onUpdate: (patch: Partial<StoryEntry>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={props.entry.enabled}
        onChange={(event) => props.onUpdate({ enabled: event.target.checked })}
        aria-label="启用此项"
      />
      <input
        value={props.entry.text}
        onChange={(event) => props.onUpdate({ text: event.target.value })}
        className="h-8 min-w-0 flex-1 rounded-md border border-sky-100 px-2 text-xs outline-none focus:border-sky-300"
        placeholder="输入具体内容"
      />
      <Button type="button" size="icon" variant="ghost" onClick={props.onRemove} className="h-7 w-7 text-sky-500">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StorySection(props: StoryObjectivesEditorProps & { section: SectionKey }) {
  const entries = props.draft[props.section];
  const enabled = props.draft.sections[props.section];
  const setEntries = (nextEntries: StoryEntry[]) => props.onChange({ [props.section]: nextEntries });
  return (
    <section className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-sky-950">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => props.onChange({
              sections: { ...props.draft.sections, [props.section]: event.target.checked },
            })}
          />
          {SECTION_LABELS[props.section]}
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => setEntries([...entries, createStoryEntry()])} className="h-7 border-sky-100 text-[10px]">
          <Plus className="mr-1 h-3 w-3" />添加
        </Button>
      </div>
      {enabled ? entries.map((entry) => (
        <StoryEntryRow
          key={entry.id}
          entry={entry}
          onRemove={() => setEntries(entries.filter((item) => item.id !== entry.id))}
          onUpdate={(patch) => setEntries(updateEntry(entries, entry.id, patch))}
        />
      )) : <p className="text-[10px] text-sky-500">本故事不会使用这一类约束。</p>}
    </section>
  );
}

export function StoryObjectivesEditor(props: StoryObjectivesEditorProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <StorySection {...props} section="goals" />
      <StorySection {...props} section="tasks" />
      <StorySection {...props} section="rules" />
    </div>
  );
}
