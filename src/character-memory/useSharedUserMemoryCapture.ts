import { useCallback, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { appendNeuralMemoryProposals, listNeuralMemoryProposals } from '../neural-memory/neuralMemoryProposalConfig';
import type { NeuralMemoryProposal } from '../neural-memory/neuralMemoryProposalTypes';
import type { NeuralMemoryReplyCompletedEvent } from '../neural-memory/useNeuralMemoryProposalCapture';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import {
  buildSharedUserMemoryExtractionPrompt,
  isSharedRememberRequest,
  listSharedUserMemory,
  parseSharedUserMemoryExtraction,
} from './sharedUserMemory';

const EXTRACTION_TIMEOUT_MS = 30_000;
const EXTRACTION_MAX_OUTPUT_TOKENS = 400;

let proposalSequence = 0;
function createProposalId() {
  proposalSequence += 1;
  return `shared-proposal-${Date.now().toString(36)}-${proposalSequence}`;
}

/**
 * When the user explicitly asks a character to remember something, turns it into a
 * “关于你” proposal in the sidebar. Approval writes it to the memory every character
 * shares; nothing is stored before that.
 */
export function useSharedUserMemoryCapture(options: {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  // In group chat several characters answer the same message; extract once.
  const handledUserTextRef = useRef('');
  const { configRef, onUpdateConfig } = options;

  return useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    if (event.chatMode === 'story' || !isSharedRememberRequest(event.userText)) return;
    const userTextKey = event.userText.trim();
    if (handledUserTextRef.current === userTextKey) return;
    handledUserTextRef.current = userTextKey;
    void (async () => {
      try {
        const known = [
          ...listSharedUserMemory(configRef.current).map((item) => item.text),
          ...listNeuralMemoryProposals(configRef.current)
            .filter((proposal) => proposal.scope === 'shared')
            .map((proposal) => proposal.content),
        ];
        const messages = buildScopedChatHistory(
          desktopPetChatStore.getState().messages, event.chatMode, event.roleId,
        );
        const prompt = buildSharedUserMemoryExtractionPrompt({ known, messages, roleName: event.roleName });
        if (!prompt.dialogue.length) return;
        const { getConfiguredCognitionResponse } = await import('../services/geminiService');
        const output = await getConfiguredCognitionResponse(
          prompt.payload, prompt.systemInstruction, configRef.current.settings, {
            allowReasoningContentFallback: true,
            maxTokensOverride: EXTRACTION_MAX_OUTPUT_TOKENS,
            task: 'memory-retrieval',
            timeoutMs: EXTRACTION_TIMEOUT_MS,
          },
        );
        const memories = parseSharedUserMemoryExtraction(output, known);
        pushFrontendRuntimeLog('共享记忆', `整理完成，提议 ${memories.length} 条`, {
          petId: event.roleId, petName: event.roleName,
        });
        if (!memories.length) return;
        const now = Date.now();
        const proposals: NeuralMemoryProposal[] = memories.map((memory) => ({
          content: memory.text,
          createdAt: now,
          id: createProposalId(),
          reason: '你让我记住的',
          roleId: event.roleId,
          scope: 'shared',
          sharedKind: memory.kind,
          sourceExcerpt: userTextKey.slice(0, 240),
          sourceMessageIds: [],
          type: memory.kind === 'preference' ? 'preference' : 'experience',
        }));
        onUpdateConfig(appendNeuralMemoryProposals(configRef.current, proposals));
      } catch (error) {
        pushFrontendRuntimeLog('共享记忆', '整理失败，本轮跳过', {
          message: error instanceof Error ? error.message : String(error),
          petId: event.roleId,
        });
      }
    })();
  }, [configRef, onUpdateConfig]);
}
