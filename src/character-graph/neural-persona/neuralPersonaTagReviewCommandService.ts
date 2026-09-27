import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import { normalizeNeuralPersonaTagId } from './neuralPersonaTagIndex';
import type {
  NeuralPersonaTagReviewCommandReceipt,
  NeuralPersonaTagReviewCommandResult,
  ReviewNeuralPersonaTagSuggestionCommand,
  StageNeuralPersonaTagSuggestionsCommand,
} from './neuralPersonaTagReviewCommandTypes';
import type { NeuralPersonaTag } from './neuralPersonaTypes';

interface CommandOptions {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}

export interface NeuralPersonaTagReviewCommandService {
  reviewSuggestion: (
    command: ReviewNeuralPersonaTagSuggestionCommand,
  ) => Promise<NeuralPersonaTagReviewCommandResult>;
  stageSuggestions: (
    command: StageNeuralPersonaTagSuggestionsCommand,
  ) => Promise<NeuralPersonaTagReviewCommandResult>;
}

function graphVersion(revision: number) {
  return `neural-graph.r${revision}`;
}

function invalidEnvelope(command: {
  commandId: string; expectedRevision: number; nodeId: string; roleId: string;
}) {
  if (![command.commandId, command.nodeId, command.roleId].every((value) => value.trim())) {
    return 'tag-review-command-invalid';
  }
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    return 'expected-revision-invalid';
  }
  return null;
}

function invalidSuggestions(suggestions: NeuralPersonaTag[]) {
  if (!suggestions.length) return 'tag-suggestions-empty';
  if (suggestions.some((tag) => tag.source !== 'system' || tag.status !== 'pending-review'
    || !tag.canonicalId.trim() || !tag.label.trim()
    || normalizeNeuralPersonaTagId(tag.canonicalId) !== tag.canonicalId
    || tag.reviewedAt !== undefined || tag.reviewerId !== undefined)) {
    return 'tag-suggestion-invalid';
  }
  const ids = suggestions.map((tag) => tag.canonicalId);
  return new Set(ids).size === ids.length ? null : 'tag-suggestion-duplicate';
}

function receipt(input: {
  commandId: string; commandType: NeuralPersonaTagReviewCommandReceipt['commandType'];
  decision?: 'accept' | 'reject'; nodeId: string; revision: number;
  roleId: string; tagIds: string[]; timestamp: number;
}): NeuralPersonaTagReviewCommandReceipt {
  return {
    appliedRevision: input.revision, commandId: input.commandId,
    commandType: input.commandType, decision: input.decision,
    graphVersion: graphVersion(input.revision), nodeId: input.nodeId,
    roleId: input.roleId, tagIds: input.tagIds, timestamp: input.timestamp,
  };
}

async function executeStage(
  options: CommandOptions,
  command: StageNeuralPersonaTagSuggestionsCommand,
): Promise<NeuralPersonaTagReviewCommandResult> {
  const issue = invalidEnvelope(command) ?? invalidSuggestions(command.suggestions);
  if (issue) return { reason: issue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing'
    ? { reason: 'record-missing', status: 'missing' } : loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const node = loaded.record.graph.nodes.find((item) => item.nodeId === command.nodeId);
  if (!node) return { reason: 'node-missing', status: 'missing' };
  if (node.protected && !command.confirmProtectedNode) {
    return { reason: 'protected-node-confirmation-required', status: 'invalid' };
  }
  const existingIds = new Set(node.tags.map((tag) => tag.canonicalId));
  const additions = command.suggestions.filter((tag) => !existingIds.has(tag.canonicalId));
  if (!additions.length) return { reason: 'tag-suggestions-have-no-changes', status: 'invalid' };
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision, roleId: command.roleId,
    update: (graph) => ({ ...graph, graphVersion: graphVersion(revision),
      nodes: graph.nodes.map((item) => item.nodeId === command.nodeId
        ? { ...item, tags: [...item.tags, ...additions], updatedAt: timestamp } : item) }),
  });
  if (result.status !== 'ok') return result;
  return { receipt: receipt({ commandId: command.commandId, commandType: 'stage-tag-suggestions',
    nodeId: command.nodeId, revision, roleId: command.roleId,
    tagIds: additions.map((tag) => tag.canonicalId), timestamp }), record: result.record, status: 'ok' };
}

async function executeReview(
  options: CommandOptions,
  command: ReviewNeuralPersonaTagSuggestionCommand,
): Promise<NeuralPersonaTagReviewCommandResult> {
  const issue = invalidEnvelope(command);
  if (issue || !command.tagId.trim() || !command.reviewerId.trim()
    || command.reviewerId.length > 128
    || !['accept', 'reject'].includes(command.decision)) {
    return { reason: issue ?? 'tag-review-command-invalid', status: 'invalid' };
  }
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing'
    ? { reason: 'record-missing', status: 'missing' } : loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const node = loaded.record.graph.nodes.find((item) => item.nodeId === command.nodeId);
  if (!node) return { reason: 'node-missing', status: 'missing' };
  if (node.protected && !command.confirmProtectedNode) {
    return { reason: 'protected-node-confirmation-required', status: 'invalid' };
  }
  const tag = node.tags.find((item) => item.canonicalId === command.tagId);
  if (!tag) return { reason: 'tag-suggestion-missing', status: 'missing' };
  if (tag.source !== 'system' || tag.status !== 'pending-review') {
    return { reason: 'tag-suggestion-not-pending', status: 'invalid' };
  }
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const status = command.decision === 'accept' ? 'active' as const : 'rejected' as const;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision, roleId: command.roleId,
    update: (graph) => ({ ...graph, graphVersion: graphVersion(revision),
      nodes: graph.nodes.map((item) => item.nodeId === command.nodeId
        ? { ...item, tags: item.tags.map((entry) => entry.canonicalId === command.tagId
          ? { ...entry, reviewedAt: timestamp, reviewerId: command.reviewerId, status } : entry),
        updatedAt: timestamp } : item) }),
  });
  if (result.status !== 'ok') return result;
  return { receipt: receipt({ commandId: command.commandId, commandType: 'review-tag-suggestion',
    decision: command.decision, nodeId: command.nodeId, revision, roleId: command.roleId,
    tagIds: [command.tagId], timestamp }), record: result.record, status: 'ok' };
}

export function createNeuralPersonaTagReviewCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}): NeuralPersonaTagReviewCommandService {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return {
    reviewSuggestion: (command) => executeReview(resolved, command),
    stageSuggestions: (command) => executeStage(resolved, command),
  };
}
