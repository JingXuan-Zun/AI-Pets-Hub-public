import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaLearningProposalCommandService,
  createNeuralPersonaLearningProposalRepository,
  createNeuralPersonaReinforcementLedgerRepository,
  type NeuralPersonaLearningProposalCommandResult,
  type NeuralPersonaLearningProposalRecord,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';

export type NeuralPersonaLearningProposalPanelState =
  | { status: 'disabled' | 'loading' | 'missing' }
  | { message: string; status: 'error' }
  | { record: NeuralPersonaLearningProposalRecord; status: 'ready' };

function repositories() {
  const storage = createNeuralPersonaDesktopStorage();
  return {
    graphRepository: createNeuralPersonaGraphRepository({
      config: DEFAULT_NEURAL_PERSONA_CONFIG, storage,
    }),
    ledgerRepository: createNeuralPersonaReinforcementLedgerRepository({ storage }),
    proposalRepository: createNeuralPersonaLearningProposalRepository({ storage }),
  };
}

async function loadState(roleId: string): Promise<NeuralPersonaLearningProposalPanelState> {
  try {
    const loaded = await repositories().proposalRepository.load(roleId);
    if (loaded.status === 'missing') return { status: 'missing' };
    if (loaded.status === 'corrupt') return { message: loaded.reason, status: 'error' };
    return { record: loaded.record, status: 'ready' };
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error), status: 'error' };
  }
}

function commandId(type: string) {
  return `${type}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function useProposalState(enabled: boolean, roleId: string) {
  const [state, setState] = useState<NeuralPersonaLearningProposalPanelState>(
    enabled ? { status: 'loading' } : { status: 'disabled' },
  );
  const activeRoleId = useRef(roleId);
  activeRoleId.current = roleId;
  const refresh = useCallback(async () => {
    const next = await loadState(roleId);
    if (activeRoleId.current === roleId) setState(next);
    return next;
  }, [roleId]);
  useEffect(() => {
    if (!enabled) { setState({ status: 'disabled' }); return undefined; }
    let active = true;
    setState({ status: 'loading' });
    void loadState(roleId).then((next) => active && setState(next));
    return () => { active = false; };
  }, [enabled, roleId]);
  return { activeRoleId, refresh, setState, state };
}

export function useNeuralPersonaLearningProposalPanelState(
  enabled: boolean,
  graphRecord: NeuralPersonaPersistedRecord,
) {
  const controller = useProposalState(enabled, graphRecord.roleId);
  const applyResult = async (result: NeuralPersonaLearningProposalCommandResult, roleId: string) => {
    if (controller.activeRoleId.current !== roleId) return result;
    if (result.status === 'ok' || result.status === 'idempotent') {
      controller.setState({ record: result.record, status: 'ready' });
    } else if (result.status === 'conflict') await controller.refresh();
    return result;
  };
  const generate = async (nodeId: string): Promise<NeuralPersonaLearningProposalCommandResult> => {
    if (!enabled || !['missing', 'ready'].includes(controller.state.status)) {
      return { reason: 'learning-proposal-panel-not-ready', status: 'missing' };
    }
    const roleId = graphRecord.roleId;
    const sources = repositories();
    const ledger = await sources.ledgerRepository.load(roleId);
    if (ledger.status !== 'ok') return ledger.status === 'missing'
      ? { reason: 'feedback-record-missing', status: 'missing' } : ledger;
    const now = Date.now();
    const service = createNeuralPersonaLearningProposalCommandService(sources);
    return applyResult(await service.generate({
      commandId: commandId('generate-learning-proposal'), createdAt: now,
      expectedGraphRevision: graphRecord.revision,
      expectedLedgerRevision: ledger.record.revision,
      expectedProposalRevision: controller.state.status === 'ready'
        ? controller.state.record.revision : null,
      nodeId, projectedAt: now, roleId,
    }), roleId);
  };
  const review = async (proposalId: string, decision: 'accept' | 'reject', confirmed: boolean) => {
    if (!enabled || controller.state.status !== 'ready') {
      return { reason: 'learning-proposal-panel-not-ready', status: 'missing' } as const;
    }
    const roleId = graphRecord.roleId;
    const service = createNeuralPersonaLearningProposalCommandService(repositories());
    return applyResult(await service.review({
      commandId: commandId(`review-learning-proposal-${decision}`),
      confirmProtectedNode: confirmed || undefined, decision,
      expectedProposalRevision: controller.state.record.revision,
      proposalId, reviewerId: 'local-user', roleId,
    }), roleId);
  };
  return { generate, refresh: controller.refresh, review, state: controller.state };
}
