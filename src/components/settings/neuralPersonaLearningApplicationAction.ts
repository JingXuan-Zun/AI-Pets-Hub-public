import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaLearningApplicationCommandService,
  createNeuralPersonaLearningProposalRepository,
  createNeuralPersonaLearningReversalCommandService,
  createNeuralPersonaReinforcementLedgerRepository,
  inspectNeuralPersonaLearningReconciliation,
  type NeuralPersonaLearningApplicationResult,
  type NeuralPersonaLearningProposalRecord,
  type NeuralPersonaLearningReversalResult,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';

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

function commandId() {
  return `apply-learning-proposal:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function reversalCommandId() {
  return `reverse-learning-proposal:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

export function createNeuralPersonaLearningApplicationAction(options: {
  enabled: boolean;
  graphRecord: NeuralPersonaPersistedRecord;
  proposalRecord?: NeuralPersonaLearningProposalRecord;
}) {
  const apply = async (
    proposalId: string,
    confirmProtectedNode: boolean,
  ): Promise<NeuralPersonaLearningApplicationResult> => {
    if (!options.enabled || !options.proposalRecord) {
      return { reason: 'learning-application-panel-not-ready', status: 'missing' };
    }
    const roleId = options.graphRecord.roleId;
    const sources = repositories();
    const ledger = await sources.ledgerRepository.load(roleId);
    if (ledger.status !== 'ok') return ledger.status === 'missing'
      ? { reason: 'feedback-record-missing', status: 'missing' } : ledger;
    const service = createNeuralPersonaLearningApplicationCommandService(sources);
    return service.apply({
      appliedBy: 'local-user', commandId: commandId(),
      confirmProtectedNode: confirmProtectedNode || undefined,
      expectedGraphRevision: options.graphRecord.revision,
      expectedLedgerRevision: ledger.record.revision,
      expectedProposalRevision: options.proposalRecord.revision,
      proposalId, roleId,
    });
  };
  const reverse = async (
    proposalId: string,
    confirmProtectedNode: boolean,
  ): Promise<NeuralPersonaLearningReversalResult> => {
    if (!options.enabled || !options.proposalRecord) {
      return { reason: 'learning-application-panel-not-ready', status: 'missing' };
    }
    const sources = repositories();
    const service = createNeuralPersonaLearningReversalCommandService(sources);
    return service.reverse({
      commandId: reversalCommandId(),
      confirmProtectedNode: confirmProtectedNode || undefined,
      expectedGraphRevision: options.graphRecord.revision,
      expectedProposalRevision: options.proposalRecord.revision,
      proposalId, reversedBy: 'local-user', roleId: options.graphRecord.roleId,
    });
  };
  const reconciliation = options.proposalRecord
    ? inspectNeuralPersonaLearningReconciliation(options.graphRecord, options.proposalRecord)
    : undefined;
  return { apply, reconciliation, reverse };
}
