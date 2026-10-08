import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, Check, Gamepad2, MessageCircle, Monitor, RefreshCw, Settings2, Sparkles, StopCircle, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PET_ACTION_LABELS, QUICK_SELECT_PET_ACTIONS } from '../../pet-runtime/content/petModelMotionBindings';
import { type ModelType, type PetAction, type PetModelMotionBinding } from '../../types';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import {
  type GameCompanionLoopStatusSnapshot,
  type GameCompanionSourcePreference,
} from './useGameCompanionLoopController';
import {
  PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT,
  PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH,
  PET_QUICK_ACTION_MENU_SAFE_PADDING_X,
  PET_QUICK_ACTION_PANEL_WIDTH,
  QUICK_MENU_BASE_HEIGHT,
  QUICK_MENU_BASE_WIDTH,
  QUICK_MENU_BUTTON_STACK_OFFSET_X,
  QUICK_MENU_CONTENT_GAP,
  QUICK_MENU_ICON_SIZE,
  QUICK_MENU_ITEM_LAYOUTS,
  QUICK_MENU_LABEL_FONT_SIZE,
  QUICK_MENU_LAYOUT_HEIGHT,
  QUICK_MENU_LAYOUT_WIDTH,
  QUICK_MENU_NATIVE_SHAPE_PADDING,
  QUICK_MENU_SCALE,
  QUICK_MENU_STAGE_OFFSET_X,
  QUICK_MENU_STAGE_OFFSET_Y,
  QUICK_SUB_PANEL_WIDTH,
  type PetQuickActionMenuItemId,
} from './petQuickActionMenuGeometry';
export {
  PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT,
  PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH,
  PET_QUICK_ACTION_MENU_SAFE_PADDING_X,
  PET_QUICK_ACTION_PANEL_WIDTH,
} from './petQuickActionMenuGeometry';

type Position = {
  x: number;
  y: number;
};

type MenuItemId = PetQuickActionMenuItemId;

interface PetQuickActionMenuProps {
  activeItemId?: MenuItemId | null;
  activePetAction?: PetAction;
  activePetModelType: ModelType;
  activeCustomMotionBindingId?: string | null;
  activePetName?: string;
  customMotionBindings?: PetModelMotionBinding[];
  gameCompanionLoopStatus: GameCompanionLoopStatusSnapshot;
  gameCompanionSourcePreference: GameCompanionSourcePreference | null;
  isAgentSelectorOpen?: boolean;
  isActionSelectorOpen?: boolean;
  isChatSelectorOpen?: boolean;
  isInteractiveDialogueActive?: boolean;
  isOpen: boolean;
  nativeDragOwnerId: string;
  position: Position;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenControls: () => void;
  onOpenInteractiveDialogue: () => void;
  onOpenNormalAgent: () => void;
  onOpenSettings: () => void;
  onOpenAgent: () => void;
  onGameCompanionSourcePreferenceChange: (preference: GameCompanionSourcePreference | null) => void;
  onRestartGameCompanionLoopWithScreenSource: () => void;
  onRestartGameCompanionLoopWithSourcePreference: (preference: GameCompanionSourcePreference | null) => void;
  onStopGameCompanionLoop: () => void;
  onSelectAction: (action: PetAction) => void;
  onSelectCustomMotionBinding: (binding: PetModelMotionBinding) => void;
  onToggleGameCompanionLoop: () => void;
  onToggleActionSelector: () => void;
  onToggleChatSelector: () => void;
}

type MenuItemDefinition = {
  description: string;
  icon: typeof Settings2;
  id: MenuItemId;
  label: string;
  rotation: number;
  translateX: number;
  translateY: number;
};

