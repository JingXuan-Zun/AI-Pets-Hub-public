import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type PetConfig } from '../../types';
import { SettingsOpenAIModelPicker } from './SettingsOpenAIModelPicker';
import { inputClassName } from './settingsVoiceUtils';

const SAVED_KEY_PREFIX = 'desktop-pet-credential:';

interface SettingsVisionOpenAIApiFieldsProps {
  noDragRegionStyle?: CSSProperties;
  onApplySettings: (updates: Partial<PetConfig['settings']>) => void;
  settings: PetConfig['settings'];
}

/**
 * Dedicated OpenAI-compatible vision model, saved as one form. Saving the endpoint on every
 * keystroke used to fail the whole config save (a saved key may only go to its saved
 * endpoint), silently dropping other settings changed in the meantime.
 */
export function SettingsVisionOpenAIApiFields({ noDragRegionStyle, onApplySettings, settings }: SettingsVisionOpenAIApiFieldsProps) {
  const read = () => ({ apiKey: settings.visionCustomApiKey, apiUrl: settings.visionCustomApiUrl, model: settings.visionCustomModelName });
  const [draft, setDraft] = useState(read);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft(read());
  }, [settings.visionCustomApiKey, settings.visionCustomApiUrl, settings.visionCustomModelName]);

  const dirty = draft.apiKey !== settings.visionCustomApiKey
    || draft.apiUrl.trim() !== settings.visionCustomApiUrl
    || draft.model.trim() !== settings.visionCustomModelName;
  const needsKeyAgain = draft.apiUrl.trim() !== settings.visionCustomApiUrl.trim() && draft.apiKey.startsWith(SAVED_KEY_PREFIX);
  const urlInvalid = Boolean(draft.apiUrl.trim()) && !/^https?:\/\/[^\s/]+/iu.test(draft.apiUrl.trim());
  const update = (patch: Partial<typeof draft>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-3">
      <SettingsOpenAIModelPicker
        apiKey={draft.apiKey}
        apiUrl={draft.apiUrl}
        inputClassName={inputClassName()}
        modelName={draft.model}
        noDragRegionStyle={noDragRegionStyle}
        onModelNameChange={(model) => update({ model })}
      />
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={draft.apiUrl}
        onChange={(event) => update({ apiUrl: event.target.value })}
        placeholder="视觉接口地址"
      />
      <Input
        type="password"
        className={inputClassName()}
        style={noDragRegionStyle}
        value={draft.apiKey}
        onChange={(event) => update({ apiKey: event.target.value })}
        placeholder="视觉 API Key"
        autoComplete="off"
      />
      <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background/30 px-3 py-2">
        <div className="text-2xs text-muted-foreground">
          {urlInvalid
            ? '接口地址要以 http:// 或 https:// 开头。'
            : needsKeyAgain
              ? '换了接口地址，为了安全请重新填写 API Key。'
              : dirty ? '有未保存的改动。' : saved ? '已保存。' : '填写完成后点保存即可生效。'}
        </div>
        <Button
          type="button"
          onClick={() => {
            onApplySettings({ visionCustomApiKey: draft.apiKey.trim(), visionCustomApiUrl: draft.apiUrl.trim(), visionCustomModelName: draft.model.trim() });
            setSaved(true);
          }}
          disabled={!dirty || urlInvalid || needsKeyAgain}
          className="h-8 rounded-sm bg-primary px-3 text-2xs uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dirty ? '保存接口' : (saved ? '已保存' : '保存接口')}
        </Button>
      </div>
    </div>
  );
}
