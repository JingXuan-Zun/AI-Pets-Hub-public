import { useMemo } from 'react';
import {
  useDesktopPetSharedState,
} from './desktopShellSharedState';
import { desktopPetShellRuntime } from './desktopShellRuntime';
import type { DesktopPetChatSendOptions } from './chatState';
import type { PetConfig, PetConfigUpdateOptions } from './types';

export function useDesktopPetShellStore() {
  const {
    applyLocalConfigOverride,
    sharedState,
  } = useDesktopPetSharedState();

  return useMemo(() => ({
    ...desktopPetShellRuntime,
    desktopMode: desktopPetShellRuntime.isDesktopMode(),
    updateConfig: (config: PetConfig, options?: PetConfigUpdateOptions & { baseConfig?: PetConfig }) => {
      applyLocalConfigOverride(config);
      desktopPetShellRuntime.dispatch({
        type: 'update-config',
        baseConfig: options?.baseConfig ?? sharedState.config,
        config,
        normalize: options?.normalize,
        persist: options?.persist,
        priority: options?.priority,
      });
    },
    setChatInput: (value: string) =>
      desktopPetShellRuntime.dispatch({ type: 'set-chat-input', value }),
    setChatMode: (mode: typeof sharedState.chatState.chatMode) =>
      desktopPetShellRuntime.dispatch({ type: 'set-chat-mode', mode }),
    deleteStory: (storyId: string) =>
      desktopPetShellRuntime.dispatch({ type: 'delete-story', storyId }),
    setGroupChatContinuationMode: (mode: typeof sharedState.chatState.groupChatContinuationMode) =>
      desktopPetShellRuntime.dispatch({ type: 'set-group-chat-continuation-mode', mode }),
    setActiveChatPet: (petId: string) =>
      desktopPetShellRuntime.dispatch({ type: 'set-active-chat-pet', petId }),
    removePetRuntimeState: (petId: string, fallbackPetId = 'primary') =>
      desktopPetShellRuntime.dispatch({ type: 'remove-pet-runtime-state', petId, fallbackPetId }),
    sendChatMessage: (text?: string, options?: DesktopPetChatSendOptions) =>
      desktopPetShellRuntime.dispatch({
        type: 'send-chat-message',
        text,
        agentMode: options?.agentMode,
        attachments: options?.attachments,
        browserSearchMode: options?.browserSearchMode,
        storyDefinition: options?.storyDefinition,
      }),
    resolveAgentApproval: (messageId: string, decision: 'approve' | 'deny') =>
      desktopPetShellRuntime.dispatch({ type: 'resolve-agent-approval', messageId, decision }),
    resolveGroupUserAttention: (
      decision: import('./chatState').GroupUserAttentionDecision,
      text?: string,
    ) => desktopPetShellRuntime.dispatch({ type: 'resolve-group-user-attention', decision, text }),
    stopAgentRun: (messageId?: string | null) =>
      desktopPetShellRuntime.dispatch({ type: 'stop-agent-run', messageId }),
    stopGroupChat: () =>
      desktopPetShellRuntime.dispatch({ type: 'stop-group-chat' }),
    playChatMessageVoice: (text: string) =>
      desktopPetShellRuntime.dispatch({ type: 'play-chat-message-voice', text }),
    toggleChatVoiceEnabled: () =>
      desktopPetShellRuntime.dispatch({ type: 'toggle-chat-voice-enabled' }),
    toggleChatVoiceInput: () =>
      desktopPetShellRuntime.dispatch({ type: 'toggle-chat-voice-input' }),
    setAction: (action: typeof sharedState.config.currentAction) =>
      desktopPetShellRuntime.dispatch({ type: 'set-action', action }),
    resetFolders: () =>
      desktopPetShellRuntime.dispatch({ type: 'reset-folders' }),
    previewCaptureOptions: (options?: DesktopPetCaptureOptionsLike | null) =>
      desktopPetShellRuntime.dispatch({ type: 'preview-capture-options', options }),
    startScreenCapture: (options?: DesktopPetCaptureOptionsLike) =>
      desktopPetShellRuntime.dispatch({ type: 'start-screen-capture', options }),
    stopScreenCapture: () =>
      desktopPetShellRuntime.dispatch({ type: 'stop-screen-capture' }),
    sharedState,
  }), [applyLocalConfigOverride, sharedState]);
}