const MENU_ITEM_CONTENT_BY_ID: Record<MenuItemId, Pick<MenuItemDefinition, 'description' | 'icon' | 'label'>> = {
  settings: {
    description: '打开设置总览',
    icon: Settings2,
    label: '设置',
  },
  chat: {
    description: '打开当前角色的对话方式',
    icon: MessageCircle,
    label: '对话',
  },
  agent: {
    description: '打开 Agent 功能选项',
    icon: Bot,
    label: 'Agent',
  },
  controls: {
    description: '打开动作和控制',
    icon: Sparkles,
    label: '动作',
  },
  close: {
    description: '收起右键菜单',
    icon: X,
    label: '收起',
  },
};

const MENU_ITEMS: MenuItemDefinition[] = QUICK_MENU_ITEM_LAYOUTS.map((item) => ({
  ...item,
  ...MENU_ITEM_CONTENT_BY_ID[item.id],
}));

function formatGameCompanionSourceType(type: DesktopPetCaptureSourceLike['type']) {
  return type === 'screen' ? '屏幕' : '窗口';
}

function createGameCompanionCaptureSourceLabel(source: DesktopPetCaptureSourceLike) {
  const sizeText = source.width && source.height ? ` ${source.width}x${source.height}` : '';
  return `${formatGameCompanionSourceType(source.type)} · ${source.name}${sizeText}`;
}

function createGameCompanionSourcePreference(source: DesktopPetCaptureSourceLike): GameCompanionSourcePreference | null {
  if (!source.id || (source.type !== 'screen' && source.type !== 'window')) {
    return null;
  }

  return {
    sourceId: source.id,
    sourceLabel: createGameCompanionCaptureSourceLabel(source),
    sourceType: source.type,
  };
}

