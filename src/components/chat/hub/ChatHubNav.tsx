import { type PointerEvent as ReactPointerEvent } from 'react';
import {
  Brain,
  ChevronRight,
  ClipboardCheck,
  MessageCircle,
  Puzzle,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { type DesktopPetSlot } from '../../../multiPetRoster';
import { HubAvatar, resolveHubSignature } from './chatHubShared';

export type ChatHubNavId = 'chat' | 'roles' | 'group' | 'memory' | 'tasks' | 'plugins' | 'settings';

const NAV_ITEMS: Array<{ id: ChatHubNavId; icon: LucideIcon; label: string }> = [
  { id: 'chat', icon: MessageCircle, label: '聊天' },
  { id: 'roles', icon: UserRound, label: '角色' },
  { id: 'group', icon: UsersRound, label: '群聊' },
  { id: 'memory', icon: Brain, label: '记忆' },
  { id: 'tasks', icon: ClipboardCheck, label: '任务' },
  { id: 'plugins', icon: Puzzle, label: '插件' },
  { id: 'settings', icon: Settings, label: '设置' },
];

export interface ChatHubNavProps {
  activeId: ChatHubNavId;
  activeSlot: DesktopPetSlot | null;
  activePetName: string;
  /** Small count shown on a nav item, e.g. memory proposals waiting for approval. */
  badges?: Partial<Record<ChatHubNavId, number>>;
  compact: boolean;
  onSelect: (id: ChatHubNavId) => void;
  onStartWindowDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleMaximize: () => void;
}

/** 聊天 Hub 左栏：品牌 + 当前角色卡 + 功能导航（窄窗口时只显示图标）。 */
export function ChatHubNav({ activeId, activeSlot, activePetName, badges, compact, onSelect, onStartWindowDrag, onToggleMaximize }: ChatHubNavProps) {
  const signature = activeSlot ? resolveHubSignature(activeSlot.personality.greeting) : '';

  return (
    <nav
      aria-label="主导航"
      className={`relative z-10 flex h-full shrink-0 flex-col gap-4 border-r border-white/50 glass-bar py-5 ${compact ? 'w-[76px] items-center px-2' : 'w-[236px] px-4'}`}
      // 整个导航栏（按钮以外）都可以拖动窗口；拖动逻辑会自动忽略按钮。
      onPointerDown={onStartWindowDrag}
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) onToggleMaximize();
      }}
    >
      {/* 品牌文字；窄窗口只显示图标导航时不显示 */}
      {!compact ? (
        <div className="min-w-0 px-1 leading-tight">
          <div className="text-xl font-bold text-foreground">AI Pets Hub</div>
          <div className="truncate text-[9px] text-muted-foreground">Your AI Companions, Always With You</div>
        </div>
      ) : null}

      {/* 当前角色卡 */}
      {compact ? (
        <HubAvatar slot={activeSlot} name={activePetName} className="h-11 w-11 text-sm ring-2 ring-white" />
      ) : (
        <div className="border-b border-white/60 pb-4">
          <div className="flex items-center gap-3">
            <HubAvatar slot={activeSlot} name={activePetName} className="h-[70px] w-[70px] text-xl ring-2 ring-white" />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-foreground">{activePetName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                在线
              </div>
            </div>
          </div>
          {signature ? <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">「{signature}」</p> : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          const badge = badges?.[item.id] ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              title={compact ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={[
                'flex items-center rounded-xl text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                compact ? 'h-11 w-11 justify-center' : 'w-full gap-3 px-3.5 py-3 text-left',
                isActive
                  ? 'bg-white/70 font-semibold text-primary shadow-[0_6px_18px_rgba(158,84,140,0.16)]'
                  : 'text-foreground/75 hover:bg-white/45 hover:text-foreground',
              ].join(' ')}
            >
              <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-primary/15' : 'bg-white/50'}`}>
                <Icon className="h-4 w-4" />
                {badge > 0 ? (
                  <span
                    aria-label={`${badge} 条待处理`}
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
              {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
              {!compact && isActive ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
