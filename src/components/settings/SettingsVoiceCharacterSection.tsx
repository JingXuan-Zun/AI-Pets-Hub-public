import { useEffect, useState, type CSSProperties } from 'react';
import { applyDesktopPetSlotChanges, getDesktopPetSlots, type DesktopPetSlot } from '../../multiPetRoster';
import { type GptSovitsModelSummary, type PetConfig, type PetPersonality } from '../../types';
import { Input } from '../../../components/ui/input';
import { listGptSovitsModels } from '../../voice/gptSovitsRuntime';
import { selectClassName } from './settingsVoiceUtils';

function CharacterVoiceRow({ slot, packs, globalPackName, noDragRegionStyle, onUpdate }: {
  slot: DesktopPetSlot;
  packs: GptSovitsModelSummary[];
  globalPackName: string;
  noDragRegionStyle?: CSSProperties;
  onUpdate: (updates: Partial<PetPersonality>) => void;
}) {
  const { personality } = slot;
  const name = personality.name.trim() || slot.label;
  const voicePackId = personality.voicePackId?.trim() ?? '';
  const missing = voicePackId && packs.length > 0 && !packs.some((pack) => pack.id === voicePackId);
  const hidden = !slot.isPrimary && !slot.enabled;
  return (
    <div className="space-y-2 rounded-sm border border-border bg-background/50 p-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span>{name}</span>
        <span className="text-2xs text-muted-foreground">{slot.label}{hidden ? ' · 未启用，不会被唤醒' : ''}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label={`${name}的音色`}
          value={voicePackId}
          onChange={(event) => onUpdate({ voicePackId: event.target.value })}
          className={selectClassName()}
          style={noDragRegionStyle}
        >
          <option value="">音色：跟随全局{globalPackName ? `（${globalPackName}）` : ''}</option>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>音色：{pack.name}（{pack.kind === 'lite' ? '轻量版' : '训练版'}）</option>
          ))}
          {missing && <option value={voicePackId}>已找不到的音色，请重新选择</option>}
        </select>
        <Input
          aria-label={`${name}的唤醒词`}
          className="h-9 text-xs"
          style={noDragRegionStyle}
          value={personality.wakeWords ?? ''}
          onChange={(event) => onUpdate({ wakeWords: event.target.value })}
          placeholder={`唤醒词：留空就用「${name}」`}
        />
      </div>
    </div>
  );
}

// Per-character voice: which voice pack each slot speaks with and which phrases wake it.
export function SettingsVoiceCharacterSection({ config, noDragRegionStyle, onApplyConfig }: {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
}) {
  const [packs, setPacks] = useState<GptSovitsModelSummary[]>([]);
  useEffect(() => {
    let disposed = false;
    void listGptSovitsModels().then((models) => {
      if (!disposed) setPacks(models.filter((model) => model.ready));
    });
    return () => { disposed = true; };
  }, []);

  const { settings } = config;
  // Same rule as the voice service: an empty global choice resolves to a trained pack first.
  const globalPack = packs.find((pack) => pack.id === settings.gptSovitsModelId)
    ?? (settings.gptSovitsModelId ? undefined : packs.find((pack) => pack.kind !== 'lite') ?? packs[0]);
  const globalPackName = globalPack?.name ?? '';
  const updateSlot = (slot: DesktopPetSlot, updates: Partial<PetPersonality>) => onApplyConfig(
    applyDesktopPetSlotChanges(config, slot.id, { personality: { ...slot.personality, ...updates } }),
  );

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="space-y-1">
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">角色语音</div>
        <div className="text-2xs leading-5 text-muted-foreground">
          每个角色用自己的音色说话，并响应自己的唤醒词（多个用逗号分隔，留空就用角色名）。
          {settings.ttsProvider !== 'gpt-sovits' && ' 当前播报用的不是角色音色（GPT-SoVITS），切换过去后音色选择才会生效。'}
          {!settings.voiceWakeEnabled && ' 语音唤醒未开启，唤醒词暂不生效。'}
        </div>
      </div>
      {getDesktopPetSlots(config).map((slot) => (
        <CharacterVoiceRow
          key={slot.id}
          slot={slot}
          packs={packs}
          globalPackName={globalPackName}
          noDragRegionStyle={noDragRegionStyle}
          onUpdate={(updates) => updateSlot(slot, updates)}
        />
      ))}
      <div className="text-2xs text-muted-foreground">唤醒词按读音比对（同音字、l/n、前后鼻音、平翘舌都算一样）。建议用 3–4 个字、和其他角色差别大的词：三个字以上允许听错一个音，两个字的词要每个音都对上。</div>
    </div>
  );
}
