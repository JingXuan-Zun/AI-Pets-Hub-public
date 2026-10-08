import { useCallback, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import type { DesktopPetChatMode, PetConfig, PetConfigUpdateHandler } from '../types';
import { appendNeuralMemoryProposals, listNeuralMemoryProposals } from './neuralMemoryProposalConfig';
import { buildNeuralMemoryJudgementPrompt, parseNeuralMemoryJudgement } from './neuralMemoryProposalJudge';
import { createNeuralMemoryJudgementTrigger } from './neuralMemoryProposalTrigger';
import { loadNeuralMemorySummaries } from './neuralMemoryStaging';

const JUDGEMENT_TIMEOUT_MS = 45_000;
const JUDGEMENT_MAX_OUTPUT_TOKENS = 800;

export interface NeuralMemoryReplyCompletedEvent {
  chatMode: DesktopPetChatMode;
  neuralPersonaEnabled: boolean;
  roleId: string;
  roleName: string;
  userText: string;
}

let proposalSequence = 0;
function createProposalId() {
  proposalSequence += 1;
  return `proposal-${Date.now().toString(36)}-${proposalSequence}`;
}

/**
 * After a private-chat reply completes, occasionally asks the model in the
 * background whether the character should keep a memory. Proposals land in
 * config.neuralMemoryProposals for the user to approve; nothing is written to
 * the neural graph here and the reply itself is never touched.
 */
export function useNeuralMemoryProposalCapture(options: {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  const triggerRef = useRef(createNeuralMemoryJudgementTrigger());
  const runningRolesRef = useRef(new Set<string>());
  const { configRef, onUpdateConfig } = options;

  return useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    if (event.chatMode !== 'single' || !event.neuralPersonaEnabled) return;
    if (!triggerRef.current.recordTurn(event.roleId, event.userText)) return;
    if (runningRolesRef.current.has(event.roleId)) return;
    runningRolesRef.current.add(event.roleId);
    void (async () => {
      try {
        const messages = buildScopedChatHistory(
          desktopPetChatStore.getState().messages, 'single', event.roleId,
        );
        const knownMemories = [
          ...await loadNeuralMemorySummaries(event.roleId),
          ...listNeuralMemoryProposals(configRef.current, event.roleId).map((proposal) => proposal.content),
        ];
        const input = { knownMemories, messages, roleId: event.roleId, roleName: event.roleName };
        const prompt = buildNeuralMemoryJudgementPrompt(input);
        if (!prompt.lines.length) return;
        const { getConfiguredCognitionResponse } = await import('../services/geminiService');
        const output = await getConfiguredCognitionResponse(
          prompt.payload, prompt.systemInstruction, configRef.current.settings, {
            allowReasoningContentFallback: true,
            maxTokensOverride: JUDGEMENT_MAX_OUTPUT_TOKENS,
            task: 'memory-retrieval',
            timeoutMs: JUDGEMENT_TIMEOUT_MS,
          },
        );
        const proposals = parseNeuralMemoryJudgement(output, input, {
          createId: createProposalId, now: Date.now(),
        });
        pushFrontendRuntimeLog('角色记忆提议', `判断完成，提议 ${proposals.length} 条`, {
          petId: event.roleId, petName: event.roleName,
        });
        if (proposals.length) {
          onUpdateConfig(appendNeuralMemoryProposals(configRef.current, proposals));
        }
      } catch (error) {
        pushFrontendRuntimeLog('角色记忆提议', '判断失败，本轮跳过', {
          message: error instanceof Error ? error.message : String(error),
          petId: event.roleId,
        });
      } finally {
        runningRolesRef.current.delete(event.roleId);
      }
    })();
  }, [configRef, onUpdateConfig]);
}
