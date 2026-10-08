import type { ReactNode } from 'react';
import { Infinity, RotateCcw, Square } from 'lucide-react';
import { type DesktopPetGroupChatContinuationMode } from '../../chatState';
import { type DesktopPetChatMode, type PetConfig } from '../../types';
import { Button } from '../../../components/ui/button';
import { resolveChatPetAvatarUrl } from './chatAppearanceUtils';
import { type ChatTargetOption } from './multiPetChat';
import type { ChatMessage } from '../../types';
import { GroupChatDynamicsPanel } from './group/orchestration/GroupChatDynamicsPanel';
import { ChatModeSelector } from './ChatModeSelector';
import { ChatSidebarToggleButton } from './ChatSidebarToggleButton';
import { StoryConversationSidebarPanel } from './story/StoryConversationSidebarPanel';
import type { StoryDefinition } from './story/storyTypes';

interface PetChatConversationHeaderProps {
  activePetId: string;
  activeStoryDefinition: StoryDefinition | null;
  chatMode: DesktopPetChatMode;
  config: PetConfig;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  isTargetSelectorCollapsed: boolean;
  isGroupChatRunning: boolean;
  messages: ChatMessage[];
  onActivePetChange: (petId: string) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onCreateStory: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onStopGroupChat: () => void;
  onTargetSelectorCollapsedChange: (isCollapsed: boolean) => void;
  onViewStory: () => void;
  petOptions: ChatTargetOption[];
  showSidebarToggle?: boolean;
  /** Rendered under the private-chat role list. */
  memoryProposalPanel?: ReactNode;
  pendingMemoryProposalCountByPetId?: Record<string, number>;
}

const TARGET_BUTTON_CLASS = 'h-10 w-full justify-start rounded-full border px-2.5 text-[10px] tracking-[0.08em]';
const GROUP_MODE_BUTTON_CLASS = 'h-8 w-full justify-start rounded-full border px-3 text-[10px] tracking-[0.1em]';
const ACTIVE_BUTTON_CLASS = '!border-primary !bg-primary !text-white';
const INACTIVE_BUTTON_CLASS = '!border-white/80 !bg-white/60 !text-sky-950 hover:!bg-white/85';

function resolveTargetAvatarFallback(name: string) {
  return name.trim().slice(0, 1) || '宠';
}

function ChatTargetAvatar({
  isActive,
  name,
  petId,
  config,
}: {
  isActive: boolean;
  name: string;
  petId: string;
  config: PetConfig;
}) {
  const avatarUrl = resolveChatPetAvatarUrl(config, petId);
  const fallbackText = resolveTargetAvatarFallback(name);
  const avatarClassName = `flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-semibold ${
    isActive
      ? 'border-white/40 bg-white/15 text-white'
      : 'border-sky-100 bg-sky-50 text-sky-800'
  }`;

  return (
    <span className={avatarClassName} aria-hidden="true">
      {avatarUrl ? (
        <img alt="" src={avatarUrl} className="size-full object-cover" draggable={false} />
      ) : (
        fallbackText
      )}
    </span>
  );
}

