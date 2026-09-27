import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, PetConfig, PetConfigUpdateHandler } from '../../../../types';
import {
  approveGroupMemoryCandidate,
  CURRENT_GROUP_MEMORY_GROUP_ID,
  rejectGroupMemoryCandidate,
} from '../../../../group-memory';
import {
  captureAutomaticGroupTaskMemoryCandidates,
} from './groupTaskMemoryCandidate';

export interface GroupTaskMemoryCandidateNotice {
  candidateId: string;
  sourceMessageId: string;
  summary: string;
}

export function useGroupTaskMemoryCandidateCapture(options: {
  config: PetConfig;
  messages: ChatMessage[];
  onUpdateConfig?: PetConfigUpdateHandler;
}) {
  const observedKeysRef = useRef(new Set<string>());
  const [notice, setNotice] = useState<GroupTaskMemoryCandidateNotice | null>(null);

  useEffect(() => {
    if (!options.onUpdateConfig) return;
    const result = captureAutomaticGroupTaskMemoryCandidates({
      messages: options.messages,
      observedKeys: observedKeysRef.current,
      repository: options.config.groupMemoryRepository,
    });
    if (!result.latestCandidate || result.repository === options.config.groupMemoryRepository) return;
    options.onUpdateConfig({ ...options.config, groupMemoryRepository: result.repository });
    setNotice({
      candidateId: result.latestCandidate.id,
      sourceMessageId: result.latestCandidate.evidence.sourceMessageId,
      summary: result.latestCandidate.proposedRecord.summary,
    });
  }, [options.config, options.messages, options.onUpdateConfig]);

  const review = (
    decision: 'approve' | 'reject',
    targetGroupId = CURRENT_GROUP_MEMORY_GROUP_ID,
  ) => {
    if (!notice || !options.onUpdateConfig) return;
    const result = decision === 'approve'
      ? approveGroupMemoryCandidate(
        options.config.groupMemoryRepository, notice.candidateId, Date.now(), targetGroupId,
      )
      : rejectGroupMemoryCandidate(options.config.groupMemoryRepository, notice.candidateId);
    if (result.receipt) {
      options.onUpdateConfig({ ...options.config, groupMemoryRepository: result.repository });
    }
    setNotice(null);
  };

  return {
    notice,
    approve: (groupId: string) => review('approve', groupId),
    ignore: () => review('reject'),
  };
}
