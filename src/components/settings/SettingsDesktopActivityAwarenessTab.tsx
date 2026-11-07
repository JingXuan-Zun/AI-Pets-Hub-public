import type { CSSProperties, ReactNode } from 'react';
import {
  LIFE_COMPANION_AWARENESS_INTERVAL_RANGE,
  LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE,
  type PetLifeCompanionSettings,
} from '../../life-companion/lifeCompanionSettings';
import type { PetConfig, PetStats } from '../../types';
import { SettingsLifeCompanionPanel } from './SettingsLifeCompanionPanel';
import { SettingsCharacterCognitionPanel } from './SettingsCharacterCognitionPanel';
import { SettingsProactiveSpeechStatus } from './SettingsProactiveSpeechStatus';
import { SettingsCharacterStatusBoard } from './SettingsCharacterStatusBoard';
import { setCognitionPaused } from '../../character-cognition/characterCognitionStore';
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
      <SwitchCard
        checked={lifeCompanion.characterCognitionEnabled}
        label="角色的心里活动"
        onChange={(checked) => {
          setCognitionPaused(!checked);
          update({ characterCognitionEnabled: checked });
        }}
        title="角色的心里活动"
        footer={lifeCompanion.characterCognitionEnabled ? <SettingsCharacterCognitionPanel config={props.config} /> : null}
      >
        <span className="block">每个角色心里有自己的心情和惦记的事：从她的人设读出起点（人设里定好的感情永远不会变差；打开下面“对你的感情只增不减”时对所有角色都成立），聊天后会自己变化。群聊里谁更想说话、她回复时想起什么，都由这个决定。</span>
        <span className="block">下面能看到每个角色此刻在想什么。每段对话结束后会调用一次模型更新，关闭后不再调用。</span>
      </SwitchCard>
      <SwitchCard
        checked={lifeCompanion.proactiveEnabled}
        label="主动找你聊天"
        onChange={(checked) => update({ proactiveEnabled: checked })}
        title="主动找你聊天"
        footer={lifeCompanion.proactiveEnabled ? <SettingsProactiveSpeechStatus /> : null}
      >
        <span className="block">角色心里惦记的事攒够了，才会主动来找你说（用她自己的语气，说的就是她惦记的那件事）；没有想说的就不打扰。需要先打开上面的“角色的心里活动”。</span>
        <span className="block">每个角色每小时最多 1 次，全部加起来每小时最多 2 次、两次至少隔 20 分钟；你说完话 10 分钟内、安静时段、你不在电脑前时都不会开口；每天最多 8 次。你离开一阵子回来时，只有最想说话的那一个会跟你打招呼。</span>
      </SwitchCard>
      <SwitchCard
        checked={lifeCompanion.crossChatAwarenessEnabled}
        label="角色之间互通近况"
        onChange={(checked) => update({ crossChatAwarenessEnabled: checked })}
        title="角色之间互通近况"
        footer={lifeCompanion.crossChatAwarenessEnabled ? <SettingsCharacterStatusBoard /> : null}
      >
        <span className="block">角色会知道彼此最近在做什么，也会知道别的角色跟你说过关于她的事。比如 A 跟你说“B 在图书馆看书”，你去找 B 时，她会顺着接下去。</span>
        <span className="block">只记角色自己说的话，你说的话不会被传出去；只记在做什么、在哪，不记感情和私密话题。需要先打开上面的“角色的心里活动”（聊完一段后顺带整理，不额外调用模型）。</span>
      </SwitchCard>
      <SwitchCard
        checked={lifeCompanion.feelingsNeverDrop}
        label="对你的感情只增不减"
        onChange={(checked) => update({ feelingsNeverDrop: checked })}
        title="对你的感情只增不减"
      >
        <span className="block">开启后，所有角色的好感度保持在最高，不会因为饿了或别的原因下降；心里活动也不会让她对你变冷淡，不管人设里有没有写。</span>
        <span className="block">关闭后，好感度会随照顾情况变化（饿太久会下降），心情只按人设来。</span>
      </SwitchCard>
      <SwitchCard
        checked={lifeCompanion.approvalVoicePromptEnabled}
        label="需要权限时开口询问"
        onChange={(checked) => update({ approvalVoicePromptEnabled: checked })}
        title="需要权限时开口询问"
      >
        <span className="block">角色帮你办事、需要你同意时（比如操作电脑、改文件），会用自己的语气和声音问你一句；你直接说“同意”或“拒绝”就行。</span>
        <span className="block">5 分钟没回应，角色会按自己的性格再提醒一次，聊天窗口也会抖一下。关闭后只在任务卡片上安静地等你。也可以直接跟角色说“需要权限的时候别念出来了”。</span>
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
