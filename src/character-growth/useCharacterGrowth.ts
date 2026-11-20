import { useCallback, useRef, type MutableRefObject } from 'react';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { appendNeuralMemoryProposals } from '../neural-memory/neuralMemoryProposalConfig';
import type { NeuralMemoryReplyCompletedEvent } from '../neural-memory/useNeuralMemoryProposalCapture';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import { reflectGrowth } from './growthReflection';

// Pet window: after a private-chat reply of a 知识记忆人格 character, she sometimes looks back
// (enough new memories, at most daily, at most two proposals a week — growthRules.ts) and
// proposes what she has grown into. The proposals wait in the chat window's approval sidebar.

export function useCharacterGrowth(options: { configRef: MutableRefObject<PetConfig>; onUpdateConfig: PetConfigUpdateHandler }) {
  const running = useRef(new Set<string>());
  const { configRef, onUpdateConfig } = options;
  return useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    if (event.chatMode !== 'single' || !event.neuralPersonaEnabled || running.current.has(event.roleId)) return;
    running.current.add(event.roleId);
    void reflectGrowth({ config: configRef.current, roleId: event.roleId })
      .then((result) => {
        if (result.status !== 'proposed') {
          if (result.status === 'nothing') pushFrontendRuntimeLog('成长', result.reason, { petId: event.roleId });
          return;
        }
        const next = appendNeuralMemoryProposals(configRef.current, result.proposals);
        configRef.current = next;
        onUpdateConfig(next, { persist: true });
        pushFrontendRuntimeLog('成长', `提出了 ${result.proposals.length} 条成长，等你确认`, { petId: event.roleId });
      })
      .catch((error) => pushFrontendRuntimeLog('成长', '回顾失败', { error: error instanceof Error ? error.message : String(error), petId: event.roleId }))
      .finally(() => running.current.delete(event.roleId));
  }, [configRef, onUpdateConfig]);
}
