import { useCallback, useRef, type MutableRefObject } from 'react';
import { listSharedUserMemory } from './sharedUserMemory';
import { desktopPetChatStore } from '../chatStore';
import { withEarlierPerspectiveCorrection, withPerspectiveCorrection } from './perspectiveCorrection';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { applyDesktopPetSlotChanges, getDesktopPetSlot } from '../multiPetRoster';
import type { NeuralMemoryReplyCompletedEvent } from '../neural-memory/useNeuralMemoryProposalCapture';
import type { ChatMessage, PetConfig, PetConfigUpdateHandler } from '../types';
import {
  applyAutoMemoryOperations,
  buildAutoMemoryExtractionPrompt,
  createAutoMemoryExtractionTrigger,
  parseAutoMemoryOperations,
} from './autoMemoryExtraction';
import { normalizeCharacterMemoryState, type CharacterMemoryState } from './characterMemoryTypes';
import { selectArchivableChatMessages } from './chatHistoryArchive';
import {
  buildConversationSummaryPrompt,
  parseConversationSummary,
  selectMessagesPendingSummary,
} from './conversationSummary';

const MEMORY_TASK_TIMEOUT_MS = 60_000;
const SUMMARY_MAX_OUTPUT_TOKENS = 1600;
const EXTRACTION_MAX_OUTPUT_TOKENS = 1200;
/** Archive in batches so the live history file is not rewritten for every message. */
const ARCHIVE_MIN_BATCH = 50;

function readMemoryState(config: PetConfig, roleId: string) {
  const slot = getDesktopPetSlot(config, roleId);
  return slot ? normalizeCharacterMemoryState(slot.personality.memoryState) : null;
}

/** Applies a change to the latest config, so edits made meanwhile are kept. */
export function updateCharacterMemoryState(
  config: PetConfig,
  roleId: string,
  update: (state: CharacterMemoryState) => CharacterMemoryState,
) {
  const slot = getDesktopPetSlot(config, roleId);
  if (!slot) return config;
  const current = normalizeCharacterMemoryState(slot.personality.memoryState);
  const next = update(current);
  if (next === current) return config;
  return applyDesktopPetSlotChanges(config, roleId, {
    personality: { ...slot.personality, memoryState: next },
  });
}

function archiveKey(message: ChatMessage) {
  return message.id ?? `${message.createdAt ?? 0}:${message.role}:${message.petId ?? ''}:${message.text.slice(0, 48)}`;
}

async function archiveCoveredChatHistory(config: PetConfig) {
  const archiveChatHistory = window.desktopPetShell?.archiveChatHistory;
  if (!window.desktopPetShell?.desktopMode || !archiveChatHistory) return;
  const archivable = selectArchivableChatMessages(
    desktopPetChatStore.getState().messages,
    (petId) => {
      const state = readMemoryState(config, petId);
      // A removed character's chats will never be summarized; archive them as they are.
      if (!state) return Number.POSITIVE_INFINITY;
      return state.summary?.coveredUntil ?? null;
    },
  );
  if (archivable.length < ARCHIVE_MIN_BATCH) return;
  const result = await archiveChatHistory(archivable);
  if (!result?.ok) {
    pushFrontendRuntimeLog('角色记忆', '聊天记录归档失败，保留在当前记录中', { error: result?.error ?? 'unknown' });
    return;
  }
  const archivedKeys = new Set(archivable.map(archiveKey));
  desktopPetChatStore.replaceMessages(
    desktopPetChatStore.getState().messages.filter((message) => !archivedKeys.has(archiveKey(message))),
  );
  pushFrontendRuntimeLog('角色记忆', `已归档 ${archivable.length} 条较早的聊天记录`);
}

/**
 * After a private-chat reply, folds messages that left the prompt window into
 * the role's conversation summary, keeps the automatic memory list up to date,
 * and archives old history the summary already covers. Everything runs in the
 * background; failures only skip the round.
 */
