import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import { diffNeuralPersonaGraphs } from './neuralPersonaGraphExchange';
import {
  type ImportNeuralPersonaGraphCommand,
  type NeuralPersonaGraphExchangeReceipt,
  type NeuralPersonaGraphExchangeResult,
} from './neuralPersonaGraphExchangeTypes';

interface CommandOptions {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}

export interface NeuralPersonaGraphExchangeService {
  importGraph: (command: ImportNeuralPersonaGraphCommand) => Promise<NeuralPersonaGraphExchangeResult>;
}

function graphVersion(revision: number) {
  return `neural-graph.r${revision}`;
}

function invalidEnvelope(command: ImportNeuralPersonaGraphCommand) {
  if (!command.commandId.trim()) return 'command-id-missing';
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    return 'expected-revision-invalid';
  }
  if (!Number.isInteger(command.sourceRevision) || command.sourceRevision < 0) {
    return 'source-revision-invalid';
  }
  return null;
}

function receipt(input: {
  command: ImportNeuralPersonaGraphCommand;
  revision: number;
  timestamp: number;
}): NeuralPersonaGraphExchangeReceipt {
  return {
    appliedRevision: input.revision,
    commandId: input.command.commandId,
    commandType: 'import-graph',
    graphVersion: graphVersion(input.revision),
    roleId: input.command.roleId,
    sourceRevision: input.command.sourceRevision,
    timestamp: input.timestamp,
  };
}

async function executeImport(
  options: CommandOptions,
  command: ImportNeuralPersonaGraphCommand,
): Promise<NeuralPersonaGraphExchangeResult> {
  const envelopeIssue = invalidEnvelope(command);
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' };
  if (command.graph.roleId !== command.roleId) return { reason: 'import-role-mismatch', status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const diff = diffNeuralPersonaGraphs(loaded.record.graph, command.graph);
  if (!diff.hasChanges) {
    return { reason: 'import-has-no-changes', status: 'invalid' };
  }
  if (diff.requiresProtectedConfirmation && !command.confirmProtectedChanges) {
    return { reason: 'protected-import-confirmation-required', status: 'invalid' };
  }
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: () => ({
      ...command.graph,
      graphVersion: graphVersion(revision),
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ command, revision, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

export function createNeuralPersonaGraphExchangeService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}): NeuralPersonaGraphExchangeService {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return { importGraph: (command) => executeImport(resolved, command) };
}