export const PetQuickActionMenu = memo(function PetQuickActionMenu({
  activeItemId = null,
  activePetAction = 'IDLE',
  activePetModelType,
  activeCustomMotionBindingId = null,
  activePetName = '当前角色',
  customMotionBindings = [],
  gameCompanionLoopStatus,
  gameCompanionSourcePreference,
  isAgentSelectorOpen = false,
  isActionSelectorOpen = false,
  isChatSelectorOpen = false,
  isInteractiveDialogueActive = false,
  isOpen,
  nativeDragOwnerId,
  position,
  onClose,
  onOpenChat,
  onOpenControls,
  onOpenInteractiveDialogue,
  onOpenNormalAgent,
  onOpenSettings,
  onOpenAgent,
  onGameCompanionSourcePreferenceChange,
  onRestartGameCompanionLoopWithScreenSource,
  onRestartGameCompanionLoopWithSourcePreference,
  onStopGameCompanionLoop,
  onSelectAction,
  onSelectCustomMotionBinding,
  onToggleGameCompanionLoop,
  onToggleActionSelector,
  onToggleChatSelector,
}: PetQuickActionMenuProps) {
  const [isGameSourcePickerOpen, setIsGameSourcePickerOpen] = useState(false);
  const [gameSourcePickerSources, setGameSourcePickerSources] = useState<DesktopPetCaptureSourceLike[]>([]);
  const [gameSourcePickerLoading, setGameSourcePickerLoading] = useState(false);
  const [gameSourcePickerError, setGameSourcePickerError] = useState('');
  const itemHandlers = useMemo<Record<MenuItemId, () => void>>(() => ({
    settings: onOpenSettings,
    chat: onToggleChatSelector,
    agent: onOpenAgent,
    controls: onToggleActionSelector,
    close: onClose,
  }), [onClose, onOpenAgent, onOpenSettings, onToggleActionSelector, onToggleChatSelector]);
  const importedSectionTitle = activePetModelType === 'live2d'
    ? 'Live2D 动作 / 表情'
    : '3D 动画文件';
  const importedSectionDescription = activePetModelType === 'live2d'
    ? '当前模型的 motion3 / exp3 数据'
    : '当前模型已导入的 3D 动作数据';
  const refreshGameSourcePickerSources = useCallback(async () => {
    setGameSourcePickerLoading(true);
    setGameSourcePickerError('');
    try {
      const sources = await desktopPetShellRuntime.listCaptureSources({
        captureSourceTypes: ['screen', 'window'],
        forceRefresh: true,
        includeCaptureThumbnails: false,
      });
      setGameSourcePickerSources(Array.isArray(sources) ? sources : []);
    } catch (error) {
      setGameSourcePickerError(error instanceof Error ? error.message : '读取窗口/屏幕来源失败');
    } finally {
      setGameSourcePickerLoading(false);
    }
  }, []);
  const toggleGameSourcePicker = useCallback(() => {
    setIsGameSourcePickerOpen((isOpen) => {
      const nextOpen = !isOpen;
      if (nextOpen && gameSourcePickerSources.length === 0 && !gameSourcePickerLoading) {
        void refreshGameSourcePickerSources();
      }
      return nextOpen;
    });
  }, [gameSourcePickerLoading, gameSourcePickerSources.length, refreshGameSourcePickerSources]);
  const openGameSourcePickerForRecovery = useCallback(() => {
    setIsGameSourcePickerOpen(true);
    void refreshGameSourcePickerSources();
  }, [refreshGameSourcePickerSources]);
  const applyGameCompanionSourcePreference = useCallback((preference: GameCompanionSourcePreference | null) => {
    if (gameCompanionLoopStatus.running) {
      onRestartGameCompanionLoopWithSourcePreference(preference);
      return;
    }

    onGameCompanionSourcePreferenceChange(preference);
  }, [
    gameCompanionLoopStatus.running,
    onGameCompanionSourcePreferenceChange,
    onRestartGameCompanionLoopWithSourcePreference,
  ]);
  const shouldShowGameCompanionRecoveryActions = gameCompanionLoopStatus.running
    && (gameCompanionLoopStatus.sourceCheckStatus === 'uncertain' || gameCompanionLoopStatus.sourceCheckStatus === 'error');
  const handleGameCompanionToggle = useCallback(() => {
    if (gameCompanionLoopStatus.running || gameCompanionSourcePreference) {
      onToggleGameCompanionLoop();
      return;
    }

    openGameSourcePickerForRecovery();
  }, [
    gameCompanionLoopStatus.running,
    gameCompanionSourcePreference,
    onToggleGameCompanionLoop,
    openGameSourcePickerForRecovery,
  ]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-desktop-pet-native-drag-owner-id={nativeDragOwnerId}
          initial={{ opacity: 0, x: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.98 }}
          transition={{ duration: 0.11, ease: 'easeOut' }}
          className="absolute z-[65] pointer-events-auto"
          style={{
            left: position.x,
            top: position.y,
            transformOrigin: 'left top',
          }}
        >
          <div
            data-desktop-pet-interactive="true"
            data-desktop-pet-window-shape-padding={QUICK_MENU_NATIVE_SHAPE_PADDING}
            data-desktop-pet-window-shape="true"
            data-desktop-pet-native-scope="pet"
            data-desktop-pet-quick-menu-debug="shape"
          className="relative"
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              height: PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT,
              transform: `translate(${-PET_QUICK_ACTION_MENU_SAFE_PADDING_X}px, -50%)`,
              width: PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH,
            }}
          >
            <div
              data-desktop-pet-quick-menu-debug="stage"
              className="absolute shrink-0"
              style={{
                height: QUICK_MENU_LAYOUT_HEIGHT,
                left: QUICK_MENU_STAGE_OFFSET_X,
                top: QUICK_MENU_STAGE_OFFSET_Y,
                width: QUICK_MENU_LAYOUT_WIDTH,
              }}
            >
              <AnimatePresence>
                {isChatSelectorOpen && (
                  <motion.div
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape-padding={QUICK_MENU_NATIVE_SHAPE_PADDING}
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-native-scope="pet"
                    initial={{ opacity: 0, x: 12, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 8, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="absolute top-1/2 z-[80] overflow-hidden rounded-[26px] border border-sky-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,252,0.96))] shadow-[0_18px_40px_rgba(148,163,184,0.2)] backdrop-blur-xl"
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                      left: QUICK_MENU_LAYOUT_WIDTH + 12,
                      transform: 'translateY(-50%)',
                      width: QUICK_SUB_PANEL_WIDTH,
                    }}
                  >
                    <div className="border-b border-sky-100/80 px-4 py-3">
                      <div className="truncate text-[12px] font-semibold tracking-[0.14em] text-slate-700">{activePetName}</div>
                      <div className="mt-1 text-[10px] text-slate-500">切换当前角色的对话模式</div>
                    </div>

                    <div className="space-y-2 p-3">
                      <button
                        type="button"
                        onClick={onOpenChat}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          !isInteractiveDialogueActive
                            ? 'border-sky-300 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white/80 text-slate-600 hover:border-sky-200 hover:text-sky-700'
                        }`}
                      >
                        <div className="text-[11px] font-semibold tracking-[0.08em]">普通对话</div>
                        <div className="mt-1 text-[9px] text-slate-400">保持桌宠原位，在右侧呼出聊天界面</div>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenInteractiveDialogue}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          isInteractiveDialogueActive
                            ? 'border-sky-300 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white/80 text-slate-600 hover:border-sky-200 hover:text-sky-700'
                        }`}
                      >
                        <div className="text-[11px] font-semibold tracking-[0.08em]">互动对话</div>
                        <div className="mt-1 text-[9px] text-slate-400">进入放大展示模式，锁定拖拽、位移和缩放</div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isAgentSelectorOpen && (
                  <motion.div
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape-padding={QUICK_MENU_NATIVE_SHAPE_PADDING}
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-native-scope="pet"
                    initial={{ opacity: 0, x: 12, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 8, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="absolute top-1/2 z-[80] overflow-hidden rounded-[26px] border border-sky-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,252,0.96))] shadow-[0_18px_40px_rgba(148,163,184,0.2)] backdrop-blur-xl"
                    style={{
                      left: QUICK_MENU_LAYOUT_WIDTH + 12,
                      transform: 'translateY(-50%)',
                      width: QUICK_SUB_PANEL_WIDTH,
                    }}
                  >
                    <div className="border-b border-sky-100/80 px-4 py-3">
                      <div className="truncate text-[12px] font-semibold tracking-[0.14em] text-slate-700">Agent</div>
                      <div className="mt-1 text-[10px] text-slate-500">选择 Agent 的使用方式</div>
                    </div>

                    <div className="space-y-2 p-3">
                      {gameCompanionLoopStatus.running && (
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-800">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-semibold tracking-[0.08em]">游戏陪玩中</div>
                              <div
                                className="mt-0.5 truncate text-[9px] text-violet-500"
                                title={gameCompanionLoopStatus.lockedSourceLabel ?? gameCompanionLoopStatus.query ?? '自动来源'}
                              >
                                {gameCompanionLoopStatus.lockedSourceLabel ?? gameCompanionLoopStatus.query ?? '自动来源'}
                              </div>
                              <div
                                className="mt-0.5 truncate text-[9px] text-violet-500"
                                title={gameCompanionLoopStatus.sourceCheckMessage ?? gameCompanionLoopStatus.lastObservationSummary ?? undefined}
                              >
                                {gameCompanionLoopStatus.sourceCheckMessage
                                  ? `${gameCompanionLoopStatus.sourceCheckMessage} · `
                                  : gameCompanionLoopStatus.lastObservationSummary
                                  ? `${gameCompanionLoopStatus.lastObservationSummary} · `
                                  : `${gameCompanionLoopStatus.isTicking ? '正在分析' : '等待下次观察'} · `}
                                {gameCompanionLoopStatus.sampleCount}/{gameCompanionLoopStatus.maxSamples}
                                {' · '}
                                评论 {gameCompanionLoopStatus.commentCount}
                              </div>
                              {gameCompanionLoopStatus.detectedGameOrGenre ? (
                                <div
                                  className="mt-0.5 truncate text-[9px] font-semibold text-violet-700"
                                  title={gameCompanionLoopStatus.gameIdentityEvidence ?? undefined}
                                >
                                  识别：{gameCompanionLoopStatus.detectedGameOrGenre}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={onStopGameCompanionLoop}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white/80 text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-50"
                              title="停止游戏陪玩"
                            >
                              <StopCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {shouldShowGameCompanionRecoveryActions && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={openGameSourcePickerForRecovery}
                                className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-violet-100 bg-white/80 px-2 py-1 text-[9px] font-semibold text-violet-700 transition-colors hover:border-violet-200 hover:bg-white"
                              >
                                <RefreshCw className="h-3 w-3" />
                                重选来源
                              </button>
                              <button
                                type="button"
                                onClick={onRestartGameCompanionLoopWithScreenSource}
                                className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700 transition-colors hover:border-amber-200 hover:bg-amber-100"
                              >
                                <Monitor className="h-3 w-3" />
                                看屏幕
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 shrink-0 text-sky-700" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold tracking-[0.08em] text-slate-700">游戏来源</div>
                            <div className="mt-0.5 truncate text-[9px] text-slate-400">
                              {gameCompanionSourcePreference?.sourceLabel ?? '请先选择要观察的游戏窗口或屏幕'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={toggleGameSourcePicker}
                            className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-[9px] font-semibold text-sky-700 transition-colors hover:border-sky-200 hover:bg-sky-100"
                          >
                            {isGameSourcePickerOpen ? '收起' : '选择'}
                          </button>
                        </div>

                        {isGameSourcePickerOpen && (
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void refreshGameSourcePickerSources()}
                                disabled={gameSourcePickerLoading}
                                className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold text-slate-500 transition-colors hover:border-sky-200 hover:text-sky-700 disabled:opacity-60"
                              >
                                <RefreshCw className={`h-3 w-3 ${gameSourcePickerLoading ? 'animate-spin' : ''}`} />
                                刷新
                              </button>
                              <button
                                type="button"
                                onClick={() => applyGameCompanionSourcePreference(null)}
                                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold transition-colors ${
                                  gameCompanionSourcePreference
                                    ? 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-700'
                                    : 'border-sky-200 bg-sky-50 text-sky-700'
                                }`}
                              >
                                {!gameCompanionSourcePreference && <Check className="h-3 w-3" />}
                                自动
                              </button>
                            </div>

                            {gameSourcePickerError && (
                              <div className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-1.5 text-[9px] text-rose-500">
                                {gameSourcePickerError}
                              </div>
                            )}

                            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                              {gameSourcePickerLoading && gameSourcePickerSources.length === 0 ? (
                                <div className="rounded-xl border border-slate-100 bg-white/70 px-2 py-2 text-center text-[9px] text-slate-400">
                                  正在读取窗口和屏幕...
                                </div>
                              ) : null}

                              {gameSourcePickerSources.map((source) => {
                                const preference = createGameCompanionSourcePreference(source);
                                const isSelected = Boolean(preference && gameCompanionSourcePreference?.sourceId === preference.sourceId);
                                return (
                                  <button
                                    key={`${source.type}:${source.id ?? source.name}`}
                                    type="button"
                                    disabled={!preference}
                                    onClick={() => {
                                      if (!preference) {
                                        return;
                                      }
                                      applyGameCompanionSourcePreference(preference);
                                      setIsGameSourcePickerOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors ${
                                      isSelected
                                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                                        : 'border-slate-100 bg-white/75 text-slate-600 hover:border-sky-100 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300'
                                    }`}
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[9px] font-semibold">
                                      {source.type === 'screen' ? '屏' : '窗'}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[10px] font-semibold">
                                        {source.name || createGameCompanionCaptureSourceLabel(source)}
                                      </span>
                                      <span className="block truncate text-[8px] text-slate-400">
                                        {createGameCompanionCaptureSourceLabel(source)}
                                      </span>
                                    </span>
                                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                                  </button>
                                );
                              })}

                              {!gameSourcePickerLoading && gameSourcePickerSources.length === 0 && !gameSourcePickerError ? (
                                <div className="rounded-xl border border-slate-100 bg-white/70 px-2 py-2 text-center text-[9px] text-slate-400">
                                  暂时没有可用窗口/屏幕来源
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={onOpenNormalAgent}
                        className="w-full rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-left text-violet-800 transition-colors hover:border-violet-300 hover:bg-violet-100"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em]">
                          <Bot className="h-4 w-4 shrink-0" />
                          <span>普通 Agent</span>
                        </div>
                        <div className="mt-1 text-[9px] text-violet-500">在普通聊天框里输入电脑任务</div>
                      </button>

                      <button
                        type="button"
                        onClick={handleGameCompanionToggle}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          gameCompanionLoopStatus.running
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                            : 'border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em]">
                          <Gamepad2 className="h-4 w-4 shrink-0" />
                          <span>{gameCompanionLoopStatus.running ? '关闭游戏陪玩' : '开启游戏陪玩'}</span>
                        </div>
                        <div className={`mt-1 text-[9px] ${gameCompanionLoopStatus.running ? 'text-rose-500' : 'text-sky-500'}`}>
                          {gameCompanionLoopStatus.running ? '停止低频观察和短句陪聊' : gameCompanionSourcePreference ? '低频观察已选游戏来源，不进入互动对话' : '先选择游戏窗口或屏幕，避免抓到无关画面'}
                        </div>
                      </button>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isActionSelectorOpen && (
                  <motion.div
                    data-desktop-pet-interactive="true"
                    data-desktop-pet-window-shape-padding={QUICK_MENU_NATIVE_SHAPE_PADDING}
                    data-desktop-pet-window-shape="true"
                    data-desktop-pet-native-scope="pet"
                    initial={{ opacity: 0, x: 12, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 8, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="absolute top-1/2 z-[80] overflow-hidden rounded-[26px] border border-sky-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,252,0.96))] shadow-[0_18px_40px_rgba(148,163,184,0.2)] backdrop-blur-xl"
                    style={{
                      left: QUICK_MENU_LAYOUT_WIDTH + 12,
                      transform: 'translateY(-50%)',
                      width: PET_QUICK_ACTION_PANEL_WIDTH,
                    }}
                  >
                    <div className="border-b border-sky-100/80 px-4 py-3">
                      <div className="truncate text-[12px] font-semibold tracking-[0.14em] text-slate-700">{activePetName}</div>
                      <div className="mt-1 text-[10px] text-slate-500">直接切换这只角色的当前动作</div>
                    </div>

                    <div className="grid grid-cols-1 gap-0 border-b border-sky-100/80">
                      {activePetModelType === '2d' && (
                        <section className="px-4 py-3">
                          <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">2D 动作</div>
                          <div className="mt-1 text-[9px] text-slate-400">基础动作槽位，直接切换当前角色状态</div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {QUICK_SELECT_PET_ACTIONS.map((action) => {
                              const isActive = activePetAction === action;

                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => onSelectAction(action)}
                                  className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                                    isActive
                                      ? 'border-sky-300 bg-sky-50 text-sky-700'
                                      : 'border-slate-200 bg-white/75 text-slate-600 hover:border-sky-200 hover:text-sky-700'
                                  }`}
                                >
                                  <div className="text-[11px] font-semibold tracking-[0.08em]">
                                    {PET_ACTION_LABELS[action]}
                                  </div>
                                  <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-slate-400">
                                    {action}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {activePetModelType !== '2d' && (
                        <section className="px-4 py-3">
                          <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">{importedSectionTitle}</div>
                          <div className="mt-1 text-[9px] text-slate-400">{importedSectionDescription}</div>

                          {customMotionBindings.length > 0 ? (
                            <div className="mt-3 max-h-[286px] space-y-2 overflow-y-auto pr-1">
                              {customMotionBindings.map((binding) => {
                                const isSelected = activeCustomMotionBindingId === binding.id;

                                return (
                                  <button
                                    key={binding.id}
                                    type="button"
                                    onClick={() => onSelectCustomMotionBinding(binding)}
                                    className={`w-full rounded-2xl border px-3 py-2 text-left transition-colors ${
                                      isSelected
                                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                                        : 'border-slate-200 bg-white/75 text-slate-600 hover:border-sky-200 hover:text-sky-700'
                                    }`}
                                  >
                                    <div className="truncate text-[11px] font-semibold tracking-[0.06em]">
                                      {binding.name}
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest text-slate-400">
                                      <span>{binding.format}</span>
                                      <span>{binding.motionKey}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-3 flex min-h-[286px] items-center justify-center rounded-[10px] border border-dashed border-slate-200 bg-white/55 px-4 text-center text-[10px] leading-5 text-slate-400">
                              当前模型还没有导入可用动作，
                              <br />
                              导入后会显示在这里。
                            </div>
                          )}
                        </section>
                      )}
                    </div>

                    <div className="border-t border-sky-100/80 px-3 py-3">
                      <button
                        type="button"
                        onClick={onOpenControls}
                        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-700"
                      >
                        更多控制
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className="relative flex items-center justify-center"
                style={{
                  height: QUICK_MENU_BASE_HEIGHT,
                  transform: `scale(${QUICK_MENU_SCALE})`,
                  transformOrigin: 'left top',
                  width: QUICK_MENU_BASE_WIDTH,
                }}
              >
                {MENU_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeItemId === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        delay: index * 0.0175,
                        duration: 0.11,
                        ease: 'easeOut',
                      }}
                      onClick={itemHandlers[item.id]}
                      title={item.description}
                      className="group absolute flex h-[74px] w-[108px] select-none flex-col items-center justify-center rounded-[34px] border text-slate-700 transition-all duration-150 hover:scale-[1.02] hover:text-slate-900"
                      style={{
                        background: isActive
                          ? 'linear-gradient(180deg, rgba(245,250,255,0.97), rgba(233,243,252,0.95))'
                          : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))',
                        borderColor: isActive ? 'rgba(94, 173, 220, 0.42)' : 'rgba(148, 163, 184, 0.2)',
                        boxShadow: isActive
                          ? '0 12px 24px rgba(125, 181, 219, 0.14)'
                          : '0 10px 20px rgba(148, 163, 184, 0.1)',
                        left: `${QUICK_MENU_BUTTON_STACK_OFFSET_X + item.translateX}px`,
                        top: `calc(50% + ${item.translateY}px)`,
                        transform: `translateY(-50%) rotate(${item.rotation}deg)`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-[7px] rounded-[26px] border"
                        style={{
                          borderColor: isActive ? 'rgba(120, 188, 228, 0.22)' : 'rgba(148, 163, 184, 0.12)',
                        }}
                      />
                      <div
                        className="pointer-events-none relative z-[1] flex flex-col items-center justify-center"
                        style={{ gap: QUICK_MENU_CONTENT_GAP }}
                      >
                        <Icon
                          className={`${isActive ? 'text-sky-600' : 'text-slate-500'} transition-colors duration-150 group-hover:text-sky-600`}
                          style={{
                            height: QUICK_MENU_ICON_SIZE,
                            width: QUICK_MENU_ICON_SIZE,
                          }}
                        />
                        <span
                          className="font-semibold text-slate-700"
                          style={{
                            fontSize: `${QUICK_MENU_LABEL_FONT_SIZE}px`,
                            letterSpacing: '0.1em',
                            lineHeight: 1,
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

PetQuickActionMenu.displayName = 'PetQuickActionMenu';
