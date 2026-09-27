import type {
  NeuralPersonaFeedbackCommandReceipt,
  NeuralPersonaFeedbackCommandResult,
  RecordNeuralPersonaFeedbackCommand,
} from './neuralPersonaFeedbackCommandTypes';
import type { NeuralPersonaReinforcementLedgerRepository } from './neuralPersonaFeedbackRepository';
import type {
  NeuralPersonaFeedbackEvent,
  NeuralPersonaReinforcementLedgerRecord,
} from './neuralPersonaFeedbackTypes';
import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import { normalizeNeuralPersonaFeedbackEvent } from './neuralPersonaFeedbackValidation';

interface CommandOptions {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now: () => number;
}

type LedgerReadyResult =
  | { record: NeuralPersonaReinforcementLedgerRecord; status: 'ok' }
  | Exclude<NeuralPersonaFeedbackCommandResult, { receipt: unknown }>;

export interface NeuralPersonaFeedbackCommandService {
  recordFeedback: (
    command: RecordNeuralPersonaFeedbackCommand,
  ) => Promise<NeuralPersonaFeedbackCommandResult>;
}

function validateCommand(command: RecordNeuralPersonaFeedbackCommand) {
  if (![command.commandId, command.nodeId, command.roleId].every((value) => value.trim())) {
    return 'feedback-command-invalid';
  }
  if (!Number.isSafeInteger(command.expectedGraphRevision)
    || command.expectedGraphRevision < 0) return 'feedback-graph-revision-invalid';
  if (command.expectedLedgerRevision !== null
    && (!Number.isSafeInteger(command.expectedLedgerRevision)
      || command.expectedLedgerRevision < 0)) return 'feedback-ledger-revision-invalid';
  return null;
}

function eventFromCommand(command: RecordNeuralPersonaFeedbackCommand): NeuralPersonaFeedbackEvent {
  return {
    eventId: command.commandId,
    evidence: command.evidence,
    kind: command.kind,
    magnitude: command.magnitude,
    nodeId: command.nodeId,
    observedGraphRevision: command.expectedGraphRevision,
    occurredAt: command.occurredAt,
    roleId: command.roleId,
  };
}

function graphConflict(actualRevision: number) {
  return { actualRevision, conflictScope: 'graph' as const, status: 'conflict' as const };
}

function ledgerConflict(actualRevision: number | null) {
  return { actualRevision, conflictScope: 'ledger' as const, status: 'conflict' as const };
}

function existingRetry(record: NeuralPersonaReinforcementLedgerRecord, commandId: string) {
  return record.events.some((event) => event.eventId === commandId);
}

async function initializeMissingLedger(
  options: CommandOptions,
  command: RecordNeuralPersonaFeedbackCommand,
): Promise<LedgerReadyResult> {
  if (command.expectedLedgerRevision !== null) {
    return { reason: 'feedback-record-missing', status: 'missing' };
  }
  const initialized = await options.ledgerRepository.initialize(command.roleId);
  if (initialized.status === 'ok') return initialized;
  if (initialized.status === 'idempotent') {
    return { record: initialized.record, status: 'ok' };
  }
  if (initialized.status !== 'conflict') return initialized;
  const latest = await options.ledgerRepository.load(command.roleId);
  if (latest.status !== 'ok') return latest.status === 'missing'
    ? ledgerConflict(null) : latest;
  return latest.record.revision === 0 && !latest.record.events.length
    ? latest : ledgerConflict(latest.record.revision);
}

async function loadLedger(
  options: CommandOptions,
  command: RecordNeuralPersonaFeedbackCommand,
): Promise<LedgerReadyResult> {
  const loaded = await options.ledgerRepository.load(command.roleId);
  if (loaded.status === 'missing') return initializeMissingLedger(options, command);
  if (loaded.status === 'corrupt') return loaded;
  if (command.expectedLedgerRevision === null
    && loaded.record.events.length
    && !existingRetry(loaded.record, command.commandId)) {
    return ledgerConflict(loaded.record.revision);
  }
  return loaded;
}

function receipt(
  command: RecordNeuralPersonaFeedbackCommand,
  ledgerRevision: number,
  timestamp: number,
): NeuralPersonaFeedbackCommandReceipt {
  return {
    commandId: command.commandId,
    eventId: command.commandId,
    graphRevisionObserved: command.expectedGraphRevision,
    ledgerRevision,
    nodeId: command.nodeId,
    roleId: command.roleId,
    timestamp,
  };
}

async function executeRecord(
  options: CommandOptions,
  command: RecordNeuralPersonaFeedbackCommand,
): Promise<NeuralPersonaFeedbackCommandResult> {
  const issue = validateCommand(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const event = normalizeNeuralPersonaFeedbackEvent(
    eventFromCommand(command), command.roleId, options.now(),
  );
  if (event.valid === false) return { reason: event.reason, status: 'invalid' };
  const graph = await options.graphRepository.load(command.roleId);
  if (graph.status !== 'ok') return graph.status === 'missing'
    ? { reason: 'graph-record-missing', status: 'missing' } : graph;
  if (graph.record.revision !== command.expectedGraphRevision) {
    return graphConflict(graph.record.revision);
  }
  const node = graph.record.graph.nodes.find((item) => item.nodeId === command.nodeId);
  if (!node) return { reason: 'feedback-node-missing', status: 'missing' };
  if (node.status !== 'active') return { reason: 'feedback-node-not-active', status: 'invalid' };
  if (node.expiresAt !== undefined && node.expiresAt <= options.now()) {
    return { reason: 'feedback-node-expired', status: 'invalid' };
  }
  const ledger = await loadLedger(options, command);
  if (ledger.status !== 'ok') return ledger;
  const expectedRevision = command.expectedLedgerRevision ?? ledger.record.revision;
  const written = await options.ledgerRepository.append({
    event: event.event, expectedRevision,
    nodeId: command.nodeId, roleId: command.roleId,
  });
  if (written.status === 'conflict') return { ...written, conflictScope: 'ledger' };
  if (written.status !== 'ok' && written.status !== 'idempotent') return written;
  return {
    receipt: receipt(command, written.record.revision, options.now()),
    record: written.record,
    status: written.status,
  };
}

export function createNeuralPersonaFeedbackCommandService(options: {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now?: () => number;
}): NeuralPersonaFeedbackCommandService {
  const resolved = { ...options, now: options.now ?? Date.now };
  return { recordFeedback: (command) => executeRecord(resolved, command) };
}
