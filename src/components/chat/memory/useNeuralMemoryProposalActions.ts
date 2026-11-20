import { useCallback, useState } from 'react';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { removeNeuralMemoryProposal } from '../../../neural-memory/neuralMemoryProposalConfig';
import { approveNeuralMemoryProposal } from '../../../neural-memory/neuralMemoryProposalApproval';
import type { NeuralMemoryProposal } from '../../../neural-memory/neuralMemoryProposalTypes';
import type { PetConfig, PetConfigUpdateHandler } from '../../../types';

export function useNeuralMemoryProposalActions(options: {
  config: PetConfig;
  onUpdateConfig?: PetConfigUpdateHandler;
}) {
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { config, onUpdateConfig } = options;

  const dismiss = useCallback((proposal: NeuralMemoryProposal) => {
    onUpdateConfig?.(removeNeuralMemoryProposal(config, proposal.id));
    setMessage('');
  }, [config, onUpdateConfig]);

  const approve = useCallback(async (proposal: NeuralMemoryProposal, content: string) => {
    if (!onUpdateConfig || busyProposalId) return;
    setBusyProposalId(proposal.id);
    try {
      const outcome = await approveNeuralMemoryProposal(config, proposal, content);
      if (outcome.ok) onUpdateConfig(outcome.config);
      setMessage(outcome.message);
    } catch (error) {
      setMessage(`记录失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pushFrontendRuntimeLog('角色记忆提议', '用户批准记忆提议', { proposalId: proposal.id, roleId: proposal.roleId, shared: proposal.scope === 'shared' });
      setBusyProposalId(null);
    }
  }, [busyProposalId, config, onUpdateConfig]);

  return { approve, busyProposalId, dismiss, message };
}
