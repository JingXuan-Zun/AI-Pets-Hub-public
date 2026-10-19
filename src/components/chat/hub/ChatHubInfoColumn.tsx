import { useEffect, useState } from 'react';
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  Shirt,
  Sun,
  UsersRound,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { type DesktopPetSlot } from '../../../multiPetRoster';
import { type DesktopPetChatMode } from '../../../types';
import { useHubWeather, type HubWeatherKind } from './useHubWeather';

export type ChatHubQuickActionId = 'tasks' | 'memory' | 'outfit' | 'voice';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const WEATHER_ICONS: Record<HubWeatherKind, LucideIcon> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const STATUS_BARS = [
  { key: 'affection' as const, label: '亲密度', icon: Heart, iconClass: 'text-primary', barClass: 'from-[#F49AC1] to-primary' },
  { key: 'hunger' as const, label: '饥饿度', icon: Utensils, iconClass: 'text-warning', barClass: 'from-amber-200 to-warning' },
  { key: 'fatigue' as const, label: '疲劳度', icon: Moon, iconClass: 'text-info', barClass: 'from-violet-200 to-info' },
];

const MODE_META: Record<DesktopPetChatMode, { icon: LucideIcon; label: string; description: string }> = {
  single: { icon: MessageCircle, label: '聊天模式', description: '轻松对话 · 互动陪伴' },
  group: { icon: UsersRound, label: '群聊模式', description: '多个角色一起接话' },
  story: { icon: BookOpen, label: '故事模式', description: '按剧本一起推进剧情' },
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const CARD_CLASS = 'rounded-2xl border border-white/80 hub-glass-card p-4 shadow-[0_10px_30px_rgba(158,84,140,0.12)]';

export interface ChatHubInfoColumnProps {
  activeSlot: DesktopPetSlot | null;
  chatMode: DesktopPetChatMode;
  voiceEnabled: boolean;
  onQuickAction: (id: ChatHubQuickActionId) => void;
}

/** 聊天 Hub 右栏：时间天气、角色状态、当前模式、快捷操作。 */
export function ChatHubInfoColumn({ activeSlot, chatMode, voiceEnabled, onQuickAction }: ChatHubInfoColumnProps) {
  const now = useNow(10_000);
  const weather = useHubWeather();
  const WeatherIcon = weather ? WEATHER_ICONS[weather.kind] : null;
  const mode = MODE_META[chatMode];
  const ModeIcon = mode.icon;
  const quickActions: Array<{ id: ChatHubQuickActionId; icon: LucideIcon; label: string }> = [
    { id: 'tasks', icon: ClipboardCheck, label: '任务' },
    { id: 'memory', icon: Brain, label: '记忆' },
    { id: 'outfit', icon: Shirt, label: '换装' },
    { id: 'voice', icon: voiceEnabled ? Mic : MicOff, label: voiceEnabled ? '语音' : '语音关' },
  ];

  return (
    <aside className="relative z-10 flex w-[300px] shrink-0 flex-col gap-3">
      {/* 时间 + 天气 */}
      <section className={CARD_CLASS}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-4xl font-light tracking-tight text-foreground">{pad(now.getHours())}:{pad(now.getMinutes())}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {now.getFullYear()}/{pad(now.getMonth() + 1)}/{pad(now.getDate())}　{WEEKDAYS[now.getDay()]}
            </div>
          </div>
          {weather && WeatherIcon ? (
            <div className="text-right" title={weather.city || undefined}>
              <div className="flex items-center justify-end gap-1.5 text-xl text-foreground">
                <WeatherIcon className="h-5 w-5 text-warning" />
                {weather.temperature}°C
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{weather.city ? `${weather.city} · ` : ''}{weather.label}</div>
            </div>
          ) : null}
        </div>
      </section>

      {/* 角色状态 */}
      <section className={CARD_CLASS}>
        <h3 className="text-sm font-bold text-foreground">角色状态</h3>
        <div className="mt-3 space-y-3.5">
          {STATUS_BARS.map((bar) => {
            const value = Math.max(0, Math.min(100, Math.round(activeSlot?.stats[bar.key] ?? 0)));
            const Icon = bar.icon;
            return (
              <div key={bar.key} className="flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${bar.iconClass}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{bar.label}</span>
                    <span className="font-mono text-muted-foreground">{value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div className={`h-full rounded-full bg-gradient-to-r ${bar.barClass}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 当前模式 */}
      <section className={CARD_CLASS}>
        <h3 className="text-sm font-bold text-foreground">当前模式</h3>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ModeIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{mode.label}</div>
            <div className="text-xs text-muted-foreground">{mode.description}</div>
          </div>
        </div>
      </section>

      {/* 快捷操作 */}
      <section className={CARD_CLASS}>
        <h3 className="text-sm font-bold text-foreground">快捷操作</h3>
        <div className="mt-3 grid grid-cols-4 gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onQuickAction(action.id)}
                className="flex flex-col items-center gap-1.5 rounded-xl py-2 text-xs text-muted-foreground transition-colors hover:bg-white/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-primary shadow-sm">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {action.label}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
