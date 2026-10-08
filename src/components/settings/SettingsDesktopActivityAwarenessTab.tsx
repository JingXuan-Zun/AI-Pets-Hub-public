import type { CSSProperties, ReactNode } from 'react';
import {
  LIFE_COMPANION_AWARENESS_INTERVAL_RANGE,
  LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE,
  type PetLifeCompanionSettings,
} from '../../life-companion/lifeCompanionSettings';
import type { PetConfig, PetStats } from '../../types';
import { SettingsLifeCompanionPanel } from './SettingsLifeCompanionPanel';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

function SwitchCard(props: {
  checked: boolean;
  children: ReactNode;
  footer?: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">{props.title}</span>
          <span className="block space-y-1 text-2xs leading-5 text-muted-foreground">{props.children}</span>
        </span>
        <SettingsToggleSwitch checked={props.checked} hideLabel label={props.label} onChange={props.onChange} />
      </label>
      {props.footer}
    </div>
  );
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function IntervalSlider(props: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  style?: CSSProperties;
  text: string;
  value: number;
}) {
  return (
    <label className="block space-y-1 text-2xs text-muted-foreground">
      <span className="flex justify-between">
        <span>{props.label}</span>
        <span className="font-semibold text-primary">{props.text}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        style={props.style}
        className="w-full accent-primary"
      />
    </label>
  );
}

/** 生活陪伴: rough activity awareness, consent-based screen watching and the companion schedule. */
export function SettingsDesktopActivityAwarenessTab(props: {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
  stats: PetStats;
}) {
  const lifeCompanion = props.config.settings.lifeCompanion;
  const update = (patch: Partial<PetLifeCompanionSettings>) => props.onApplyConfig({
    ...props.config,
    settings: { ...props.config.settings, lifeCompanion: { ...lifeCompanion, ...patch } },
  });
  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">生活陪伴</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">角色大致知道你在做什么，会在合适的时候用自己的语气主动找你聊天；你同意后还能看着屏幕陪你。</p>
      </div>
      <SwitchCard
        checked={lifeCompanion.desktopActivityAwarenessEnabled}
        label="桌面活动感知"
        onChange={(checked) => update({ desktopActivityAwarenessEnabled: checked })}
        title="桌面活动感知"
        footer={(
          <IntervalSlider
            label="主动搭话间隔"
            max={LIFE_COMPANION_AWARENESS_INTERVAL_RANGE.max}
            min={LIFE_COMPANION_AWARENESS_INTERVAL_RANGE.min}
            onChange={(value) => update({ desktopActivityAwarenessIntervalMinutes: value })}
            step={1}
            style={props.noDragRegionStyle}
            text={`每 ${lifeCompanion.desktopActivityAwarenessIntervalMinutes} 分钟最多一次`}
            value={lifeCompanion.desktopActivityAwarenessIntervalMinutes}
          />
        )}
      >
        <span className="block">根据前台应用和窗口标题大致判断你在做什么（游戏、视频、音乐、写代码、设计、聊天、办公、浏览网页），不读取屏幕画面。</span>
        <span className="block">同一件事持续一会儿才会搭话，两次搭话之间至少隔下面设置的时间；安静时段、群聊/故事模式、正在回复或播放语音时不会打扰。没有在看屏幕时，角色可能会顺带问你要不要让它看看。</span>
      </SwitchCard>
      <SwitchCard
        checked={lifeCompanion.screenWatchConsented}
        label="让角色看屏幕"
        onChange={(checked) => update({ screenWatchConsented: checked })}
        title={lifeCompanion.screenWatchConsented ? '屏幕观看 · 观看中' : '屏幕观看'}
        footer={(
          <IntervalSlider
            label="观看间隔"
            max={LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE.max}
            min={LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE.min}
            onChange={(value) => update({ screenWatchIntervalSeconds: value })}
            step={30}
            style={props.noDragRegionStyle}
            text={`每 ${formatSeconds(lifeCompanion.screenWatchIntervalSeconds)}看一次`}
            value={lifeCompanion.screenWatchIntervalSeconds}
          />
        )}
      >
        <span className="block">开启后，角色会看你当前前台的窗口画面并陪你聊天：按下面的间隔看一次，切换窗口后会提前看；有话想说时才开口。每次观看会调用一次视觉识别，间隔越短调用越多。</span>
        <span className="block">随时可以断开：点桌宠下方的“断开”，在聊天里说“不用看了”“不准看了”，或在这里关闭。需要先在视觉设置里启用视觉模型。</span>
      </SwitchCard>
      <SettingsLifeCompanionPanel
        noDragRegionStyle={props.noDragRegionStyle}
        settings={lifeCompanion}
        stats={props.stats}
        onUpdateSettings={(next) => update(next)}
      />
    </section>
  );
}
