import { type CSSProperties } from 'react';
import { type PetConfig, type VoiceApiProtocol } from '../../types';
import {
  getDefaultSttModelForProtocol,
  getDefaultTtsModelForProtocol,
} from '../../voice/apiProtocols';
import { Input } from '../../../components/ui/input';
import { inputClassName, selectClassName } from './settingsVoiceUtils';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

export function SettingsApiTtsSection({
  settings,
  noDragRegionStyle,
  applySettings,
  applyTtsProtocol,
}: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
  applyTtsProtocol: (protocol: VoiceApiProtocol) => void;
}) {
  if (settings.ttsProvider !== 'api') {
    return null;
  }

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">API 语音播报</div>
      <select
        value={settings.apiTtsProtocol}
        onChange={(event) => applyTtsProtocol(event.target.value as VoiceApiProtocol)}
        className={selectClassName()}
        style={noDragRegionStyle}
      >
        <option value="openai">OpenAI 协议</option>
        <option value="gemini">Gemini 协议</option>
      </select>
      <div className="text-2xs text-muted-foreground">地址可留空，留空时默认走官方接口地址。</div>
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customVoiceApiUrl}
        onChange={(event) => applySettings({ customVoiceApiUrl: event.target.value })}
        placeholder="语音 API 地址（可留空）"
      />
      <Input
        type="password"
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customVoiceApiKey}
        onChange={(event) => applySettings({ customVoiceApiKey: event.target.value })}
        placeholder="语音 API Key"
      />
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customVoiceModel}
        onChange={(event) => applySettings({ customVoiceModel: event.target.value })}
        placeholder={'语音模型名称，例如 ' + getDefaultTtsModelForProtocol(settings.apiTtsProtocol)}
      />
    </div>
  );
}

export function SettingsApiSttSection({
  settings,
  noDragRegionStyle,
  applySettings,
  applySttProtocol,
}: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
  applySttProtocol: (protocol: VoiceApiProtocol) => void;
}) {
  if (settings.sttProvider !== 'api') {
    return null;
  }

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">API 语音识别</div>
      <div className="text-2xs text-muted-foreground">
        使用兼容转写接口时，点击语音输入后会先录音，再把音频上传到识别接口。
      </div>
      <select
        value={settings.apiSttProtocol}
        onChange={(event) => applySttProtocol(event.target.value as VoiceApiProtocol)}
        className={selectClassName()}
        style={noDragRegionStyle}
      >
        <option value="openai">OpenAI 协议</option>
        <option value="gemini">Gemini 协议</option>
      </select>
      <div className="text-2xs text-muted-foreground">地址可留空，留空时默认走官方接口地址。</div>
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customSpeechApiUrl}
        onChange={(event) => applySettings({ customSpeechApiUrl: event.target.value })}
        placeholder="识别 API 地址（可留空）"
      />
      <Input
        type="password"
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customSpeechApiKey}
        onChange={(event) => applySettings({ customSpeechApiKey: event.target.value })}
        placeholder="识别 API Key"
      />
      <Input
        className={inputClassName()}
        style={noDragRegionStyle}
        value={settings.customSpeechModel}
        onChange={(event) => applySettings({ customSpeechModel: event.target.value })}
        placeholder={'识别模型名称，例如 ' + getDefaultSttModelForProtocol(settings.apiSttProtocol)}
      />
    </div>
  );
}
