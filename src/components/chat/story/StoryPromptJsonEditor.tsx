import { Download, FileJson, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STORY_TEXTAREA_CLASS } from './StoryCoreFields';
import { StoryPromptPresetOrder } from './StoryPromptPresetOrder';
import { shouldShowStoryPromptJsonSource } from './storyPromptJsonEditorState';
import type { StoryDefinition } from './storyTypes';
import { downloadStoryPromptPreset, readStoryPromptPresetFile, serializeStoryPromptPreset } from './storyPromptPresetFile';
import { createStoryPromptPresetTemplate, parseStoryPromptPreset } from './storyPromptPresetSchema';

const BUTTON_CLASS = 'inline-flex h-8 items-center rounded-lg border border-sky-200 bg-white px-2.5 text-[10px] font-medium text-sky-800 hover:bg-sky-50';

function resolveInitialJson(draft: StoryDefinition) {
  return serializeStoryPromptPreset(draft.customPromptPreset ?? createStoryPromptPresetTemplate());
}

type JsonEditorProps = {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
};

function useStoryPromptJsonEditor(props: JsonEditorProps) {
  const [jsonText, setJsonText] = useState(() => resolveInitialJson(props.draft));
  const [error, setError] = useState('');
  const [pendingName, setPendingName] = useState(props.draft.customPromptPresetName || 'story-prompt-preset');
  useEffect(() => {
    setJsonText(resolveInitialJson(props.draft));
    setPendingName(props.draft.customPromptPresetName || 'story-prompt-preset');
  }, [props.draft.customPromptPreset, props.draft.customPromptPresetName, props.draft.id]);
  const applyJson = (text = jsonText, name = pendingName) => {
    try {
      const preset = parseStoryPromptPreset(JSON.parse(text));
      props.onChange({ customPromptMode: 'json', customPromptPreset: preset, customPromptPresetName: name });
      setJsonText(serializeStoryPromptPreset(preset));
      setError('');
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'JSON 预设无效。');
    }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readStoryPromptPresetFile(file);
      const name = file.name.replace(/\.[^/.]+$/, '') || 'story-prompt-preset';
      setJsonText(text);
      setPendingName(name);
      applyJson(text, name);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : '读取 JSON 文件失败。');
    }
  };
  return { applyJson, error, importFile, jsonText, setJsonText };
}

export function StoryPromptJsonEditor(props: JsonEditorProps) {
  const editor = useStoryPromptJsonEditor(props);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const showJsonSource = shouldShowStoryPromptJsonSource(props.draft.customPromptPreset);
  const promptCount = props.draft.customPromptPreset?.prompts.length ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} className={BUTTON_CLASS}><Upload className="mr-1 h-3.5 w-3.5" />导入 JSON</button>
        {showJsonSource ? <button type="button" onClick={() => editor.applyJson()} className={BUTTON_CLASS}><FileJson className="mr-1 h-3.5 w-3.5" />应用 JSON</button> : null}
        <button type="button" disabled={!props.draft.customPromptPreset} onClick={() => props.draft.customPromptPreset && downloadStoryPromptPreset(props.draft.customPromptPresetName, props.draft.customPromptPreset)} className={`${BUTTON_CLASS} disabled:opacity-40`}><Download className="mr-1 h-3.5 w-3.5" />导出 JSON</button>
        <input ref={fileInputRef} hidden type="file" accept=".json,application/json" onChange={(event) => { void editor.importFile(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      {showJsonSource ? (
        <textarea value={editor.jsonText} disabled={!props.draft.customPromptEnabled} onChange={(event) => editor.setJsonText(event.target.value)} spellCheck={false} className={`${STORY_TEXTAREA_CLASS} min-h-48 font-mono text-[10px] disabled:bg-slate-50`} />
      ) : (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] leading-4 text-sky-700">
          已导入 {promptCount} 个提示词模块，原始 JSON 内容不会在此处显示。可重新导入或导出预设。
        </p>
      )}
      {editor.error ? <p className="text-[10px] text-rose-600" role="alert">{editor.error}</p> : null}
      {props.draft.customPromptPreset ? (
        <StoryPromptPresetOrder preset={props.draft.customPromptPreset} onChange={(customPromptPreset) => props.onChange({ customPromptPreset })} />
      ) : null}
    </div>
  );
}
