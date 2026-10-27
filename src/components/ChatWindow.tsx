import { useEffect, useState, type ComponentProps, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { listNeuralMemoryProposals } from '../neural-memory/neuralMemoryProposalConfig';
import { BookOpen, Volume2, VolumeX } from 'lucide-react';
import { getChatTargetOptions, resolveActiveChatPetId, resolveActiveChatSlot } from './chat/multiPetChat';
import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode, type GroupUserAttention, type GroupUserAttentionDecision } from '../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig, type PetConfigUpdateHandler } from '../types';
import { Button } from '../../components/ui/button';
import { type ChatMemorySaveHandler } from './chat/chatMemorySaveUtils';
import type { StoryDefinition, StorySessionState } from './chat/story/storyTypes';
import PetChatConversation from './chat/PetChatConversation';
import { ChatSidebarToggleButton } from './chat/ChatSidebarToggleButton';
import { StandaloneWindowResizeHandles } from './StandaloneWindowResizeHandles';
import { WindowFrameControls } from './WindowFrameControls';
import { useStandaloneWindowResize } from '../standaloneWindowResize';
import { useStandaloneWindowDrag } from '../standaloneWindowDrag';
import { useStandaloneWindowFrame } from '../standaloneWindowFrame';
import {
  buildChatBackgroundImageStyle,
  buildChatBackgroundOverlayStyle,
  resolveChatBackgroundImageUrl,
} from './chat/chatAppearanceUtils';
import { resolveUiGlassStyle } from '../chatAppearanceSettings';
import { ChatHubNav, type ChatHubNavId } from './chat/hub/ChatHubNav';
import { ChatHubInfoColumn, type ChatHubQuickActionId } from './chat/hub/ChatHubInfoColumn';
import { ChatHubRolesPage } from './chat/hub/ChatHubPages';
import { ChatHubTasksPage } from './chat/hub/ChatHubTasksPage';
import { normalizeProductivitySettings } from '../productivity/productivitySettings';
import { HubAvatar } from './chat/hub/chatHubShared';
import {
  ChatHubMemoryPage,
  ChatHubOutfitPage,
  ChatHubPluginsPage,
  ChatHubQuickSettingsPage,
} from './chat/hub/ChatHubSettingsPages';
import { openSettingsPage } from './chat/hub/settingsPageRequest';
import { InteractiveDialogueView } from './chat/interactive/InteractiveDialogueView';

interface ChatWindowProps {
  activePetId: string;
  chatMode: DesktopPetChatMode;
  config: PetConfig;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupUserAttention: GroupUserAttention | null;
  inputValue: string;
  interactiveDialogueActive?: boolean;
  isGroupChatRunning: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  storyLibrary?: StoryDefinition[];
  storySession?: StorySessionState | null;
  onDeleteStory?: (storyId: string) => void;
  speakingPetId?: string | null;
  statusMessage: string;
  typingPetId?: string | null;
  onUpdateConfig?: PetConfigUpdateHandler;
  onClose: () => void;
  onActivePetChange: (petId: string) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onInputChange: (value: string) => void;
  onPlayMessageVoice: (text: string) => void;
  onResolveAgentApproval: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onResolveGroupUserAttention: (decision: GroupUserAttentionDecision, text?: string) => void | Promise<void>;
  onSaveMessageToMemory?: ChatMemorySaveHandler;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void;
  onStopAgentRun: (messageId?: string | null) => void;
  onStopGroupChat: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onToggleVoiceEnabled: () => void;
  onToggleVoiceInput: () => void;
}

const VOICE_DISABLE_TITLE = '\u5173\u95ed\u8bed\u97f3\u64ad\u62a5';
const VOICE_ENABLE_TITLE = '\u5f00\u542f\u8bed\u97f3\u64ad\u62a5';
const CHAT_WINDOW_MINIMIZE_TITLE = '最小化';
const CHAT_WINDOW_CLOSE_TITLE = '关闭聊天窗口';
/** 窗口窄于这些宽度时，Hub 依次收起右侧信息栏、把左侧导航缩成图标。 */
const HUB_INFO_COLUMN_MIN_WIDTH = 1100;
const HUB_FULL_NAV_MIN_WIDTH = 980;

