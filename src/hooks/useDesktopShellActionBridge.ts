import { useEffect, useRef, type MutableRefObject } from 'react';
import { type DesktopPetChatController } from '../chatState';
import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type DesktopPetSettingsAction } from '../desktopShellSharedState';
import { normalizePetConfig } from '../petConfigNormalization';
import { mergePetConfigUpdateFromBase } from '../petConfigUpdateMerge';
import { type PetAction, type PetConfig, type PetConfigUpdateHandler } from '../types';

interface DesktopShellActionHandlers {
  onPreviewCaptureOptionsChange: (options?: DesktopPetCaptureOptionsLike | null) => void;
  onRequestSharedStateSync: (preferredDelayMs?: number) => void;
  onResetFolders: () => void;
  onSetAction: (action: PetAction) => void;
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  onStopScreenCapture: () => Promise<void> | void;
  onUpdateConfig: PetConfigUpdateHandler;
  getCurrentConfig: () => PetConfig;
}

interface UseDesktopShellActionBridgeOptions extends DesktopShellActionHandlers {
  chatControllerRef: MutableRefObject<DesktopPetChatController | null>;
  isDesktopShell: boolean;
}

export function useDesktopShellActionBridge({
  chatControllerRef,
  isDesktopShell,
  onPreviewCaptureOptionsChange,
  onRequestSharedStateSync,
  onResetFolders,
  onSetAction,
  onStartScreenCapture,
  onStopScreenCapture,
  onUpdateConfig,
  getCurrentConfig,
}: UseDesktopShellActionBridgeOptions) {
  const actionHandlersRef = useRef<DesktopShellActionHandlers>({
    getCurrentConfig,
    onPreviewCaptureOptionsChange,
    onRequestSharedStateSync,
    onResetFolders,
    onSetAction,
    onStartScreenCapture,
    onStopScreenCapture,
    onUpdateConfig,
  });

  useEffect(() => {
    actionHandlersRef.current = {
      getCurrentConfig,
      onPreviewCaptureOptionsChange,
      onRequestSharedStateSync,
      onResetFolders,
      onSetAction,
      onStartScreenCapture,
      onStopScreenCapture,
      onUpdateConfig,
    };
  }, [
    onPreviewCaptureOptionsChange,
    onRequestSharedStateSync,
    onResetFolders,
    onSetAction,
    onStartScreenCapture,
    onStopScreenCapture,
    onUpdateConfig,
    getCurrentConfig,
  ]);

  useEffect(() => {
    if (!isDesktopShell) {
      return undefined;
    }

    return desktopPetShellRuntime.onAction((rawAction) => {
      if (!rawAction || typeof rawAction !== 'object') {
        return;
      }

      const action = rawAction as DesktopPetSettingsAction;
      const handlers = actionHandlersRef.current;

      switch (action.type) {
        case 'update-config': {
          const nextConfig = action.baseConfig
            ? normalizePetConfig(mergePetConfigUpdateFromBase(action.baseConfig, action.config, handlers.getCurrentConfig()))
            : action.config;

          handlers.onUpdateConfig(nextConfig, {
            normalize: action.normalize,
            persist: action.persist,
            priority: action.priority,
          });
          break;
        }
        case 'set-chat-input':
          desktopPetChatStore.setInputValue(action.value);
          break;
        case 'set-chat-mode':
          chatControllerRef.current?.setChatMode(action.mode);
          break;
        case 'delete-story':
          desktopPetChatStore.deleteStory(action.storyId);
          break;
        case 'set-group-chat-continuation-mode':
          chatControllerRef.current?.setGroupChatContinuationMode(action.mode);
          break;
        case 'set-active-chat-pet':
          chatControllerRef.current?.setActivePetId(action.petId);
          break;
        case 'remove-pet-runtime-state':
          desktopPetChatStore.removePetRuntimeState(action.petId, action.fallbackPetId);
          chatControllerRef.current?.setActivePetId(action.fallbackPetId ?? 'primary');
          break;
        case 'send-chat-message':
          void chatControllerRef.current?.sendMessage(action.text, {
            agentMode: action.agentMode,
            attachments: action.attachments,
            browserSearchMode: action.browserSearchMode
              ?? (action.text?.trim().startsWith('/browser') ? 'force' : 'allow'),
            storyDefinition: action.storyDefinition,
          });
          window.setTimeout(() => {
            handlers.onRequestSharedStateSync(0);
          }, 0);
          break;
        case 'resolve-agent-approval':
          void chatControllerRef.current?.resolveAgentApproval(action.messageId, action.decision);
          break;
        case 'resolve-group-user-attention':
          void chatControllerRef.current?.resolveGroupUserAttention(action.decision, action.text);
          break;
        case 'stop-agent-run':
          chatControllerRef.current?.stopAgentRun(action.messageId);
          break;
        case 'stop-group-chat':
          chatControllerRef.current?.stopGroupChat();
          break;
        case 'play-chat-message-voice':
          void chatControllerRef.current?.playMessageVoice(action.text);
          break;
        case 'toggle-chat-voice-enabled':
          chatControllerRef.current?.toggleVoiceEnabled();
          break;
        case 'toggle-chat-voice-input':
          chatControllerRef.current?.toggleVoiceInput();
          break;
        case 'set-action':
          handlers.onSetAction(action.action);
          break;
        case 'reset-folders':
          handlers.onResetFolders();
          break;
        case 'preview-capture-options':
          handlers.onPreviewCaptureOptionsChange(action.options);
          break;
        case 'start-screen-capture':
          void handlers.onStartScreenCapture(action.options);
          break;
        case 'stop-screen-capture':
          handlers.onStopScreenCapture();
          break;
        default:
          break;
      }
    });
  }, [chatControllerRef, isDesktopShell]);
}
