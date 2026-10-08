import { type CSSProperties, type ReactNode } from 'react';
import { type PetConfig, type VoiceInputMode } from '../../types';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { selectClassName, toggleButtonClass } from './settingsVoiceUtils';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

function resolveConversationHint() {
  return {
    tone: 'text-muted-foreground',
    text: '点一次麦克风开始对话，说完停顿一下会自动发送；她说话时麦克风自动暂停，说完自动继续听。实时对话会自动使用 SenseVoice-Small 识别（CPU、约 0.3 秒一句），不受上面所选识别模型影响。',
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, enabled, onToggle, style }: { label: string; enabled: boolean; onToggle: () => void; style?: CSSProperties }) {
  return (
    <Button type="button" variant="ghost" className={toggleButtonClass(enabled)} onClick={onToggle} style={style}>
      {label}：{enabled ? '开' : '关'}
    </Button>
  );
}

export function SettingsVoiceConversationSection({ settings, noDragRegionStyle, applySettings }: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
}) {
  if (!settings.voiceInputEnabled) return null;
  const conversation = settings.voiceInputMode === 'conversation';
  const hint = conversation ? resolveConversationHint() : null;

  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">实时对话</div>
      <Field label="麦克风按钮">
        <select
          value={settings.voiceInputMode}
          onChange={(event) => applySettings({ voiceInputMode: event.target.value as VoiceInputMode })}
          className={selectClassName()}
          style={noDragRegionStyle}
        >
          <option value="single">单句：点一次说一句</option>
          <option value="conversation">实时对话：点一次开启，自动听、自动发</option>
        </select>
      </Field>
      {hint && <div className={'text-2xs ' + hint.tone}>{hint.text}</div>}

      {conversation && (
        <>
          <Field label={`多久没说话自动关闭麦克风：${settings.voiceConversationIdleTimeoutSec} 秒`}>
            <Slider
              value={[settings.voiceConversationIdleTimeoutSec]}
              min={10}
              max={300}
              step={5}
              markers={[10, 60, 300]}
              onValueChange={(value) => applySettings({ voiceConversationIdleTimeoutSec: Math.round(value[0] ?? 60) })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <ToggleRow
              label="开启对话时打开聊天窗口"
              enabled={settings.voiceConversationOpenChat}
              onToggle={() => applySettings({ voiceConversationOpenChat: !settings.voiceConversationOpenChat })}
              style={noDragRegionStyle}
            />
          </div>
        </>
      )}
    </div>
  );
}
