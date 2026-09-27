import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { PetConfig } from '../src/types';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeBatchCommandService,
  createGeneratedRelationshipPreviewGraph,
  supplementGeneratedRelationshipCandidates,
  requestNeuralPersonaNodeGeneration,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaNodeGenerationProvider,
} from '../src/character-graph/neural-persona';
import {
  createNeuralPersonaNodeGenerationModelSettings,
  resolveNeuralPersonaNodeGenerationTimeoutMs,
} from '../src/services/neuralPersonaConfiguredNodeGenerationProvider';
import {
  extractOpenAICompatibleText,
  summarizeOpenAICompatibleResponse,
} from '../src/services/openAICompatibleResponseText';

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (roleId, expected, next) => {
      const current = records.get(roleId) ?? null;
      if (current !== expected) return false;
      records.set(roleId, next);
      return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
}

const sourceText = '她说话温和克制，遇到冲突时会先倾听。\n\n她喜欢安静的环境。';
assert.equal(resolveNeuralPersonaNodeGenerationTimeoutMs(8_000, 3_000), 60_000);
assert.equal(resolveNeuralPersonaNodeGenerationTimeoutMs(8_000, 4_491), 75_000);
assert.equal(resolveNeuralPersonaNodeGenerationTimeoutMs(30_000, 16_000), 105_000);
assert.equal(resolveNeuralPersonaNodeGenerationTimeoutMs(180_000, 16_000), 120_000);
const taskSettings = createNeuralPersonaNodeGenerationModelSettings({
  customModelRequestParams: [{
    id: 'max', key: 'max_tokens', value: '8192', valueType: 'number',
  }],
} as PetConfig['settings']);
assert.equal(taskSettings.customModelRequestParams.find(
  (param) => param.key === 'max_tokens',
)?.value, '6144');

const reasoningPayload = {
  choices: [{
    finish_reason: 'length',
    message: { content: '', reasoning_content: '{"candidates":[]}' },
  }],
  usage: {
    completion_tokens: 4096,
    completion_tokens_details: { reasoning_tokens: 4080 },
  },
};
assert.equal(extractOpenAICompatibleText(reasoningPayload), null);
assert.equal(extractOpenAICompatibleText(reasoningPayload, {
  allowReasoningContentFallback: true,
}), '{"candidates":[]}');
assert.equal(extractOpenAICompatibleText({ choices: [{ text: 'legacy text' }] }), 'legacy text');
assert.equal(extractOpenAICompatibleText({ output_text: 'output text' }), 'output text');
const responseSummary = summarizeOpenAICompatibleResponse(reasoningPayload);
assert.equal(responseSummary.finishReason, 'length');
assert.equal(responseSummary.reasoningTokens, 4080);
assert.equal(responseSummary.reasoningCharacters, 17);
assert.equal(JSON.stringify(responseSummary).includes('candidates'), false);
const provider: NeuralPersonaNodeGenerationProvider = {
  providerId: 'smoke-provider',
  generate: async () => ({
    candidates: [
      {
        baseWeight: 0.8, confidence: 0.9, evidence: '她说话温和克制',
        tags: ['Calm', 'calm'], topic: '温和表达', type: 'style-tendency',
      },
      {
        baseWeight: 0.7, confidence: 0.85, evidence: '她喜欢安静的环境',
        influenceSummary: '她喜欢安静的环境。',
        tags: ['安静'], topic: '环境偏好', type: 'preference',
      },
    ],
    status: 'ok',
  }),
};

const generated = await requestNeuralPersonaNodeGeneration({
  provider,
  request: {
    batchId: 'batch-1', now: 100, requestId: 'request-1',
    personaName: '测试主体', roleId: 'role-a', sourceText,
  },
});
assert.equal(generated.status, 'ok');
if (generated.status !== 'ok') throw new Error('generation failed');
assert.equal(generated.batch.candidates.length, 2);
assert.equal(generated.batch.candidates[0]?.origin, 'model');
assert.equal(generated.batch.candidates[0]?.influenceSummary, '她说话温和克制');
assert.equal(generated.batch.candidates[0]?.topic, '温和表达');
const relationshipPreview = createGeneratedRelationshipPreviewGraph(generated.batch);
const previewContent = relationshipPreview.nodes.filter((node) => (
  generated.batch.candidates.some((candidate) => node.nodeId.endsWith(`:${candidate.candidateId}`))
));
assert.equal(previewContent.length, 2);
assert.ok(previewContent.every((node) => node.parentNodeId));
assert.ok(previewContent.every((node) => relationshipPreview.nodes.some(
  (parent) => parent.nodeId === node.parentNodeId && parent.type === 'cognitive-topic',
)));
assert.ok(relationshipPreview.edges.some((edge) => edge.relationType === 'contains'));
const localRelationships = supplementGeneratedRelationshipCandidates({
  batch: generated.batch, candidates: [], nodes: relationshipPreview.nodes,
});
assert.equal(localRelationships.length, 1);
assert.equal(localRelationships[0]?.origin, 'local');
assert.equal(localRelationships[0]?.relationType, 'associated-with');
assert.deepEqual(new Set([
  localRelationships[0]?.sourceNodeId, localRelationships[0]?.targetNodeId,
]), new Set(previewContent.map((node) => node.nodeId)));