export function useCharacterMemoryMaintenance(options: {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const triggerRef = useRef(createAutoMemoryExtractionTrigger());
  const runningRolesRef = useRef(new Set<string>());
  const historyCheckedRef = useRef(new Set<string>());
  const { configRef, onUpdateConfig } = options;

  return useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    if (event.chatMode !== 'single') return;
    // "这是我们家": a correction of how she frames "us" is kept as a pinned memory right away;
    // the first time per run, earlier corrections in her history count too.
    const firstLook = !historyCheckedRef.current.has(event.roleId);
    historyCheckedRef.current.add(event.roleId);
    const earlierUserTexts = firstLook
      ? buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', event.roleId).filter((message) => message.role === 'user').map((message) => message.text)
      : [];
    const corrected = updateCharacterMemoryState(configRef.current, event.roleId, (state) => withPerspectiveCorrection(
      withEarlierPerspectiveCorrection(state, earlierUserTexts, Date.now()), event.userText, Date.now(),
    ));
    if (corrected !== configRef.current) {
      // Updated right away: the upkeep below reads configRef before React re-renders, and would
      // otherwise save over this change (seen in the first real test).
      configRef.current = corrected;
      onUpdateConfig(corrected, { persist: true });
      pushFrontendRuntimeLog('角色记忆', '记下了说法上的纠正（我们家）', { petId: event.roleId });
    }
    // Neural roles keep their own propose-and-approve memory flow.
    const shouldExtract = !event.neuralPersonaEnabled
      && triggerRef.current.recordTurn(event.roleId, event.userText);
    if (runningRolesRef.current.has(event.roleId)) return;
    runningRolesRef.current.add(event.roleId);

    const commit = (update: (state: CharacterMemoryState) => CharacterMemoryState) => {
      const next = updateCharacterMemoryState(configRef.current, event.roleId, update);
      if (next === configRef.current) return;
      configRef.current = next;
      // Saved to disk now: the chat session's handler only changes the running config, so memory
      // upkeep used to be lost when the app closed before some other change saved (found 11-19).
      onUpdateConfig(next, { persist: true });
    };

    void (async () => {
      try {
        await runMaintenance();
      } finally {
        runningRolesRef.current.delete(event.roleId);
      }
    })();

    async function runMaintenance() {
      const { getConfiguredCognitionResponse } = await import('../services/geminiService');
      const roleHistory = () => buildScopedChatHistory(
        desktopPetChatStore.getState().messages, 'single', event.roleId,
      );

      try {
        const state = readMemoryState(configRef.current, event.roleId);
        const pending = state
          ? selectMessagesPendingSummary(roleHistory(), configRef.current.settings.memoryDepth, state.summary)
          : [];
        if (state && pending.length) {
          const prompt = buildConversationSummaryPrompt({
            messages: pending,
            previousSummary: state.summary?.text ?? '',
            roleName: event.roleName,
          });
          const output = await getConfiguredCognitionResponse(
            prompt.payload, prompt.systemInstruction, configRef.current.settings, {
              allowReasoningContentFallback: true,
              maxTokensOverride: SUMMARY_MAX_OUTPUT_TOKENS,
              task: 'memory-retrieval',
              timeoutMs: MEMORY_TASK_TIMEOUT_MS,
            },
          );
          const text = parseConversationSummary(output);
          if (text) {
            const coveredUntil = Math.max(
              state.summary?.coveredUntil ?? 0,
              ...pending.map((message) => message.createdAt ?? 0),
            );
            commit((current) => ({ ...current, summary: { coveredUntil, text, updatedAt: Date.now() } }));
            pushFrontendRuntimeLog('角色记忆', `过往对话摘要已更新（并入 ${pending.length} 条）`, {
              petId: event.roleId, petName: event.roleName,
            });
          }
        }
      } catch (error) {
        pushFrontendRuntimeLog('角色记忆', '过往对话摘要更新失败，本轮跳过', {
          message: error instanceof Error ? error.message : String(error), petId: event.roleId,
        });
      }

      try {
        const state = shouldExtract ? readMemoryState(configRef.current, event.roleId) : null;
        if (state) {
          const prompt = buildAutoMemoryExtractionPrompt({
            items: state.items,
            messages: roleHistory(),
            roleName: event.roleName,
            sharedMemories: listSharedUserMemory(configRef.current).map((item) => item.text),
          });
          if (prompt.dialogue.length) {
            const output = await getConfiguredCognitionResponse(
              prompt.payload, prompt.systemInstruction, configRef.current.settings, {
                allowReasoningContentFallback: true,
                maxTokensOverride: EXTRACTION_MAX_OUTPUT_TOKENS,
                task: 'memory-retrieval',
                timeoutMs: MEMORY_TASK_TIMEOUT_MS,
              },
            );
            const operations = parseAutoMemoryOperations(output, state.items, { tidy: prompt.tidy });
            if (operations && (operations.add.length || operations.update.length || operations.remove.length)) {
              commit((current) => applyAutoMemoryOperations(current, operations));
              pushFrontendRuntimeLog('角色记忆', '自动记忆已更新', {
                added: operations.add.length,
                petId: event.roleId,
                petName: event.roleName,
                removed: operations.remove.length,
                updated: operations.update.length,
              });
            }
          }
        }
      } catch (error) {
        pushFrontendRuntimeLog('角色记忆', '自动记忆更新失败，本轮跳过', {
          message: error instanceof Error ? error.message : String(error), petId: event.roleId,
        });
      }

      try {
        await archiveCoveredChatHistory(configRef.current);
      } catch (error) {
        pushFrontendRuntimeLog('角色记忆', '聊天记录归档失败', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [configRef, onUpdateConfig]);
}