export function PetChatConversationHeader({
  activePetId,
  activeStoryDefinition,
  chatMode,
  config,
  groupChatContinuationMode,
  isTargetSelectorCollapsed,
  isGroupChatRunning,
  messages,
  onActivePetChange,
  onChatModeChange,
  onCreateStory,
  onGroupChatContinuationModeChange,
  onStopGroupChat,
  onTargetSelectorCollapsedChange,
  onViewStory,
  petOptions,
  showSidebarToggle = true,
  memoryProposalPanel,
  pendingMemoryProposalCountByPetId = {},
}: PetChatConversationHeaderProps) {
  if (isTargetSelectorCollapsed) {
    if (!showSidebarToggle) return null;
    return (
      <ChatSidebarToggleButton
        isCollapsed
        onToggle={() => onTargetSelectorCollapsedChange(false)}
        className="absolute left-3 top-3 z-30 rounded-lg border border-white/70 glass-bar shadow-[0_6px_18px_rgba(158,84,140,0.16)]"
      />
    );
  }

  return (
    <aside className="relative my-3 ml-3 flex h-[calc(100%-1.5rem)] w-[190px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/70 glass-bar shadow-[0_10px_30px_rgba(158,84,140,0.12)] px-3 py-3 text-sky-950">
      {showSidebarToggle ? (
        <ChatSidebarToggleButton
          isCollapsed={false}
          onToggle={() => onTargetSelectorCollapsedChange(true)}
          tooltipAlign="right"
          className="absolute right-2 top-2 z-10"
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 pr-1">
        <ChatModeSelector chatMode={chatMode} onChange={onChatModeChange} />

        {chatMode === 'single' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 shrink space-y-2 overflow-y-auto pr-1">
            {petOptions.map((option) => (
              (() => {
                const isActive = option.id === activePetId;

                return (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => onActivePetChange(option.id)}
                    className={`${TARGET_BUTTON_CLASS} ${isActive ? ACTIVE_BUTTON_CLASS : INACTIVE_BUTTON_CLASS}`}
                  >
                    <ChatTargetAvatar
                      config={config}
                      isActive={isActive}
                      name={option.name}
                      petId={option.id}
                    />
                    <span className="min-w-0 flex-1 truncate text-center">{option.name}</span>
                    {pendingMemoryProposalCountByPetId[option.id] ? (
                      <span
                        aria-label={`${pendingMemoryProposalCountByPetId[option.id]} 条记忆提议`}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-white' : 'bg-primary'}`}
                      />
                    ) : null}
                  </Button>
                );
              })()
            ))}
          </div>
          {memoryProposalPanel}
          </div>
        ) : chatMode === 'group' ? (
          <div className="min-h-0 space-y-3 overflow-y-auto pr-1 text-[10px] leading-relaxed text-sky-800">
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant={groupChatContinuationMode === 'single-round' ? 'default' : 'outline'}
                onClick={() => onGroupChatContinuationModeChange('single-round')}
                className={`${GROUP_MODE_BUTTON_CLASS} ${
                  groupChatContinuationMode === 'single-round' ? ACTIVE_BUTTON_CLASS : INACTIVE_BUTTON_CLASS
                }`}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                一轮群聊
              </Button>
              <Button
                type="button"
                size="sm"
                variant={groupChatContinuationMode === 'infinite' ? 'default' : 'outline'}
                onClick={() => onGroupChatContinuationModeChange('infinite')}
                className={`${GROUP_MODE_BUTTON_CLASS} ${
                  groupChatContinuationMode === 'infinite' ? ACTIVE_BUTTON_CLASS : INACTIVE_BUTTON_CLASS
                }`}
              >
                <Infinity className="mr-1 h-3 w-3" />
                无限群聊
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isGroupChatRunning ? 'default' : 'outline'}
                onClick={onStopGroupChat}
                disabled={!isGroupChatRunning}
                className={`${GROUP_MODE_BUTTON_CLASS} ${
                  isGroupChatRunning ? ACTIVE_BUTTON_CLASS : INACTIVE_BUTTON_CLASS
                }`}
              >
                <Square className="mr-1 h-2.5 w-2.5" />
                停止
              </Button>
            </div>
            <div className="rounded-md border border-sky-100 bg-sky-50/50 px-2.5 py-2 text-sky-700">
              <div className="font-semibold text-sky-950">群聊成员</div>
              <div className="mt-1">{petOptions.map((option) => option.name).join('、')}</div>
            </div>
            <GroupChatDynamicsPanel
              config={config}
              isGroupChatRunning={isGroupChatRunning}
              messages={messages}
              petOptions={petOptions}
            />
            <div className="px-1">
              {groupChatContinuationMode === 'infinite'
                ? (isGroupChatRunning ? '当前是无限群聊，角色会持续接话，直到手动停止。' : '当前是无限群聊，发送消息后会持续接话。')
                : '当前是一轮群聊，发送消息后只完成这一轮回复。'}
            </div>
          </div>
        ) : (
          <StoryConversationSidebarPanel
            definition={activeStoryDefinition}
            onCreateStory={onCreateStory}
            onViewStory={onViewStory}
            participantNames={petOptions.map((option) => option.name)}
          />
        )}
      </div>
    </aside>
  );
}