const longSourceText = `${sourceText}\n${'x'.repeat(16_001)}`;
const longGenerated = await requestNeuralPersonaNodeGeneration({
  provider,
  request: {
    batchId: 'batch-long', now: 100, requestId: 'request-long',
    personaName: '测试主体', roleId: 'role-long', sourceText: longSourceText,
  },
});
assert.equal(longGenerated.status, 'ok');

const storage = memoryStorage();
const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 200, storage,
});
const service = createNeuralPersonaNodeBatchCommandService({ now: () => 200, repository });
const manyCandidateBatch = {
  ...generated.batch,
  batchId: 'batch-many',
  candidates: Array.from({ length: 35 }, (_, index) => ({
    baseWeight: 0.7, candidateId: `many-${index + 1}`,
    confidence: 1, enabled: true, evidence: '',
    influenceSummary: `第 ${index + 1} 个完整人格语义节点`,
    origin: 'user' as const, tags: [], type: 'style-tendency' as const,
  })),
  personaName: '多节点测试主体', roleId: 'role-many',
  sourceText: '用于验证一次确认超过三十个人格节点时仍然可以完整提交。',
};
const manyCommitted = await service.commitGeneratedNodes({
  batch: manyCandidateBatch, commandId: 'commit-many', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-many',
});
assert.equal(manyCommitted.status, 'ok');
if (manyCommitted.status !== 'ok') throw new Error('many candidate commit failed');
assert.equal(manyCommitted.receipt.generatedNodeIds.length, 35);
if (longGenerated.status !== 'ok') throw new Error('long generation failed');
const longCommitted = await service.commitGeneratedNodes({
  batch: longGenerated.batch, commandId: 'commit-long', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-long',
});
assert.equal(longCommitted.status, 'ok');
const committed = await service.commitGeneratedNodes({
  batch: generated.batch, commandId: 'commit-1', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(committed.status, 'ok');
if (committed.status !== 'ok') throw new Error('commit failed');
assert.equal(committed.record.revision, 0);
assert.equal(committed.record.graph.nodes.length, 7);
assert.equal(committed.record.graph.edges.length, 6);
const anchor = committed.record.graph.nodes.find((node) => node.type === 'persona-anchor');
assert.ok(anchor?.protected);
assert.equal(anchor.influenceSummary, '主要人格：测试主体');
assert.equal(anchor.sourceRef, 'persona-store:role-a');
assert.equal(committed.receipt.personaAnchorNodeId, anchor.nodeId);
assert.equal(committed.receipt.generatedEdgeIds.length, 6);
assert.equal(committed.receipt.generatedBranchNodeIds.length, 4);
const anchorEdges = committed.record.graph.edges.filter(
  (edge) => edge.sourceNodeId === anchor.nodeId,
);
assert.equal(anchorEdges.length, 2);
assert.ok(anchorEdges.every((edge) => edge.relationType === 'contains'));
assert.ok(anchorEdges.every((edge) => committed.record.graph.nodes.find(
  (node) => node.nodeId === edge.targetNodeId,
)?.type === 'cognitive-domain'));
const firstGeneratedNode = committed.record.graph.nodes.find(
  (node) => node.nodeId === committed.receipt.generatedNodeIds[0],
);
const firstTopicNode = committed.record.graph.nodes.find(
  (node) => node.nodeId === firstGeneratedNode?.parentNodeId,
);
assert.equal(firstTopicNode?.type, 'cognitive-topic');
assert.equal(firstTopicNode?.influenceSummary, '温和表达');
assert.equal(firstGeneratedNode?.tags[0]?.status, 'active');
assert.equal(firstGeneratedNode?.tags[0]?.reviewerId, 'local-user');
assert.equal(firstGeneratedNode?.tags.length, 1);

const secondBatch = {
  ...generated.batch,
  batchId: 'batch-2',
  candidates: [{
    ...generated.batch.candidates[0]!, candidateId: 'candidate-new',
    evidence: '她喜欢安静的环境', influenceSummary: '偏好安静的环境。',
    tags: ['安静'], type: 'preference' as const,
  }],
};
const merged = await service.commitGeneratedNodes({
  batch: secondBatch, commandId: 'commit-2', expectedRevision: 0,
  reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(merged.status, 'ok');
if (merged.status !== 'ok') throw new Error('merge failed');
assert.equal(merged.record.revision, 1);
assert.equal(merged.record.graph.nodes.length, 9);
assert.equal(merged.record.graph.edges.length, 8);
assert.equal(merged.record.recoverySnapshots.length, 1);

const firstAnchorEdgeId = committed.receipt.generatedEdgeIds[0]!;
const edgeRemoved = await repository.transact({
  expectedRevision: 1,
  roleId: 'role-a',
  update: (graph) => ({
    ...graph,
    edges: graph.edges.filter((edge) => edge.edgeId !== firstAnchorEdgeId),
  }),
});
assert.equal(edgeRemoved.status, 'ok');
const repaired = await service.commitGeneratedNodes({
  batch: generated.batch, commandId: 'commit-repair', expectedRevision: 2,
  reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(repaired.status, 'ok');
if (repaired.status !== 'ok') throw new Error('hierarchy edge repair failed');
assert.equal(repaired.receipt.generatedNodeIds.length, 0);
assert.equal(repaired.receipt.generatedEdgeIds.length, 1);
assert.equal(repaired.receipt.reusedNodeIds.length, 2);
assert.ok(repaired.record.graph.edges.some((edge) => edge.edgeId === firstAnchorEdgeId));

const duplicate = await service.commitGeneratedNodes({
  batch: generated.batch, commandId: 'commit-duplicate', expectedRevision: 3,
  reviewerId: 'local-user', roleId: 'role-a',
});
assert.deepEqual(duplicate, { reason: 'generated-node-already-exists', status: 'invalid' });
assert.deepEqual(await service.commitGeneratedNodes({
  batch: { ...generated.batch, version: 'invalid' as never },
  commandId: 'commit-invalid-version', expectedRevision: 3,
  reviewerId: 'local-user', roleId: 'role-a',
}), { reason: 'generated-node-batch-version-invalid', status: 'invalid' });
const unchanged = await repository.load('role-a');
assert.equal(unchanged.status === 'ok' ? unchanged.record.revision : -1, 3);
assert.equal((await repository.load('role-b')).status, 'missing');

const unifiedBatch = {
  ...generated.batch,
  batchId: 'batch-unified',
  candidates: [
    {
      baseWeight: 0.8, candidateId: 'unified-a', confidence: 0.9,
      enabled: true, evidence: '', influenceSummary: '统一提交节点 A',
      origin: 'user' as const, tags: ['统一'], type: 'style-tendency' as const,
    },
    {
      baseWeight: 0.7, candidateId: 'unified-b', confidence: 0.85,
      enabled: true, evidence: '', influenceSummary: '统一提交节点 B',
      origin: 'user' as const, tags: ['统一'], type: 'preference' as const,
    },
  ],
  personaName: '统一提交主体', roleId: 'role-unified',
  relationshipAnalysis: {
    candidates: [{
      candidateId: 'unified-relation', confidence: 0.88, enabled: true,
      origin: 'model' as const, reason: '两个节点具有明确的语义关联',
      relationType: 'associated-with' as const,
      sourceNodeId: 'generated:batch-unified:unified-a',
      targetNodeId: 'generated:batch-unified:unified-b', weight: 0.75,
    }],
    providerId: 'smoke-relationship-provider', status: 'complete' as const,
  },
  sourceText: '用于验证节点、层级关系与语义关系在同一个 Repository 事务中完成。',
};
const unified = await service.commitGeneratedNodes({
  batch: unifiedBatch, commandId: 'commit-unified', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-unified',
});
assert.equal(unified.status, 'ok');
if (unified.status !== 'ok') throw new Error('unified graph commit failed');
assert.equal(unified.record.revision, 0);
assert.equal(unified.record.recoverySnapshots.length, 0);
assert.equal(unified.receipt.generatedSemanticEdgeIds.length, 1);
assert.ok(unified.record.graph.edges.some((edge) => (
  edge.edgeId === unified.receipt.generatedSemanticEdgeIds[0]
    && edge.relationType === 'associated-with'
)));

const invalidRelationship = await service.commitGeneratedNodes({
  batch: {
    ...unifiedBatch, batchId: 'batch-invalid-endpoint', roleId: 'role-invalid-endpoint',
    relationshipAnalysis: { ...unifiedBatch.relationshipAnalysis, candidates: [{
      ...unifiedBatch.relationshipAnalysis.candidates[0]!, sourceNodeId: 'missing-node',
    }] },
  },
  commandId: 'commit-invalid-endpoint', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-invalid-endpoint',
});
assert.deepEqual(invalidRelationship, {
  reason: 'relationship-candidate-invalid', status: 'invalid',
});
assert.equal((await repository.load('role-invalid-endpoint')).status, 'missing');

const reverseDuplicate = await service.commitGeneratedNodes({
  batch: {
    ...unifiedBatch, roleId: 'role-reverse-duplicate',
    relationshipAnalysis: { ...unifiedBatch.relationshipAnalysis, candidates: [
      unifiedBatch.relationshipAnalysis.candidates[0]!,
      {
        ...unifiedBatch.relationshipAnalysis.candidates[0]!, candidateId: 'reverse-relation',
        sourceNodeId: unifiedBatch.relationshipAnalysis.candidates[0]!.targetNodeId,
        targetNodeId: unifiedBatch.relationshipAnalysis.candidates[0]!.sourceNodeId,
      },
    ] },
  },
  commandId: 'commit-reverse-duplicate', expectedRevision: null,
  reviewerId: 'local-user', roleId: 'role-reverse-duplicate',
});
assert.deepEqual(reverseDuplicate, {
  reason: 'relationship-candidate-duplicate', status: 'invalid',
});
assert.equal((await repository.load('role-reverse-duplicate')).status, 'missing');

const sectionSource = fs.readFileSync(
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx', 'utf8',
);
const panelSource = fs.readFileSync(
  'src/components/settings/NeuralPersonaNodeGenerationPanel.tsx', 'utf8',
);
const hookSource = fs.readFileSync(
  'src/components/settings/useNeuralPersonaNodeGeneration.ts', 'utf8',
);
const providerSource = fs.readFileSync(
  'src/services/neuralPersonaConfiguredNodeGenerationProvider.ts', 'utf8',
);
assert.match(sectionSource, /NeuralPersonaNodeGenerationPanel/u);
assert.match(panelSource, /确认并生成完整认知图谱/u);
assert.match(panelSource, /重新分析关系/u);
assert.match(panelSource, /正在分析候选节点之间的语义关系/u);
assert.match(panelSource, /neuralPersonaProviderDataEgressConsent/u);
assert.match(panelSource, /data-neural-node-generation-status/u);
assert.match(panelSource, /aria-live="polite"/u);
assert.match(panelSource, /WebkitAppRegion: 'no-drag'/u);
assert.match(panelSource, /取消分析/u);
assert.doesNotMatch(panelSource, /maxLength=\{16000\}/u);
assert.doesNotMatch(panelSource, /\/16000/u);
assert.match(hookSource, /最多.*批并行/u);
assert.match(hookSource, /已完成.*totalBatches/u);
assert.match(hookSource, /智能解析请求异常/u);
assert.match(hookSource, /finally/u);
assert.match(providerSource, /personaBlocks/u);
assert.match(providerSource, /sourceId/u);
assert.match(providerSource, /NODE_GENERATION_BLOCK_BATCH_SIZE/u);
assert.match(providerSource, /NODE_GENERATION_RETRY_BLOCK_BATCH_SIZE/u);
assert.match(providerSource, /NEURAL_PERSONA_NODE_GENERATION_CONCURRENCY/u);
assert.match(providerSource, /retryRecoverable: false/u);
assert.match(providerSource, /overallTimeoutMs/u);
assert.match(providerSource, /classifyNeuralPersonaBlockBatchesWithRecovery/u);
assert.doesNotMatch(providerSource, /最多生成 12 项/u);

console.log('neural persona intelligent node generation smoke ok');
