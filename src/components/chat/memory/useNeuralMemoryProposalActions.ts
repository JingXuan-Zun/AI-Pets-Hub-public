import { useCallback, useState } from 'react';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { removeNeuralMemoryProposal } from '../../../neural-memory/neuralMemoryProposalConfig';
import type { NeuralMemoryProposal } from '../../../neural-memory/neuralMemoryProposalTypes';
import { stageNeuralMemoryProposal } from '../../../neural-memory/neuralMemoryStaging';
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
      const result = await stageNeuralMemoryProposal(proposal, content);
      // A repeated approval (another window, a retried click) already staged this proposal.
      const alreadyStaged = result.status === 'invalid' && result.reason === 'node-already-exists';
      if (result.status === 'ok' || alreadyStaged) {
        onUpdateConfig(removeNeuralMemoryProposal(config, proposal.id));
        setMessage('已暂存。到设置页「知识记忆人格」的记忆列表里确认生效后，才会参与对话。');
        return;
      }
      setMessage(result.status === 'conflict'
        ? '图谱刚被修改过，请再点一次“记住”。'
        : `暂存失败：${result.reason}`);
    } catch (error) {
      setMessage(`暂存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pushFrontendRuntimeLog('角色记忆提议', '用户批准记忆提议', { proposalId: proposal.id, roleId: proposal.roleId });
      setBusyProposalId(null);
    }
  }, [busyProposalId, config, onUpdateConfig]);

  return { approve, busyProposalId, dismiss, message };
}
