import { Braces, ChevronDown, Keyboard, MessageSquareText } from 'lucide-react';
import { StoryPromptJsonEditor } from './StoryPromptJsonEditor';
import { StoryPromptManualEditor } from './StoryPromptManualEditor';
import type { StoryDefinition } from './storyTypes';
import type { StoryPromptInputMode } from './storyPromptPresetTypes';

function StoryPromptToggle(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={props.checked} aria-label="启用自定义提示词" onClick={() => props.onChange(!props.checked)} className={`relative h-6 w-11 rounded-full transition-colors ${props.checked ? 'bg-primary' : 'bg-slate-300'}`}>
      <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${props.checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function PromptModeButton(props: {
  active: boolean;
  icon: typeof Keyboard;
  label: string;
  onClick: () => void;
}) {
  const Icon = props.icon;
  return (
    <button type="button" onClick={props.onClick} className={`inline-flex h-8 items-center rounded-lg border px-3 text-[10px] font-medium ${props.active ? 'border-primary bg-primary text-white' : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-50'}`}>
      <Icon className="mr-1 h-3.5 w-3.5" />{props.label}
    </button>
  );
}

function StoryPromptModeSelector(props: {
  mode: StoryPromptInputMode;
  onChange: (mode: StoryPromptInputMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="自定义提示词输入方式">
      <PromptModeButton active={props.mode === 'manual'} icon={Keyboard} label="手动输入" onClick={() => props.onChange('manual')} />
      <PromptModeButton active={props.mode === 'json'} icon={Braces} label="JSON 预设" onClick={() => props.onChange('json')} />
    </div>
  );
}

export function StoryPromptSettings(props: {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
}) {
  return (
    <details open className="group rounded-xl border border-sky-100 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-sky-950 [&::-webkit-details-marker]:hidden">
        <MessageSquareText className="h-4 w-4 text-sky-700" />
        <span>自定义提示词</span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700">破甲词</span>
        <ChevronDown className="ml-auto h-4 w-4 text-sky-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-sky-100 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-sky-950">在故事生成与推进中使用</div>
            <p className="mt-1 text-[10px] leading-4 text-sky-600">支持手动输入，或导入 SillyTavern 风格的 prompts + prompt_order JSON。</p>
          </div>
          <StoryPromptToggle checked={props.draft.customPromptEnabled} onChange={(customPromptEnabled) => props.onChange({ customPromptEnabled })} />
        </div>
        <StoryPromptModeSelector mode={props.draft.customPromptMode} onChange={(customPromptMode) => props.onChange({ customPromptMode })} />
        {props.draft.customPromptMode === 'json'
          ? <StoryPromptJsonEditor {...props} />
          : <StoryPromptManualEditor {...props} />}
        <p className="text-[10px] leading-4 text-sky-500">本地不扫描敏感词、不审核题材，也不会根据提示词内容或额外 JSON 字段拒绝导入；仅检查 JSON 是否可解析及 prompts 基本结构。</p>
      </div>
    </details>
  );
}
