import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DESKTOP_PET_CHAT_STATE, type DesktopPetChatSendOptions, type DesktopPetChatState, type GroupUserAttentionDecision } from './chatState';
import { DEFAULT_CONFIG } from './constants';
import { normalizePetConfig } from './petConfigNormalization';
import { desktopPetShellRuntime } from './desktopShellRuntime';
import { cloneCaptureOptions } from './services/desktopCapture';
import type { ChatAgentApprovalDecision, PetAction, PetConfig, PetConfigUpdateOptions, PetVisualSize } from './types';

export type DesktopPetSharedState = {
  chatState: DesktopPetChatState;
  config: PetConfig;
  interactiveDialogueActive: boolean;
  logs: string[];
  petVisualSize: PetVisualSize | null;
  screenCaptureActive: boolean;
  screenCaptureOptions: DesktopPetCaptureOptionsLike | null;
};

export type DesktopPetSettingsAction =
  | ({ type: 'update-config'; baseConfig?: PetConfig; config: PetConfig } & PetConfigUpdateOptions)
  | { type: 'set-chat-input'; value: string }
  | { type: 'set-chat-mode'; mode: DesktopPetChatState['chatMode'] }
  | { type: 'delete-story'; storyId: string }
  | { type: 'set-group-chat-continuation-mode'; mode: DesktopPetChatState['groupChatContinuationMode'] }
  | { type: 'set-active-chat-pet'; petId: string }
  | { type: 'remove-pet-runtime-state'; fallbackPetId?: string; petId: string }
  | ({ type: 'send-chat-message'; text?: string } & DesktopPetChatSendOptions)
  | { type: 'resolve-agent-approval'; decision: ChatAgentApprovalDecision; messageId: string }
  | { type: 'resolve-group-user-attention'; decision: GroupUserAttentionDecision; text?: string }
  | { type: 'stop-agent-run'; messageId?: string | null }
  | { type: 'stop-group-chat' }
  | { type: 'play-chat-message-voice'; text: string }
  | { type: 'toggle-chat-voice-enabled' }
  | { type: 'toggle-chat-voice-input' }
  | { type: 'set-action'; action: PetAction }
  | { type: 'reset-folders' }
  | { type: 'preview-capture-options'; options?: DesktopPetCaptureOptionsLike | null }
  | { type: 'start-screen-capture'; options?: DesktopPetCaptureOptionsLike }
  | { type: 'stop-screen-capture' };

const DEFAULT_SHARED_STATE: DesktopPetSharedState = {
  chatState: DEFAULT_DESKTOP_PET_CHAT_STATE,
  config: DEFAULT_CONFIG,
  interactiveDialogueActive: false,
  logs: [],
  petVisualSize: null,
  screenCaptureActive: false,
  screenCaptureOptions: null,
};

// How long a local config override suppresses shared-state pushes after a
// window submits a change. Kept generous so a busy main process (screen
// capture, MCP spawn) cannot beat the IPC round-trip and make the panel
// visually revert to the stale config. A versioned ack protocol would
// eliminate this window entirely; that is a follow-up.
const LOCAL_CONFIG_OVERRIDE_TTL_MS = 5000;

function resolveSharedPetVisualSize(value: unknown): PetVisualSize | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const nextValue = value as Partial<PetVisualSize>;
  const width = Number(nextValue.width);
  const height = Number(nextValue.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

function resolveSharedCaptureOptions(value: unknown): DesktopPetCaptureOptionsLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return cloneCaptureOptions(value as DesktopPetCaptureOptionsLike);
}

export function useDesktopPetSharedState() {
  const [sharedState, setSharedState] = useState<DesktopPetSharedState>(DEFAULT_SHARED_STATE);
  const localConfigOverrideRef = useRef<{
    config: PetConfig;
    expiresAt: number;
  } | null>(null);

  const normalizeSharedState = useCallback((state: Partial<DesktopPetSharedState>) => {
    const normalizedConfig = normalizePetConfig(state.config);
    const localConfigOverride = localConfigOverrideRef.current;
    const shouldUseLocalConfigOverride = (
      localConfigOverride
      && Date.now() < localConfigOverride.expiresAt
    );

    const screenCaptureActive = Boolean(state.screenCaptureActive);

    return {
      chatState: {
        ...DEFAULT_DESKTOP_PET_CHAT_STATE,
        ...(state.chatState ?? {}),
        messages: Array.isArray(state.chatState?.messages) ? state.chatState.messages : [],
        storyLibrary: Array.isArray(state.chatState?.storyLibrary) ? state.chatState.storyLibrary : [],
      },
      config: shouldUseLocalConfigOverride ? localConfigOverride.config : normalizedConfig,
      interactiveDialogueActive: Boolean(state.interactiveDialogueActive),
      logs: Array.isArray(state.logs) ? state.logs : [],
      petVisualSize: resolveSharedPetVisualSize(state.petVisualSize),
      screenCaptureActive,
      screenCaptureOptions: screenCaptureActive
        ? resolveSharedCaptureOptions(state.screenCaptureOptions)
        : null,
    } satisfies DesktopPetSharedState;
  }, []);

  const applyLocalConfigOverride = useCallback((config: PetConfig) => {
    const normalizedConfig = normalizePetConfig(config);

    localConfigOverrideRef.current = {
      config: normalizedConfig,
      expiresAt: Date.now() + LOCAL_CONFIG_OVERRIDE_TTL_MS,
    };

    setSharedState((currentState) => ({
      ...currentState,
      config: normalizedConfig,
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;

    desktopPetShellRuntime.getSharedState()
      .then((state) => {
        if (!isMounted || !state || typeof state !== 'object') {
          return;
        }

        const nextState = state as Partial<DesktopPetSharedState>;
        if (!nextState.config) {
          return;
        }

        setSharedState(normalizeSharedState(nextState));
      })
      .catch(() => {});

    const unsubscribe = desktopPetShellRuntime.onSharedState((state) => {
      if (!state || typeof state !== 'object') {
        return;
      }

      const nextState = state as Partial<DesktopPetSharedState>;
      if (!nextState.config) {
        return;
      }

      setSharedState(normalizeSharedState(nextState));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [normalizeSharedState]);

  return {
    applyLocalConfigOverride,
    sharedState,
  };
}
