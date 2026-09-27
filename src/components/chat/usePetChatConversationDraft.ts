import { useCallback, useEffect, useRef, useState } from 'react';
import { type DesktopPetChatSendOptions } from '../../chatState';
import { type ChatMessageImageAttachment } from '../../types';
import { MAX_CHAT_IMAGE_ATTACHMENTS } from './chatImageAttachmentUtils';

type BrowserSearchMode = 'allow' | 'block' | 'force';
type ChatDraftSendOptions = {
  agentMode?: boolean;
  browserSearchMode?: BrowserSearchMode;
};

const CHAT_DRAFT_LOCAL_SYNC_GUARD_MS = 1800;
const CHAT_DRAFT_DUPLICATE_SEND_GUARD_MS = 300;
const EXTERNAL_AGENT_INPUT_PATTERN = /^\/\s*agent(?:\s+|$)/iu;

function resolveExternalAgentInput(value: string) {
  const match = value.match(EXTERNAL_AGENT_INPUT_PATTERN);
  if (!match) {
    return null;
  }

  return value.slice(match[0].length);
}

export function resolveChatDraftExternalInputSync({
  inputValue,
  now,
  pendingDraftValue,
  pendingDraftValueExpiresAt,
}: {
  inputValue: string;
  now: number;
  pendingDraftValue: string | null;
  pendingDraftValueExpiresAt: number;
}) {
  if (pendingDraftValue !== null) {
    if (inputValue === pendingDraftValue) {
      return {
        nextPendingDraftValue: null,
        nextPendingDraftValueExpiresAt: 0,
        shouldApplyInputValue: true,
      };
    }

    if (now < pendingDraftValueExpiresAt) {
      return {
        nextPendingDraftValue: pendingDraftValue,
        nextPendingDraftValueExpiresAt: pendingDraftValueExpiresAt,
        shouldApplyInputValue: false,
      };
    }
  }

  return {
    nextPendingDraftValue: null,
    nextPendingDraftValueExpiresAt: 0,
    shouldApplyInputValue: true,
  };
}

interface UsePetChatConversationDraftOptions {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
}

export function usePetChatConversationDraft({
  inputValue,
  onInputChange,
  onSendMessage,
}: UsePetChatConversationDraftOptions) {
  const inputSyncFrameRef = useRef<number | null>(null);
  const pendingDraftValueRef = useRef<string | null>(null);
  const pendingDraftValueExpiresAtRef = useRef(0);
  const lastSendAtRef = useRef(0);
  const [draftValue, setDraftValue] = useState(inputValue);
  const [draftAttachments, setDraftAttachments] = useState<ChatMessageImageAttachment[]>([]);
  const [agentMode, setAgentMode] = useState(false);
  const [browserSearchMode, setBrowserSearchMode] = useState<BrowserSearchMode | null>(null);

  const markPendingDraftValue = useCallback((nextValue: string) => {
    pendingDraftValueRef.current = nextValue;
    pendingDraftValueExpiresAtRef.current = Date.now() + CHAT_DRAFT_LOCAL_SYNC_GUARD_MS;
  }, []);

  const commitInputValue = useCallback((nextValue: string) => {
    markPendingDraftValue(nextValue);
    onInputChange(nextValue);
  }, [markPendingDraftValue, onInputChange]);

  useEffect(() => {
    const pendingDraftValue = pendingDraftValueRef.current;
    const syncDecision = resolveChatDraftExternalInputSync({
      inputValue,
      now: Date.now(),
      pendingDraftValue,
      pendingDraftValueExpiresAt: pendingDraftValueExpiresAtRef.current,
    });
    const isLocalDraftSync = pendingDraftValue !== null && inputValue === pendingDraftValue;

    pendingDraftValueRef.current = syncDecision.nextPendingDraftValue;
    pendingDraftValueExpiresAtRef.current = syncDecision.nextPendingDraftValueExpiresAt;

    if (!syncDecision.shouldApplyInputValue) {
      return;
    }

    if (!isLocalDraftSync) {
      const externalAgentInput = resolveExternalAgentInput(inputValue);
      if (externalAgentInput !== null) {
        setAgentMode(true);
        setBrowserSearchMode(null);
        setDraftValue(externalAgentInput);
        return;
      }

      setAgentMode(false);
      setBrowserSearchMode(null);
    }

    setDraftValue(inputValue);
  }, [inputValue]);

  useEffect(() => () => {
    if (inputSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(inputSyncFrameRef.current);
      inputSyncFrameRef.current = null;
    }
  }, []);

  const scheduleInputSync = useCallback((nextValue: string) => {
    markPendingDraftValue(nextValue);

    if (inputSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(inputSyncFrameRef.current);
    }

    inputSyncFrameRef.current = window.requestAnimationFrame(() => {
      inputSyncFrameRef.current = null;
      commitInputValue(nextValue);
    });
  }, [commitInputValue, markPendingDraftValue]);

  const addDraftAttachments = useCallback((attachments: ChatMessageImageAttachment[]) => {
    if (attachments.length === 0) {
      return;
    }

    setDraftAttachments((currentAttachments) => [
      ...currentAttachments,
      ...attachments,
    ].slice(0, MAX_CHAT_IMAGE_ATTACHMENTS));
  }, []);

  const removeDraftAttachment = useCallback((attachmentId: string) => {
    setDraftAttachments((currentAttachments) => (
      currentAttachments.filter((attachment) => attachment.id !== attachmentId)
    ));
  }, []);

  const flushAndSendMessage = useCallback((options?: ChatDraftSendOptions) => {
    const nextDraftValue = draftValue;
    const nextDraftAttachments = draftAttachments;
    if (nextDraftValue.trim() === '/' && nextDraftAttachments.length === 0) {
      return;
    }
    if (!nextDraftValue.trim() && nextDraftAttachments.length === 0) {
      return;
    }
    const now = Date.now();
    if (now - lastSendAtRef.current < CHAT_DRAFT_DUPLICATE_SEND_GUARD_MS) {
      return;
    }
    lastSendAtRef.current = now;
    if (inputSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(inputSyncFrameRef.current);
      inputSyncFrameRef.current = null;
    }

    pendingDraftValueRef.current = '';
    pendingDraftValueExpiresAtRef.current = Date.now() + CHAT_DRAFT_LOCAL_SYNC_GUARD_MS;
    setDraftValue('');
    setDraftAttachments([]);
    onInputChange('');
    const nextAgentMode = options?.agentMode ?? agentMode;
    const nextBrowserSearchMode = options?.browserSearchMode ?? browserSearchMode ?? undefined;
    setAgentMode(false);
    setBrowserSearchMode(null);
    void onSendMessage(nextDraftValue, nextAgentMode || nextBrowserSearchMode || nextDraftAttachments.length > 0
      ? {
          agentMode: nextAgentMode || undefined,
          attachments: nextDraftAttachments.length > 0 ? nextDraftAttachments : undefined,
          browserSearchMode: nextBrowserSearchMode,
        }
      : undefined);
  }, [agentMode, browserSearchMode, draftAttachments, draftValue, onInputChange, onSendMessage]);

  return {
    addDraftAttachments,
    agentMode,
    commitInputValue,
    draftAttachments,
    draftValue,
    browserSearchMode,
    flushAndSendMessage,
    inputSyncFrameRef,
    removeDraftAttachment,
    scheduleInputSync,
    setDraftValue,
    setAgentMode,
    setBrowserSearchMode,
  };
}
