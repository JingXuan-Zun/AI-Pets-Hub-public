import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type PetConfig } from '../../types';
import { inputClassName } from './settingsVoiceUtils';

const SAVED_KEY_PREFIX = 'desktop-pet-credential:';
const GEMINI_MODEL_SUGGESTIONS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

interface SettingsGeminiApiFieldsProps {
  /** Which setting holds the model: the chat model or the dedicated vision model. */
  modelField?: 'llmModel' | 'visionLlmModel';
  noDragRegionStyle?: CSSProperties;
  onApplySettings: (updates: Partial<PetConfig['settings']>) => void;
  settings: PetConfig['settings'];
}

/**
 * Gemini model, optional relay endpoint and key, saved together. The saved key is only ever
 * sent to the saved endpoint, so changing the endpoint asks for the key again.
 */
export function SettingsGeminiApiFields({ modelField = 'llmModel', noDragRegionStyle, onApplySettings, settings }: SettingsGeminiApiFieldsProps) {
  const savedModel = settings[modelField];
  const [draft, setDraft] = useState({ apiKey: settings.geminiApiKey, apiUrl: settings.geminiApiUrl, model: savedModel });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft({ apiKey: settings.geminiApiKey, apiUrl: settings.geminiApiUrl, model: savedModel });
  }, [settings.geminiApiKey, settings.geminiApiUrl, savedModel]);

  const dirty = draft.apiKey !== settings.geminiApiKey || draft.apiUrl.trim() !== settings.geminiApiUrl || draft.model.trim() !== savedModel;
  const urlChanged = draft.apiUrl.trim() !== settings.geminiApiUrl.trim();
  const keyIsSavedReference = draft.apiKey.startsWith(SAVED_KEY_PREFIX);
  const needsKeyAgain = urlChanged && keyIsSavedReference;
  const urlInvalid = Boolean(draft.apiUrl.trim()) && !/^https?:\/\/[^\s/]+/iu.test(draft.apiUrl.trim());
  const update = (patch: Partial<typeof draft>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const save = () => {
    onApplySettings({ geminiApiKey: draft.apiKey.trim(), geminiApiUrl: draft.apiUrl.trim(), [modelField]: draft.model.trim() });
    setSaved(true);
  };

  return (
    <div className="space-y-3">
      <Input
        className={inputClassName()}
        list={`gemini-model-suggestions-${modelField}`}
        style={noDragRegionStyle}
        value={draft.model}
        onChange={(event) => update({ model: event.target.value })}
        placeholder="模型名称，例如 gemini-2.5-flash"
      />
      <datalist id={`gemini-model-suggestions-${modelField}`}>
        {GEMINI_MODEL_SUGGESTIONS.map((model) => <option key={model} value={model} />)}
      </datalist>
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={draft.apiUrl}
        onChange={(event) => update({ apiUrl: event.target.value })}
        placeholder="接口地址（可留空，留空走官方地址）"
      />
      <Input
        type="password"
        className={inputClassName()}
        style={noDragRegionStyle}
        value={draft.apiKey}
        onChange={(event) => update({ apiKey: event.target.value })}
        placeholder="Gemini API Key"
        autoComplete="off"
      />
      <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background/30 px-3 py-2">
        <div className="text-2xs text-muted-foreground">
          {urlInvalid
            ? '接口地址要以 http:// 或 https:// 开头。'
            : needsKeyAgain
              ? '换了接口地址，为了安全请重新填写 API Key。'
              : dirty
                ? '有未保存的改动。'
                : saved
                  ? '已保存。API Key 只保存在本机。'
                  : modelField === 'visionLlmModel'
                    ? '接口地址和 Key 与「模型接口」里的 Gemini 共用。'
                    : '接口地址可留空；用中转服务时填它给的地址。'}
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || urlInvalid || needsKeyAgain || !draft.model.trim()}
          className="h-8 rounded-sm bg-primary px-3 text-2xs uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dirty ? '保存接口' : (saved ? '已保存' : '保存接口')}
        </Button>
      </div>
    </div>
  );
}
