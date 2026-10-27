import { lazy, Suspense, useEffect, useMemo, useState, type ComponentProps, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Brain, ChevronDown, Check, Settings, Shirt, SlidersHorizontal, PhoneOff, Users, Volume2, VolumeX, X } from 'lucide-react';
import type { PetConfig } from '../../../types';
import type { ChatHubPage } from '../../ChatWindow';
import PetChatConversation from '../PetChatConversation';
import { resolveActiveChatSlot, type ChatTargetOption } from '../multiPetChat';
import { HubAvatar } from '../hub/chatHubShared';
import { PetModelStatusPlaceholder } from '../../pet/PetModelStatusPlaceholder';
import { WindowFrameControls } from '../../WindowFrameControls';
import { openSettingsPage } from '../hub/settingsPageRequest';
import { normalizeInteractiveDialogueSettings, resolveInteractiveDialogueLayout, resolveInteractiveDialogueStageFrame } from '../../../interactiveDialogueSettings';
import { useInteractiveDialoguePreview } from './interactiveDialoguePreview';

const PetVisualRenderer = lazy(() => import('../../pet/PetVisualRenderer'));

type PetSlot = NonNullable<ReturnType<typeof resolveActiveChatSlot>>;
type SidePage = Exclude<ChatHubPage, 'chat'>;

interface InteractiveDialogueViewProps {
  activePetId: string;
  activePetName: string;
  activePetSlot: PetSlot | null;
  petOptions: ChatTargetOption[];
  onChooseRole: (petId: string) => void;
  backgroundLayer: ReactNode;
  config: PetConfig;
  conversationProps: ComponentProps<typeof PetChatConversation>;
  isDragging: boolean;
  isMaximized: boolean;
  isResizing: boolean;
  isTyping: boolean;
  renderHubPage: (page: SidePage, onDone: () => void) => ReactNode;
  resizeHandles: ReactNode;
  style: CSSProperties;
  onHangUp: () => void;
  onMinimize: () => void;
  onStartWindowDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleMaximize: () => void;
  onToggleVoiceEnabled: () => void;
}

const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

const MENU_ITEMS: Array<{ id: SidePage | 'advanced'; label: string; icon: typeof Users }> = [
  { id: 'roles', label: '切换角色', icon: Users },
  { id: 'outfit', label: '换装 / 换模型', icon: Shirt },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'settings', label: '快捷设置', icon: SlidersHorizontal },
  { id: 'advanced', label: '高级设置', icon: Settings },
];

function useWindowHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}

const isControlTarget = (target: EventTarget) => Boolean((target as HTMLElement).closest('button, input, textarea, select, a'));

/**
 * 互动对话：像视频通话 / galgame 一样，角色占满画面，下半身被对话面板挡住；
 * 对话记录可以滚动，输入栏在最下面。角色直接画在聊天窗口里，桌面上同一个角色这段时间先隐藏。
 * 右键角色（或点齿轮）打开菜单：切换角色、换装、记忆、设置都在窗口里完成，不用先挂断。
 */
