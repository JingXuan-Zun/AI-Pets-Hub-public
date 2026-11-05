import { useEffect, useState, type CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
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
  // “读取模型”: what this key can use, asked from Gemini (the saved key goes only to the saved endpoint).
  const [models, setModels] = useState<string[]>([]);
  const [listing, setListing] = useState({ error: false, message: '', running: false });
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
  const readModels = async () => {
    if (needsKeyAgain) {
      setListing({ error: true, message: '换了接口地址，先重新填写 API Key。', running: false });
      return;
    }
    setListing({ error: false, message: '正在读取模型列表…', running: true });
    try {
      const { listGeminiModels } = await import('../../services/geminiClient');
      const found = await listGeminiModels(draft.apiKey, draft.apiUrl);
      setModels(found);
      setListing({ error: !found.length, message: found.length ? `读到 ${found.length} 个模型，选一个。` : '没有读到可以聊天的模型。', running: false });
    } catch (error) {
      setModels([]);
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/u, '') : '读取模型列表失败。';
      setListing({ error: true, message, running: false });
    }
  };
  const save = () => {
    onApplySettings({ geminiApiKey: draft.apiKey.trim(), geminiApiUrl: draft.apiUrl.trim(), [modelField]: draft.model.trim() });
    setSaved(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex min-h-7 items-center justify-end gap-3">
        {listing.message ? <span className={`mr-auto text-2xs ${listing.error ? 'text-destructive' : 'text-muted-foreground'}`}>{listing.message}</span> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => void readModels()} disabled={listing.running} className="h-7 rounded-sm px-3 text-2xs" style={noDragRegionStyle}>
          <RefreshCw className={listing.running ? 'mr-1.5 h-3 w-3 animate-spin' : 'mr-1.5 h-3 w-3'} />
          读取模型
        </Button>
      </div>
      {/* Like the OpenAI-compatible picker: once the list is read, the dropdown takes the input's place. */}
      {models.length ? (
        <select
          className={`${inputClassName()} w-full`}
          style={noDragRegionStyle}
          value={models.includes(draft.model.trim()) ? draft.model.trim() : ''}
          onChange={(event) => update({ model: event.target.value })}
        >
          <option value="">选择模型</option>
          {models.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      ) : (
        <Input
          className={inputClassName()}
          list={`gemini-model-suggestions-${modelField}`}
          style={noDragRegionStyle}
          value={draft.model}
          onChange={(event) => update({ model: event.target.value })}
          placeholder="模型名称，例如 gemini-2.5-flash"
        />
      )}
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
