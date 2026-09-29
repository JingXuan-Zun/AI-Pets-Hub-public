import { STORY_TEXTAREA_CLASS } from './StoryCoreFields';
import type { StoryDefinition } from './storyTypes';
import type { StoryPromptRole } from './storyPromptPresetTypes';

const ROLE_OPTIONS: Array<{ label: string; value: StoryPromptRole }> = [
  { label: 'User（兼容旧故事）', value: 'user' },
  { label: 'System', value: 'system' },
  { label: 'Assistant 参考', value: 'assistant' },
];

export function StoryPromptManualEditor(props: {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] text-sky-700">
        <span>消息角色</span>
        <select
          value={props.draft.customPromptManualRole}
          disabled={!props.draft.customPromptEnabled}
          onChange={(event) => props.onChange({ customPromptManualRole: event.target.value as StoryPromptRole })}
          className="h-8 rounded-lg border border-sky-200 bg-white px-2 text-[11px] text-sky-900 disabled:bg-slate-50"
        >
          {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <textarea
        value={props.draft.customPrompt}
        disabled={!props.draft.customPromptEnabled}
        onChange={(event) => props.onChange({ customPrompt: event.target.value })}
        placeholder="输入题材、叙事风格、对白方式、内容边界、场景描写或额外剧情规则……"
        className={`${STORY_TEXTAREA_CLASS} min-h-32 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
      />
    </div>
  );
}