export function InteractiveDialogueView({
  activePetId,
  activePetName,
  activePetSlot,
  petOptions,
  onChooseRole,
  backgroundLayer,
  config,
  conversationProps,
  isDragging,
  isMaximized,
  isResizing,
  isTyping,
  renderHubPage,
  resizeHandles,
  style,
  onHangUp,
  onMinimize,
  onStartWindowDrag,
  onToggleMaximize,
  onToggleVoiceEnabled,
}: InteractiveDialogueViewProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [sidePage, setSidePage] = useState<SidePage | null>(null);
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);
  const voiceEnabled = config.settings.voiceEnabled;
  const modelPreset = activePetSlot
    ? config.customModelPresets.find((preset) => preset.type === activePetSlot.modelType && preset.url === activePetSlot.modelUrl)
      ?? config.customModelPresets.find((preset) => preset.url === activePetSlot.modelUrl)
    : undefined;
  // 每个角色自己的摆放；设置窗拖滑块时先用预览值，保存后就是同一份。
  const layout = useInteractiveDialoguePreview(
    activePetId,
    resolveInteractiveDialogueLayout(normalizeInteractiveDialogueSettings(config.settings.interactiveDialogue), activePetId),
  );
  const stageFrame = resolveInteractiveDialogueStageFrame(layout);
  const windowHeight = useWindowHeight();
  // Live2D 按“舞台”大小摆放模型，舞台要跟画框一样大（2D、Live2D 的画框是正方形）。
  const stageFramePx = Math.round(windowHeight * stageFrame.heightPercent / 100);
  const stageViewport = useMemo(
    () => ({ height: stageFramePx, width: stageFramePx, x: 0, y: 0 }),
    [stageFramePx],
  );
  const sidePageContent = sidePage ? renderHubPage(sidePage, () => setSidePage(null)) : null;

  useEffect(() => {
    if (!menuPosition) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuPosition(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuPosition]);

  // 舞台和空白处都能拖动窗口、双击最大化；按钮、输入框、对话记录不参与。
  const stageProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || isControlTarget(event.target)) return;
      setMenuPosition(null);
      onStartWindowDrag(event);
    },
    onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (!isControlTarget(event.target)) onToggleMaximize();
    },
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
  };
  const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const chooseMenuItem = (id: SidePage | 'advanced') => {
    setMenuPosition(null);
    if (id === 'advanced') openSettingsPage();
    else setSidePage(id);
  };

  return (
    <div
      style={style}
      className={`relative h-screen w-screen overflow-hidden ${isMaximized ? 'rounded-none' : 'rounded-[10px]'} border border-white/70 app-shell-canvas text-foreground ${isResizing || isDragging ? 'select-none' : ''}`}
    >
      {backgroundLayer}

      {/* 舞台：铺满窗口，可拖动、右键出菜单 */}
      <div className="absolute inset-0 z-10" {...stageProps}>
        {activePetSlot?.modelUrl ? (
          // 角色按整身适配到比窗口高得多的画框里，再整体上移：腰以下落在对话面板后面，看起来是半身入镜。
          // 大小、上下左右位置在 设置 → 高级 → 互动对话 里调（2D、Live2D、3D、MMD 都用同一个画框）。
          <div
            data-preview-stage-frame
            className="pointer-events-none absolute"
            style={activePetSlot.modelType === '3d'
              // 3D 只按高度取景，画框跟窗口一样宽就够了（画布越大越吃显卡）。
              ? { height: `${stageFrame.heightPercent}vh`, left: `${stageFrame.leftPercent}vw`, top: `${stageFrame.topPercent}vh`, width: '100vw' }
              // 2D、Live2D 是“放进画框里”的缩放：画框做成正方形，角色才会按高度放大，而不是被窗口宽度卡住。
              : {
                height: `${stageFrame.heightPercent}vh`,
                left: `calc(50vw - ${stageFrame.heightPercent / 2}vh + ${stageFrame.leftPercent}vw)`,
                top: `${stageFrame.topPercent}vh`,
                width: `${stageFrame.heightPercent}vh`,
              }}
          >
            <Suspense fallback={<PetModelStatusPlaceholder kind="loading" />}>
              <PetVisualRenderer
                key={`${activePetSlot.id}:${activePetSlot.modelType}:${activePetSlot.modelUrl}`}
                action="IDLE"
                avatar3dRuntimeBackend="three"
                debugPetId={`interactive-dialogue:${activePetSlot.id}`}
                fitToPreview
                isMoving={false}
                modelType={activePetSlot.modelType}
                modelUrl={activePetSlot.modelUrl}
                renderKind={modelPreset?.renderKind}
                scale={1}
                updatePriority="primary"
                viewport={activePetSlot.modelType === '3d' ? null : stageViewport}
                visible
              />
            </Suspense>
          </div>
        ) : null}
      </div>

      {/* 顶栏：左边角色名；右边语音、菜单、挂断，再右边是标准的最小化/最大化/关闭 */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between pl-5 pt-3" {...stageProps}>
        {/* 点角色名展开角色列表，选一个就换人，模型跟着换 */}
        <div className="relative mt-1" style={noDragRegionStyle} onPointerDown={stopPropagation}>
          <button
            type="button"
            onClick={() => setIsRolePickerOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-white/70 hub-glass-panel py-1 pl-1.5 pr-3 shadow-[0_8px_24px_rgba(158,84,140,0.14)] transition-colors hover:bg-white/70"
            title="切换角色"
          >
            <HubAvatar slot={activePetSlot} name={activePetName} className="h-7 w-7 text-xs ring-2 ring-white" />
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-bold text-foreground">{activePetName}</span>
            <span className="text-xs text-muted-foreground">{isTyping ? '正在说话…' : '通话中'}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isRolePickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {isRolePickerOpen ? (
            <>
              <div className="fixed inset-0 z-40" onPointerDown={() => setIsRolePickerOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-white/80 hub-glass-panel p-1.5 shadow-[0_18px_48px_rgba(158,84,140,0.22)]">
                {petOptions.map((option) => {
                  const isActive = option.id === activePetId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setIsRolePickerOpen(false);
                        if (!isActive) onChooseRole(option.id);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-white/70'}`}
                    >
                      <HubAvatar slot={resolveActiveChatSlot(config, option.id)} name={option.name} className="h-8 w-8 text-xs" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{option.name}</span>
                      {isActive ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
        <div className="mr-[160px] flex items-start" style={noDragRegionStyle} onPointerDown={stopPropagation}>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleVoiceEnabled}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/70 hub-glass-panel transition-colors hover:text-foreground ${voiceEnabled ? 'text-primary' : 'text-muted-foreground'}`}
              title={voiceEnabled ? '关闭语音播报' : '开启语音播报'}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setMenuPosition(menuPosition ? null : { x: rect.right - 200, y: rect.bottom + 8 });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 hub-glass-panel text-muted-foreground transition-colors hover:text-foreground"
              title="切换角色、换装、设置（也可以右键角色）"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onHangUp}
              className="flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(239,68,68,0.35)] transition-colors hover:bg-red-600"
              title="挂断，回到桌面"
            >
              <PhoneOff className="h-4 w-4" />
              挂断
            </button>
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 z-30 overflow-hidden rounded-bl-2xl hub-glass-panel" style={noDragRegionStyle}>
        <WindowFrameControls
          closeTitle="挂断并关闭"
          minimizeTitle="最小化"
          onClose={onHangUp}
          onMinimize={onMinimize}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
        />
      </div>

      {/* 对话面板：保留完整记录，可以滚动 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex min-h-[200px] justify-center px-5 pb-5"
        style={{ height: `${layout.panelHeightPercent}%` }}
      >
        <section
          style={{ maxWidth: layout.panelMaxWidth }}
          className="pointer-events-auto flex h-full w-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/80 hub-glass-panel shadow-[0_18px_48px_rgba(158,84,140,0.18)]"
          onPointerDown={() => setMenuPosition(null)}
        >
          <PetChatConversation {...conversationProps} />
        </section>
      </div>

      {/* 右侧抽屉：角色、换装、记忆、快捷设置，和聊天 Hub 里是同一套页面 */}
      {sidePage && sidePageContent ? (
        <div
          className="absolute bottom-5 right-5 top-16 z-40 flex w-[min(440px,42%)] min-w-[320px] flex-col"
          style={noDragRegionStyle}
          onPointerDown={stopPropagation}
        >
          <button
            type="button"
            onClick={() => setSidePage(null)}
            className="absolute -left-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white text-muted-foreground shadow transition-colors hover:text-foreground"
            title="收起"
          >
            <X className="h-4 w-4" />
          </button>
          {sidePageContent}
        </div>
      ) : null}

      {menuPosition ? (
        <>
          <div className="absolute inset-0 z-40" onPointerDown={() => setMenuPosition(null)} onContextMenu={(event) => { event.preventDefault(); setMenuPosition(null); }} />
          <div
            className="absolute z-50 w-[200px] overflow-hidden rounded-2xl border border-white/80 hub-glass-panel p-1.5 shadow-[0_18px_48px_rgba(158,84,140,0.22)]"
            style={{
              ...noDragRegionStyle,
              left: Math.max(8, Math.min(menuPosition.x, window.innerWidth - 208)),
              top: Math.max(8, Math.min(menuPosition.y, window.innerHeight - 8 - MENU_ITEMS.length * 40)),
            }}
          >
            {MENU_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseMenuItem(id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/70"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {resizeHandles}
    </div>
  );
}
