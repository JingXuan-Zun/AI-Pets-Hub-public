import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export const CHAT_SIDEBAR_TOGGLE_SHORTCUT_LABEL = 'Ctrl+B';

export function isChatSidebarToggleShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
    && event.key.toLowerCase() === 'b';
}

export function ChatSidebarToggleButton({
  buttonClassName = 'text-slate-900 hover:bg-slate-200/80',
  className = '',
  isCollapsed,
  onToggle,
  tooltipAlign = 'left',
}: {
  buttonClassName?: string;
  className?: string;
  isCollapsed: boolean;
  onToggle: () => void;
  tooltipAlign?: 'left' | 'right';
}) {
  const label = isCollapsed ? '显示侧边栏' : '隐藏侧边栏';
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <div className={`group/sidebar-toggle ${className}`}>
      {/* Plain icon like the minimize / maximize controls: no fill until hovered. */}
      <button
        type="button"
        aria-expanded={!isCollapsed}
        aria-keyshortcuts="Control+B"
        aria-label={label}
        onClick={onToggle}
        className={`inline-flex h-8 w-9 items-center justify-center rounded-sm bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${buttonClassName}`}
      >
        <Icon className="h-4 w-4 stroke-[2.2]" />
      </button>
      <div
        role="tooltip"
        // Beside the button, not below it: below, the chat content would cover it.
        className={`pointer-events-none absolute ${tooltipAlign === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-1/2 z-40 -translate-y-1/2 flex items-center gap-2 whitespace-nowrap rounded-md bg-sky-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/sidebar-toggle:opacity-100 group-focus-within/sidebar-toggle:opacity-100`}
      >
        <span>{label}</span>
        <span className="text-white/60">{CHAT_SIDEBAR_TOGGLE_SHORTCUT_LABEL}</span>
      </div>
    </div>
  );
}