export type ChatHubPage = 'chat' | 'roles' | 'tasks' | 'memory' | 'plugins' | 'settings' | 'outfit';

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

export default function ChatWindow({
  activePetId,
  chatMode,
  config,
  groupChatContinuationMode,
  groupUserAttention,
  inputValue,
  interactiveDialogueActive = false,
  isGroupChatRunning,
  isListening,
  isSpeaking,
  isTyping,
  messages,
  storyLibrary,
  storySession,
  onDeleteStory,
  speakingPetId = null,
  statusMessage,
  typingPetId = null,
  onUpdateConfig,
  onClose,
  onActivePetChange,
  onChatModeChange,
  onInputChange,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onResolveGroupUserAttention,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  onStopGroupChat,
  onGroupChatContinuationModeChange,
  onToggleVoiceEnabled,
  onToggleVoiceInput,
}: ChatWindowProps) {
  const isInteractiveDialogue = interactiveDialogueActive && chatMode === 'single';
  const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;
  const { isResizing, startWindowResize } = useStandaloneWindowResize({
    enabled: true,
    maxHeight: 1248,
    minHeight: isInteractiveDialogue ? 600 : 480,
    minWidth: isInteractiveDialogue ? 560 : 360,
  });
  const { isMaximized, minimizeWindow, toggleMaximizeWindow } = useStandaloneWindowFrame({ enabled: true });
  const { isDragging, startWindowDrag } = useStandaloneWindowDrag({ enabled: true, isMaximized });
  const petOptions = getChatTargetOptions(config);
  const resolvedActivePetId = resolveActiveChatPetId(config, activePetId);
  const activePetSlot = resolveActiveChatSlot(config, resolvedActivePetId);
  const activePetName = petOptions.find((option) => option.id === resolvedActivePetId)?.name
    ?? config.personality.name;
  const activeGreeting = activePetSlot?.personality.greeting ?? config.personality.greeting;
  const typingPetName = petOptions.find((option) => option.id === typingPetId)?.name ?? activePetName;
  const chatScrollPositionKey = `standalone:${chatMode}`;
  // 私聊时角色列表由 Hub 的「角色」页负责，侧栏默认收起；群聊/故事需要侧栏里的控制项。
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(chatMode === 'single');
  useEffect(() => {
    setIsSidebarCollapsed(chatMode === 'single');
  }, [chatMode]);
  const [hubPage, setHubPage] = useState<ChatHubPage>('chat');
  const windowWidth = useWindowWidth();
  const chatBackgroundImageUrl = resolveChatBackgroundImageUrl(config);
  const uiGlassStyle = resolveUiGlassStyle(config.settings.uiGlassTransparency) as CSSProperties;
  const conversationProps: ComponentProps<typeof PetChatConversation> = {
    className: 'relative min-h-0 flex-1',
    hoistBackground: true,
    activePetId: resolvedActivePetId,
    chatBracketOuterTextColor: config.settings.chatBracketOuterTextColor,
    chatMode,
    config,
    greeting: activeGreeting,
    groupChatContinuationMode,
    groupUserAttention,
    inputValue,
    isGroupChatRunning,
    isListening,
    isSpeaking,
    isTyping,
    messages,
    storyLibrary,
    storySession,
    onDeleteStory,
    onUpdateConfig,
    onActivePetChange,
    onChatModeChange,
    onInputChange,
    onPlayMessageVoice,
    onResolveAgentApproval,
    onResolveGroupUserAttention,
    onSaveMessageToMemory,
    onSendMessage,
    onStopAgentRun,
    onStopGroupChat,
    onGroupChatContinuationModeChange,
    speakingPetId,
    onToggleVoiceInput,
    petOptions,
    showStatusMessage: true,
    statusMessage,
    typingPetName,
    voiceInputEnabled: config.settings.voiceInputEnabled,
    scrollPositionKey: chatScrollPositionKey,
    sidebarCollapsed: isSidebarCollapsed,
    onSidebarCollapsedChange: setIsSidebarCollapsed,
    hideModeSelector: true,
  };
  const backgroundLayer = chatBackgroundImageUrl ? (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
      <img
        alt=""
        src={chatBackgroundImageUrl}
        className="h-full w-full rounded-[inherit] object-cover"
        draggable={false}
        style={buildChatBackgroundImageStyle(config)}
      />
      <div className="absolute inset-0 rounded-[inherit]" style={buildChatBackgroundOverlayStyle(config)} />
    </div>
  ) : null;

  // Hub 里除聊天以外的页面；互动对话里从角色右键菜单打开同样的页面。
  const renderHubPage = (page: Exclude<ChatHubPage, 'chat'>, onDone: () => void): ReactNode => {
    switch (page) {
      case 'roles':
        return (
          <ChatHubRolesPage
            activePetId={resolvedActivePetId}
            config={config}
            petOptions={petOptions}
            onChooseRole={(petId) => {
              onActivePetChange(petId);
              onChatModeChange('single');
              onDone();
            }}
            onEditRoles={() => openSettingsPage('desktop-role')}
          />
        );
      case 'tasks':
        return onUpdateConfig ? <ChatHubTasksPage config={config} onUpdateConfig={onUpdateConfig} /> : null;
      case 'memory':
        return activePetSlot && onUpdateConfig ? <ChatHubMemoryPage config={config} slot={activePetSlot} onUpdateConfig={onUpdateConfig} /> : null;
      case 'outfit':
        return activePetSlot && onUpdateConfig ? <ChatHubOutfitPage config={config} slot={activePetSlot} onUpdateConfig={onUpdateConfig} /> : null;
      case 'plugins':
        return <ChatHubPluginsPage currentPetId={resolvedActivePetId} />;
      case 'settings':
        return onUpdateConfig ? <ChatHubQuickSettingsPage config={config} onUpdateConfig={onUpdateConfig} /> : null;
      default:
        return null;
    }
  };

  if (!isInteractiveDialogue) {
    const navActiveId: ChatHubNavId = hubPage === 'chat'
      ? (chatMode === 'group' ? 'group' : 'chat')
      : hubPage === 'outfit' ? 'roles' : hubPage;
    const selectNav = (id: ChatHubNavId) => {
      switch (id) {
        case 'chat':
        case 'group':
          setHubPage('chat');
          onChatModeChange(id === 'group' ? 'group' : 'single');
          return;
        default:
          // 角色/记忆/任务/插件/设置都在 Hub 里打开；完整设置只在页面里点「高级设置」才打开。
          setHubPage(id);
      }
    };
    const runQuickAction = (id: ChatHubQuickActionId) => {
      if (id === 'voice') onToggleVoiceEnabled();
      else setHubPage(id);
    };
    const hubPageContent = hubPage === 'chat' ? null : renderHubPage(hubPage, () => setHubPage('chat'));
    const panelTitle = chatMode === 'group' ? '群聊' : chatMode === 'story' ? '故事' : activePetName;
    const panelSubtitle = chatMode === 'group'
      ? `${petOptions.length} 位角色在群里`
      : chatMode === 'story'
        ? '和角色一起推进剧情'
        : (isTyping ? '正在输入…' : '在线');
    const isWidePanel = chatMode !== 'single' && !isSidebarCollapsed;
    // 导航、卡片头部、右栏和各块之间的空隙都能拖动窗口（按钮/输入框会被拖动逻辑自动忽略）；
    // 消息区不参与，避免选中文字时窗口跟着跑。
    const dragProps = {
      onPointerDown: startWindowDrag,
      onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
        if (!(event.target as HTMLElement).closest('button, input, textarea, select')) toggleMaximizeWindow();
      },
    };
    const gapDragProps = {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) startWindowDrag(event);
      },
      onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) toggleMaximizeWindow();
      },
    };

    return (
      <div style={uiGlassStyle} className={`relative flex h-screen w-screen min-h-0 overflow-hidden ${isMaximized ? 'rounded-none' : 'rounded-[10px]'} border border-white/70 app-shell-canvas text-foreground ${isResizing || isDragging ? 'select-none' : ''}`}>
        {backgroundLayer}
        <ChatHubNav
          activeId={navActiveId}
          activeSlot={activePetSlot ?? null}
          activePetName={activePetName}
          badges={{
            memory: listNeuralMemoryProposals(config, activePetSlot?.id).length,
            tasks: normalizeProductivitySettings(config.settings.productivity).todos.filter((item) => !item.done).length,
          }}
          compact={windowWidth < HUB_FULL_NAV_MIN_WIDTH}
          onSelect={selectNav}
          onStartWindowDrag={startWindowDrag}
          onToggleMaximize={toggleMaximizeWindow}
        />
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 gap-4 p-5" {...gapDragProps}>
          <div className={`flex min-h-0 min-w-0 shrink-0 flex-col ${isWidePanel ? 'w-[clamp(480px,62%,820px)]' : 'w-[clamp(420px,48%,600px)]'}`}>
            {hubPageContent ?? (
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/80 hub-glass-panel shadow-[0_18px_48px_rgba(158,84,140,0.16)]">
                <header className="flex shrink-0 items-center gap-3 border-b border-white/70 px-5 py-3.5" {...dragProps}>
                  <HubAvatar
                    slot={chatMode === 'single' ? activePetSlot ?? null : null}
                    name={panelTitle}
                    className="h-11 w-11 text-base ring-2 ring-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-foreground">{panelTitle}</div>
                    <div className="truncate text-xs text-muted-foreground">{panelSubtitle}</div>
                  </div>
                  <ChatSidebarToggleButton
                    isCollapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="relative"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onChatModeChange(chatMode === 'story' ? 'single' : 'story')}
                    className={`h-8 w-8 rounded-full ${chatMode === 'story' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'} hover:bg-white/70 hover:text-foreground`}
                    title={chatMode === 'story' ? '退出故事模式' : '故事模式'}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleVoiceEnabled}
                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-white/70 hover:text-foreground"
                    title={config.settings.voiceEnabled ? VOICE_DISABLE_TITLE : VOICE_ENABLE_TITLE}
                  >
                    {config.settings.voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                </header>
                <PetChatConversation {...conversationProps} />
              </section>
            )}
          </div>
          {/* 中间留空露出角色立绘，同时作为窗口拖动区 */}
          <div className="min-w-0 flex-1" {...dragProps} />
          {windowWidth >= HUB_INFO_COLUMN_MIN_WIDTH ? (
            <div className="flex min-h-0 flex-col pt-8" {...dragProps}>
              <ChatHubInfoColumn
                activeSlot={activePetSlot ?? null}
                chatMode={chatMode}
                voiceEnabled={config.settings.voiceEnabled}
                onQuickAction={runQuickAction}
              />
            </div>
          ) : null}
        </div>
        <div className="absolute right-4 top-1.5 z-20" style={noDragRegionStyle}>
          <WindowFrameControls
            closeTitle={CHAT_WINDOW_CLOSE_TITLE}
            minimizeTitle={CHAT_WINDOW_MINIMIZE_TITLE}
            onClose={onClose}
            onMinimize={minimizeWindow}
            isMaximized={isMaximized}
            onToggleMaximize={toggleMaximizeWindow}
          />
        </div>
        <StandaloneWindowResizeHandles onStartResize={startWindowResize} />
      </div>
    );
  }

  return (
    <InteractiveDialogueView
      activePetId={resolvedActivePetId}
      activePetName={activePetName}
      activePetSlot={activePetSlot ?? null}
      petOptions={petOptions}
      onChooseRole={(petId) => {
        onActivePetChange(petId);
        onChatModeChange('single');
      }}
      backgroundLayer={backgroundLayer}
      config={config}
      conversationProps={conversationProps}
      isDragging={isDragging}
      isMaximized={isMaximized}
      isResizing={isResizing}
      isTyping={isTyping}
      renderHubPage={renderHubPage}
      resizeHandles={<StandaloneWindowResizeHandles onStartResize={startWindowResize} />}
      style={uiGlassStyle}
      onHangUp={onClose}
      onMinimize={minimizeWindow}
      onStartWindowDrag={startWindowDrag}
      onToggleMaximize={toggleMaximizeWindow}
      onToggleVoiceEnabled={onToggleVoiceEnabled}
    />
  );
}
