import {
  createGeneratedRelationshipPreviewGraph,
  generateNeuralPersonaRelationshipCandidates,
  supplementGeneratedRelationshipCandidates,
  type NeuralPersonaNodeGenerationBatch,
  type NeuralPersonaPersistedRecord,
} from '../character-graph/neural-persona';
import type { PetConfig } from '../types';
import { createNeuralPersonaConfiguredRelationshipCandidateProvider } from './neuralPersonaConfiguredRelationshipCandidateProvider';
import {
  neuralPersonaRelationshipFailureMessage,
  resolveNeuralPersonaRelationshipTimeoutMs,
} from './neuralPersonaRelationshipRequestPolicy';

export async function analyzeGeneratedNodeRelationships(options: {
  batch: NeuralPersonaNodeGenerationBatch;
  record?: NeuralPersonaPersistedRecord;
  settings: PetConfig['settings'];
  signal?: AbortSignal;
}) {
  const graph = createGeneratedRelationshipPreviewGraph(options.batch, options.record?.graph);
  const nodes = graph.nodes;
  const provider = createNeuralPersonaConfiguredRelationshipCandidateProvider({
    dataEgressConsent: options.settings.neuralPersonaProviderDataEgressConsent,
    settings: options.settings,
    timeoutMs: resolveNeuralPersonaRelationshipTimeoutMs(
      nodes.length, options.settings.neuralPersonaProviderTimeoutMs,
    ),
  });
  if (nodes.length < 2) {
    return { candidates: [], providerId: provider.providerId, status: 'complete' as const };
  }
  const result = await generateNeuralPersonaRelationshipCandidates({
    batchId: `${options.batch.batchId}:relationships`, edges: graph.edges,
    graphVersion: options.record?.graph.graphVersion ?? 'candidate-preview', nodes,
    now: Date.now(), provider, revision: options.record?.revision ?? -1,
    roleId: options.batch.roleId, signal: options.signal,
  });
  if (result.status === 'ok' || result.reason === 'relationship-candidate-empty') {
    const modelCandidates = result.status === 'ok' ? result.batch.candidates : [];
    const candidates = supplementGeneratedRelationshipCandidates({
      batch: options.batch, candidates: modelCandidates, nodes,
    });
    if (!candidates.length) return {
      candidates: [], providerId: provider.providerId,
      reason: 'relationship-candidate-empty', status: 'failed' as const,
    };
    return {
      candidates,
      providerId: modelCandidates.length === candidates.length
        ? result.status === 'ok' ? result.batch.providerId : provider.providerId
        : `${provider.providerId}+local-source-continuity`,
      status: 'complete' as const,
    };
  }
  return {
    candidates: [], providerId: provider.providerId,
    reason: result.reason, status: 'failed' as const,
  };
}

export async function completeGeneratedNodeRelationshipAnalysis(options: {
  batch: NeuralPersonaNodeGenerationBatch;
  record?: NeuralPersonaPersistedRecord;
  settings: PetConfig['settings'];
  signal?: AbortSignal;
}) {
  const relationshipAnalysis = await analyzeGeneratedNodeRelationships(options);
  const message = relationshipAnalysis.status === 'complete'
    ? `节点解析完成，并生成 ${relationshipAnalysis.candidates.length} 条待审核语义关系。请统一检查后确认。`
    : `节点解析完成，但关系分析失败：${neuralPersonaRelationshipFailureMessage(relationshipAnalysis.reason)} 请重试关系分析后再确认。`;
  return { batch: { ...options.batch, relationshipAnalysis }, message };
}
